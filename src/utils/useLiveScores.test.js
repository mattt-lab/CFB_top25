// Unit tests for matchLiveGames -- the pure join between our marquee games[] and a raw ESPN
// scoreboard response, keyed through a team-id -> ESPN-id map (see espnTeamMap.json). The fetch/
// polling side of useLiveScores is exercised manually in the browser, not here (see its header
// comment) -- this only covers the join logic, which is where a wrong match would actually hurt.
import { describe, it, expect } from 'vitest';
import { matchLiveGames, toPseudoGame, needsPolling, scoreboardUrls, fetchScoreboard } from './useLiveScores.js';

const TEAM_MAP = { 'ohio-state': '194', michigan: '130', clemson: '228', lsu: '99' };

function espnEvent({ awayId, awayScore, homeId, homeScore, state, period, clock, date }) {
  return {
    date,
    competitions: [
      {
        date,
        status: { type: { state }, period, displayClock: clock },
        competitors: [
          { homeAway: 'away', team: { id: awayId }, score: String(awayScore) },
          { homeAway: 'home', team: { id: homeId }, score: String(homeScore) },
        ],
      },
    ],
  };
}

describe('matchLiveGames', () => {
  it('patches status/period/clock/scores for a live, matched game', () => {
    const games = [{ id: 'g1', away: 'ohio-state', home: 'michigan' }];
    const espn = { events: [espnEvent({ awayId: '194', awayScore: 17, homeId: '130', homeScore: 14, state: 'in', period: 3, clock: '8:42' })] };
    expect(matchLiveGames(games, espn, TEAM_MAP)).toEqual({
      g1: { status: 'in_progress', period: 3, clock: '8:42', awayScore: 17, homeScore: 14 },
    });
  });

  it('maps a finished ESPN event to our "final" status with null period/clock', () => {
    const games = [{ id: 'g1', away: 'ohio-state', home: 'michigan' }];
    const espn = { events: [espnEvent({ awayId: '194', awayScore: 24, homeId: '130', homeScore: 20, state: 'post', period: 4, clock: '0:00' })] };
    expect(matchLiveGames(games, espn, TEAM_MAP)).toEqual({
      g1: { status: 'final', period: null, clock: null, awayScore: 24, homeScore: 20 },
    });
  });

  it('skips a game where one team has no entry in the team map', () => {
    const games = [{ id: 'g1', away: 'ohio-state', home: 'some-fcs-school' }];
    const espn = { events: [espnEvent({ awayId: '194', awayScore: 10, homeId: '999', homeScore: 0, state: 'in' })] };
    expect(matchLiveGames(games, espn, TEAM_MAP)).toEqual({});
  });

  it('skips a game when no ESPN event contains both mapped teams', () => {
    const games = [{ id: 'g1', away: 'ohio-state', home: 'michigan' }];
    const espn = { events: [espnEvent({ awayId: '194', awayScore: 10, homeId: '228', homeScore: 3, state: 'in' })] }; // ohio-state vs clemson, not michigan
    expect(matchLiveGames(games, espn, TEAM_MAP)).toEqual({});
  });

  it('returns an empty overlay for an empty or missing events list', () => {
    const games = [{ id: 'g1', away: 'ohio-state', home: 'michigan' }];
    expect(matchLiveGames(games, { events: [] }, TEAM_MAP)).toEqual({});
    expect(matchLiveGames(games, {}, TEAM_MAP)).toEqual({});
  });

  it('reports null scores for a scheduled (not-yet-started) matched game', () => {
    const games = [{ id: 'g1', away: 'ohio-state', home: 'michigan' }];
    const espn = { events: [espnEvent({ awayId: '194', awayScore: 0, homeId: '130', homeScore: 0, state: 'pre' })] };
    expect(matchLiveGames(games, espn, TEAM_MAP)).toEqual({
      g1: { status: 'scheduled', period: null, clock: null, awayScore: null, homeScore: null },
    });
  });

  it('falls back to null instead of NaN when ESPN omits a score on a live event', () => {
    const games = [{ id: 'g1', away: 'ohio-state', home: 'michigan' }];
    const espn = {
      events: [{
        competitions: [{
          status: { type: { state: 'in' }, period: 2, displayClock: '3:00' },
          competitors: [
            { team: { id: '194' } }, // no `score` field at all -- ESPN can transiently omit it
            { team: { id: '130' }, score: '14' },
          ],
        }],
      }],
    };
    expect(matchLiveGames(games, espn, TEAM_MAP)).toEqual({
      g1: { status: 'in_progress', period: 2, clock: '3:00', awayScore: null, homeScore: 14 },
    });
  });

  it('skips only the malformed game, not the whole batch, when a matched event has a corrupt competitor entry', () => {
    // The outer team-registration loop already guards a competitor with no `.team` (skips it via
    // `if (!c.team?.id) continue`), so ohio-state/michigan still get registered off their real
    // entries below -- but the per-game re-lookup (`competitors.find(c => c.team.id === ...)`)
    // iterates the SAME array with no such guard, and .find() evaluates its callback on every
    // entry up to a match. A malformed entry sitting before the real one in iteration order
    // throws mid-`.find()`, which -- without a per-game try/catch -- would abort the whole tick's
    // matchLiveGames call and blank every OTHER game's real update along with it.
    const games = [
      { id: 'g1', away: 'ohio-state', home: 'michigan' },
      { id: 'g2', away: 'clemson', home: 'lsu' },
    ];
    const corruptEvent = {
      competitions: [{
        status: { type: { state: 'in' }, period: 1, displayClock: '12:00' },
        competitors: [
          { team: null }, // corrupt entry -- no team at all
          { homeAway: 'away', team: { id: '194' }, score: '17' },
          { homeAway: 'home', team: { id: '130' }, score: '14' },
        ],
      }],
    };
    const espn = {
      events: [
        corruptEvent,
        espnEvent({ awayId: '228', awayScore: 10, homeId: '99', homeScore: 7, state: 'in', period: 1, clock: '12:00' }),
      ],
    };
    expect(matchLiveGames(games, espn, TEAM_MAP)).toEqual({
      g2: { status: 'in_progress', period: 1, clock: '12:00', awayScore: 10, homeScore: 7 },
    });
  });

  it('picks the event closest to our own tracked kickoff time when the same pair has two real events (a rematch)', () => {
    // Ohio State and Michigan play twice: a regular-season game already final, and a rematch
    // (conference championship/playoff) still to come. Without date disambiguation, `.find()`
    // would just return whichever one happens to iterate first, regardless of which one our
    // `g.when` actually points at.
    const games = [{ id: 'g1', away: 'ohio-state', home: 'michigan', when: '2026-12-06T20:00:00Z' }];
    const espn = {
      events: [
        espnEvent({ awayId: '194', awayScore: 24, homeId: '130', homeScore: 17, state: 'post', date: '2026-11-28T17:00:00Z' }),
        espnEvent({ awayId: '194', awayScore: 3, homeId: '130', homeScore: 0, state: 'in', period: 1, clock: '14:00', date: '2026-12-06T20:00:00Z' }),
      ],
    };
    expect(matchLiveGames(games, espn, TEAM_MAP)).toEqual({
      g1: { status: 'in_progress', period: 1, clock: '14:00', awayScore: 3, homeScore: 0 },
    });
  });

  it('still matches correctly when one team has a SECOND, unrelated event in the response', () => {
    // Reproduces a real bug: ESPN's scoreboard with no `dates` param can return a window spanning
    // more than one calendar day (confirmed live -- USC's real live game against San Jose State
    // was returned alongside USC's OWN following-week game against Fresno State in the same
    // response). A flat "one event per team id" map lets whichever event iterates last win that
    // team's slot, silently losing the live match. clemson's other, unrelated event is listed
    // AFTER the real ohio-state/michigan matchup here specifically to catch that regression.
    const games = [{ id: 'g1', away: 'ohio-state', home: 'michigan' }];
    const espn = {
      events: [
        espnEvent({ awayId: '194', awayScore: 17, homeId: '130', homeScore: 14, state: 'in', period: 3, clock: '8:42' }),
        espnEvent({ awayId: '130', awayScore: 0, homeId: '228', homeScore: 0, state: 'pre' }), // michigan's OTHER, later game
      ],
    };
    expect(matchLiveGames(games, espn, TEAM_MAP)).toEqual({
      g1: { status: 'in_progress', period: 3, clock: '8:42', awayScore: 17, homeScore: 14 },
    });
  });
});

