// Unit tests for the server-side ESPN event matcher -- same join logic as
// src/utils/useLiveScores.test.js's matchLiveGames tests, adapted for the simpler
// (id-only, no live status) server-side lookup.
import { describe, it, expect } from 'vitest';
import { buildEventsByEspnTeamId, findEspnEventId, buildScoreboardUrls } from './espn-match.mjs';

const TEAM_MAP = { 'ohio-state': '194', michigan: '130', clemson: '228' };

function espnEvent({ id, awayId, homeId, date }) {
  return {
    id,
    date,
    competitions: [{
      competitors: [
        { homeAway: 'away', team: { id: awayId } },
        { homeAway: 'home', team: { id: homeId } },
      ],
    }],
  };
}

describe('findEspnEventId', () => {
  it('finds the event id for a game where both teams share exactly one event', () => {
    const scoreboard = { events: [espnEvent({ id: 'e1', awayId: '194', homeId: '130' })] };
    const map = buildEventsByEspnTeamId(scoreboard);
    const game = { away: 'ohio-state', home: 'michigan', when: null };
    expect(findEspnEventId(game, map, TEAM_MAP)).toBe('e1');
  });

  it('returns null when either team has no espnTeamMap entry', () => {
    const scoreboard = { events: [espnEvent({ id: 'e1', awayId: '194', homeId: '999' })] };
    const map = buildEventsByEspnTeamId(scoreboard);
    const game = { away: 'ohio-state', home: 'some-fcs-school', when: null };
    expect(findEspnEventId(game, map, TEAM_MAP)).toBeNull();
  });

  it('returns null when no shared event exists for the pair', () => {
    const scoreboard = { events: [espnEvent({ id: 'e1', awayId: '194', homeId: '228' })] };
    const map = buildEventsByEspnTeamId(scoreboard);
    const game = { away: 'ohio-state', home: 'michigan', when: null };
    expect(findEspnEventId(game, map, TEAM_MAP)).toBeNull();
  });

  it('picks the event closest to our own tracked kickoff time for a rematch (two shared events)', () => {
    const scoreboard = {
      events: [
        espnEvent({ id: 'earlier', awayId: '194', homeId: '130', date: '2026-11-01T17:00:00Z' }),
        espnEvent({ id: 'later', awayId: '194', homeId: '130', date: '2026-12-06T20:00:00Z' }),
      ],
    };
    const map = buildEventsByEspnTeamId(scoreboard);
    const game = { away: 'ohio-state', home: 'michigan', when: '2026-12-06T19:30:00Z' };
    expect(findEspnEventId(game, map, TEAM_MAP)).toBe('later');
  });

  it('falls back to the first candidate when the game has no `when` to disambiguate multiple matches', () => {
    const scoreboard = {
      events: [
        espnEvent({ id: 'first', awayId: '194', homeId: '130', date: '2026-11-01T17:00:00Z' }),
        espnEvent({ id: 'second', awayId: '194', homeId: '130', date: '2026-12-06T20:00:00Z' }),
      ],
    };
    const map = buildEventsByEspnTeamId(scoreboard);
    const game = { away: 'ohio-state', home: 'michigan', when: null };
    expect(findEspnEventId(game, map, TEAM_MAP)).toBe('first');
  });
});

const BASE = 'https://example.com/scoreboard?groups=80&limit=150';

describe('buildScoreboardUrls', () => {
  const at = (when) => [{ id: 'g', away: 'a', home: 'b', when }];

  it('asks for exactly the one ESPN day a same-day slate falls on', () => {
    const games = [
      { id: 'g1', away: 'a', home: 'b', when: '2026-09-19T16:00:00Z' },
      { id: 'g2', away: 'c', home: 'd', when: '2026-09-19T23:30:00Z' },
    ];
    expect(buildScoreboardUrls(games, BASE)).toEqual([`${BASE}&dates=20260919`]);
  });

  it("uses ESPN's US-Eastern calendar day, not the UTC day (confirmed live 2026-09-19: an 8pm ET Saturday kickoff is filed under Saturday)", () => {
    expect(buildScoreboardUrls(at('2026-09-20T00:00:00Z'), BASE)).toEqual([`${BASE}&dates=20260919`]);
    expect(buildScoreboardUrls(at('2026-09-19T02:30:00Z'), BASE)).toEqual([`${BASE}&dates=20260918`]);
  });

  it('follows the Eastern offset through DST (EST is UTC-5 in winter)', () => {
    expect(buildScoreboardUrls(at('2026-12-06T04:30:00Z'), BASE)).toEqual([`${BASE}&dates=20261205`]);
  });

  it('returns one URL per distinct day, sorted', () => {
    const games = [
      { id: 'g1', away: 'a', home: 'b', when: '2026-09-20T00:00:00Z' },
      { id: 'g2', away: 'c', home: 'd', when: '2026-09-19T02:30:00Z' },
      { id: 'g3', away: 'e', home: 'f', when: '2026-09-19T16:00:00Z' },
    ];
    expect(buildScoreboardUrls(games, BASE)).toEqual([`${BASE}&dates=20260918`, `${BASE}&dates=20260919`]);
  });

  it('also asks for the previous ESPN day for a kickoff just after midnight ET', () => {
    expect(buildScoreboardUrls(at('2026-09-20T04:00:00Z'), BASE)).toEqual([
      `${BASE}&dates=20260919`, `${BASE}&dates=20260920`,
    ]);
  });

  it('REGRESSION 2026-09-19: never emits a dates=A-B range -- ESPN answers every range with HTTP 400, which silently skipped all recap/predictor enrichment', () => {
    const games = [
      { id: 'g1', away: 'a', home: 'b', when: '2026-09-11T23:00:00Z' },
      { id: 'g2', away: 'c', home: 'd', when: '2026-09-20T00:00:00Z' },
    ];
    for (const url of buildScoreboardUrls(games, BASE)) expect(url).not.toMatch(/dates=\d{8}-\d{8}/);
  });

  it('falls back to the plain base URL when no game has a parseable `when`', () => {
    expect(buildScoreboardUrls(at(null), BASE)).toEqual([BASE]);
  });
});