describe('toPseudoGame', () => {
  it('puts the owning team on the away side when nextGame.homeAway is "away"', () => {
    expect(toPseudoGame('michigan', { opponentId: 'ohio-state', homeAway: 'away', when: '2026-09-05T20:00:00Z' }))
      .toEqual({ id: 'michigan', away: 'michigan', home: 'ohio-state', when: '2026-09-05T20:00:00Z' });
  });

  it('puts the owning team on the home side when nextGame.homeAway is "home"', () => {
    expect(toPseudoGame('michigan', { opponentId: 'ohio-state', homeAway: 'home', when: '2026-09-05T20:00:00Z' }))
      .toEqual({ id: 'michigan', away: 'ohio-state', home: 'michigan', when: '2026-09-05T20:00:00Z' });
  });

  it('returns null for a bye week (no nextGame)', () => {
    expect(toPseudoGame('michigan', null)).toBeNull();
  });

  it('returns null for a pre-opponentId snapshot', () => {
    expect(toPseudoGame('michigan', { homeAway: 'home' })).toBeNull();
  });

  it('defaults when to null if nextGame has no kickoff time', () => {
    expect(toPseudoGame('michigan', { opponentId: 'ohio-state', homeAway: 'home' }))
      .toEqual({ id: 'michigan', away: 'ohio-state', home: 'michigan', when: null });
  });
});

describe('needsPolling', () => {
  const now = Date.parse('2026-09-06T00:00:00Z');

  it('keeps polling a game already in_progress', () => {
    const games = [{ id: 'g1', away: 'a', home: 'b', when: '2026-08-01T00:00:00Z' }];
    expect(needsPolling(games, { g1: { status: 'in_progress' } }, now)).toBe(true);
  });

  it('stops polling a game already known final', () => {
    const games = [{ id: 'g1', away: 'a', home: 'b', when: '2026-08-01T00:00:00Z' }];
    expect(needsPolling(games, { g1: { status: 'final' } }, now)).toBe(false);
  });

  it('keeps polling an unmatched game whose kickoff is within the window (before or after now)', () => {
    const soon = [{ id: 'g1', away: 'a', home: 'b', when: '2026-09-06T02:00:00Z' }]; // 2h from now
    const justPassed = [{ id: 'g2', away: 'a', home: 'b', when: '2026-09-05T23:00:00Z' }]; // 1h ago
    expect(needsPolling(soon, {}, now)).toBe(true);
    expect(needsPolling(justPassed, {}, now)).toBe(true);
  });

  it('stops polling an unmatched game whose kickoff is well outside the window', () => {
    const farFuture = [{ id: 'g1', away: 'a', home: 'b', when: '2026-09-10T00:00:00Z' }];
    const farPast = [{ id: 'g2', away: 'a', home: 'b', when: '2026-08-01T00:00:00Z' }];
    expect(needsPolling(farFuture, {}, now)).toBe(false);
    expect(needsPolling(farPast, {}, now)).toBe(false);
  });

  it('keeps polling when a game has no kickoff time at all rather than going silently stale', () => {
    const games = [{ id: 'g1', away: 'a', home: 'b', when: null }];
    expect(needsPolling(games, {}, now)).toBe(true);
  });

  it('is true if ANY tracked game still needs polling, even if others are done', () => {
    const games = [
      { id: 'g1', away: 'a', home: 'b', when: '2026-08-01T00:00:00Z' },
      { id: 'g2', away: 'c', home: 'd', when: '2026-09-06T02:00:00Z' },
    ];
    expect(needsPolling(games, { g1: { status: 'final' } }, now)).toBe(true);
  });
});

describe('scoreboardUrls', () => {
  const at = (when) => [{ id: 'g', away: 'a', home: 'b', when }];
  const days = (urls) => urls.map((u) => u.match(/dates=(\d+)$/)?.[1] ?? null);

  it('asks for exactly the one ESPN day a same-day slate falls on', () => {
    const games = [
      { id: 'g1', away: 'a', home: 'b', when: '2026-09-19T16:00:00Z' }, // noon ET
      { id: 'g2', away: 'c', home: 'd', when: '2026-09-19T23:30:00Z' }, // 7:30pm ET
    ];
    expect(days(scoreboardUrls(games))).toEqual(['20260919']);
  });

  it("uses ESPN's US-Eastern calendar day, not the UTC day -- a Saturday-night game after 8pm ET is still Saturday", () => {
    // Confirmed live 2026-09-19: dates=20260919 returned events from 15:30Z Sat through 03:00Z Sun,
    // and dates=20260920 returned none. Texas kicked off 2026-09-20T00:00Z (8pm ET Saturday).
    expect(days(scoreboardUrls(at('2026-09-20T00:00:00Z')))).toEqual(['20260919']);
    // Friday-night game that lands on Saturday in UTC (10:30pm ET Fri)
    expect(days(scoreboardUrls(at('2026-09-19T02:30:00Z')))).toEqual(['20260918']);
  });

  it('follows the Eastern offset through DST (EST is UTC-5, not UTC-4, in winter)', () => {
    // 04:30Z on Dec 6 is 11:30pm EST Dec 5. A hardcoded UTC-4 would call it 12:30am Dec 6.
    expect(days(scoreboardUrls(at('2026-12-06T04:30:00Z')))).toEqual(['20261205']);
  });

  it('returns one URL per distinct day, sorted, when a slate spans several days', () => {
    const games = [
      { id: 'g1', away: 'a', home: 'b', when: '2026-09-20T00:00:00Z' }, // Sat 8pm ET
      { id: 'g2', away: 'c', home: 'd', when: '2026-09-19T02:30:00Z' }, // Fri 10:30pm ET
      { id: 'g3', away: 'e', home: 'f', when: '2026-09-19T16:00:00Z' }, // Sat noon ET
    ];
    expect(days(scoreboardUrls(games))).toEqual(['20260918', '20260919']);
  });

  it('also asks for the previous ESPN day for a kickoff just after midnight ET (in case ESPN buckets it with the night before)', () => {
    // 04:00Z = 12:00am ET Sunday; 6h earlier is 6pm ET Saturday.
    expect(days(scoreboardUrls(at('2026-09-20T04:00:00Z')))).toEqual(['20260919', '20260920']);
  });

  it('REGRESSION 2026-09-19: never emits a dates=A-B range -- ESPN answers every range with HTTP 400 "Failed to get events endpoint", which blacked out every live score', () => {
    const games = [
      { id: 'g1', away: 'a', home: 'b', when: '2026-09-11T23:00:00Z' },
      { id: 'g2', away: 'c', home: 'd', when: '2026-09-20T00:00:00Z' },
    ];
    for (const url of scoreboardUrls(games)) expect(url).not.toMatch(/dates=\d{8}-\d{8}/);
  });

  it('keeps groups=80 on every URL', () => {
    for (const url of scoreboardUrls(at('2026-09-19T16:00:00Z'))) expect(url).toContain('groups=80');
  });

  it('falls back to the plain dateless URL when no game has a parseable `when`', () => {
    const urls = scoreboardUrls(at(null));
    expect(urls).toHaveLength(1);
    expect(urls[0]).not.toMatch(/dates=/);
    expect(urls[0]).toMatch(/groups=80&limit=150$/);
  });
});

describe('fetchScoreboard', () => {
  const games = [
    { id: 'g1', away: 'a', home: 'b', when: '2026-09-19T02:30:00Z' }, // ESPN day 20260918
    { id: 'g2', away: 'c', home: 'd', when: '2026-09-19T16:00:00Z' }, // ESPN day 20260919
  ];
  const okJson = (events) => Promise.resolve({ ok: true, json: () => Promise.resolve({ events }) });
  const bad = (status) => Promise.resolve({ ok: false, status });

  it('merges the events from every day it fetched', async () => {
    const fetchFn = (url) => (url.endsWith('20260918') ? okJson([{ id: 'e1' }]) : okJson([{ id: 'e2' }, { id: 'e3' }]));
    const merged = await fetchScoreboard(games, fetchFn);
    expect(merged.events.map((e) => e.id).sort()).toEqual(['e1', 'e2', 'e3']);
  });

  it('still returns the days that worked when one day fails -- one bad day must not black out the rest', async () => {
    const fetchFn = (url) => (url.endsWith('20260918') ? bad(400) : okJson([{ id: 'e2' }]));
    const merged = await fetchScoreboard(games, fetchFn);
    expect(merged.events.map((e) => e.id)).toEqual(['e2']);
  });

  it("throws when every day fails, so the caller's backoff/retry path still runs", async () => {
    await expect(fetchScoreboard(games, () => bad(400))).rejects.toThrow(/HTTP 400/);
  });
});
