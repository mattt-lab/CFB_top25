// Unit tests for the pure helper functions in teams.js -- the shared logic several components
// were duplicating with slightly different inline ternaries before being consolidated here
// (see the "Rank-delta helpers" comment block in teams.js for the convention they all share).
import { describe, it, expect } from 'vitest';
import {
  arrowGlyph, dirFor, trendColor, deltaLabel, computerRatingNote, byRankAsc, trendOf, formatKickoff, isToday,
  americanOdds, nextGameParts, gameStatusBadge, leadingScoreLabel, confSlugFor, confByRouteSlug, confRecord,
  gameAlert, periodLabel,
} from './teams.js';

describe('americanOdds', () => {
  it('formats a favorite as negative american odds', () => {
    expect(americanOdds(75)).toBe('-300');
  });
  it('formats an underdog as positive american odds', () => {
    expect(americanOdds(20)).toBe('+400');
  });
  it('caps absurd longshot odds at the display ceiling instead of the raw formula output', () => {
    // Raw formula for a 1% chance would be +9900 already; 0.1% would be +99900 uncapped --
    // exactly the "+99900" bottom-of-poll display bug this cap exists to fix.
    expect(americanOdds(0.1)).toBe('+9900');
  });
});

describe('nextGameParts', () => {
  it('returns null parts for a bye week (no nextGame)', () => {
    expect(nextGameParts(null)).toEqual({
      opponent: null, vsAt: null, opponentTeam: null, opponentRank: null, opponentName: null,
      kickoff: null, homeAway: null,
      status: null, awayScore: null, homeScore: null, period: null, clock: null,
    });
  });
  it('formats a home game against a ranked opponent', () => {
    const { opponent, vsAt, opponentRank, opponentName } = nextGameParts({
      homeAway: 'home', opponent: 'Michigan', opponentRank: 8, when: null, network: null,
    });
    expect(opponent).toBe('vs #8 Michigan');
    expect(vsAt).toBe('vs');
    expect(opponentRank).toBe(8);
    expect(opponentName).toBe('Michigan');
  });
  it('formats an away game against an unranked opponent (no rank prefix)', () => {
    const { opponent, vsAt, opponentRank } = nextGameParts({
      homeAway: 'away', opponent: 'Ball State', opponentRank: null, when: null, network: null,
    });
    expect(opponent).toBe('at Ball State');
    expect(vsAt).toBe('at');
    expect(opponentRank).toBeNull();
  });
  it('resolves opponentTeam from opponentId once the pipeline provides one, null otherwise', () => {
    expect(nextGameParts({
      homeAway: 'home', opponent: 'Ohio State', opponentId: 'ohio-state', opponentRank: 1, when: null, network: null,
    }).opponentTeam?.id).toBe('ohio-state');
    expect(nextGameParts({
      homeAway: 'home', opponent: 'Michigan', opponentRank: 8, when: null, network: null,
    }).opponentTeam).toBeNull();
  });
  it('joins kickoff time and network with a middot, omitting either when absent', () => {
    const { kickoff } = nextGameParts({
      homeAway: 'home', opponent: 'X', opponentRank: null,
      when: new Date(Date.now() + 2 * 86400000).toISOString(), network: 'FOX',
    });
    expect(kickoff).toMatch(/FOX$/);
  });
  it('defaults status to scheduled and passes through nulls when a game has no live data yet', () => {
    const parts = nextGameParts({ homeAway: 'home', opponent: 'X', opponentRank: null, when: null, network: null });
    expect(parts.status).toBe('scheduled');
    expect(parts.awayScore).toBeNull();
    expect(parts.homeScore).toBeNull();
  });
  it('passes through live score/status/period/clock when the caller has them', () => {
    const parts = nextGameParts({
      homeAway: 'away', opponent: 'Michigan', opponentRank: 8, when: null, network: null,
      status: 'in_progress', awayScore: 14, homeScore: 21, period: 3, clock: '8:42',
    });
    expect(parts).toMatchObject({ status: 'in_progress', awayScore: 14, homeScore: 21, period: 3, clock: '8:42' });
  });
});

describe('gameStatusBadge', () => {
  it('shows nothing for a scheduled game -- callers fall back to the kickoff time', () => {
    expect(gameStatusBadge('scheduled', null, null)).toEqual({ text: null, live: false, detail: null });
  });
  it('shows a live badge with the period/clock as detail, space-separated with no "remaining"', () => {
    expect(gameStatusBadge('in_progress', 3, '8:42')).toEqual({ text: 'LIVE', live: true, detail: 'Q3 8:42' });
  });
  it('shows a live badge with just the period when clock is unknown', () => {
    expect(gameStatusBadge('in_progress', 3, null)).toEqual({ text: 'LIVE', live: true, detail: 'Q3' });
  });
  it('treats "in_progress" with no period as not actually started yet, not a live badge with no detail', () => {
    expect(gameStatusBadge('in_progress', null, null)).toEqual({ text: null, live: false, detail: null });
  });
  it('treats "in_progress" with period 0 the same way -- confirmed live this is a real state ESPN reports right around kickoff, not a real quarter', () => {
    expect(gameStatusBadge('in_progress', 0, '0:00')).toEqual({ text: null, live: false, detail: null });
  });
  it('shows "Halftime" instead of "Q2 0:00" -- period stays 2 with the clock pinned at 0:00 for the whole intermission, not just an instant', () => {
    expect(gameStatusBadge('in_progress', 2, '0:00')).toEqual({ text: 'LIVE', live: true, detail: 'Halftime' });
  });
  it('does not relabel other quarters hitting 0:00 -- only the Q2/Q3 boundary is a named break', () => {
    expect(gameStatusBadge('in_progress', 1, '0:00')).toEqual({ text: 'LIVE', live: true, detail: 'Q1 0:00' });
    expect(gameStatusBadge('in_progress', 3, '0:00')).toEqual({ text: 'LIVE', live: true, detail: 'Q3 0:00' });
    expect(gameStatusBadge('in_progress', 4, '0:00')).toEqual({ text: 'LIVE', live: true, detail: 'Q4 0:00' });
  });
  it('shows a final badge with no detail (period/clock are moot once the game is over)', () => {
    expect(gameStatusBadge('final', 4, '0:00')).toEqual({ text: 'FINAL', live: false, detail: null });
  });
});

describe('leadingScoreLabel', () => {
  it('names the away team and puts their score first when away is ahead, with no "leads" verb', () => {
    expect(leadingScoreLabel({ status: 'in_progress', away: 'usc', awayScore: 13, home: 'rice', homeScore: 0 })).toBe('usc 13–0');
  });
  it('names the home team and puts THEIR score first when home is ahead, even though home is second in away-home order', () => {
    // Regression case: home leading 7-0 (away 0, home 7) must read "7-0" (leader-trailer), not a
    // naive away-then-home "0-7" that makes the leader look like it's losing.
    expect(leadingScoreLabel({ status: 'in_progress', away: 'san-jose-state', awayScore: 0, home: 'usc', homeScore: 7 })).toBe('usc 7–0');
  });
  it('prefers the resolved team object name over the bare id when available', () => {
    expect(leadingScoreLabel({
      status: 'in_progress', away: 'usc', awayScore: 13, awayTeam: { name: 'USC' },
      home: 'rice', homeScore: 0, homeTeam: { name: 'Rice' },
    })).toBe('USC 13–0');
  });
  it('reads exactly the same shape once the game is final -- no "wins" verb either', () => {
    expect(leadingScoreLabel({ status: 'final', away: 'usc', awayScore: 24, home: 'rice', homeScore: 17 })).toBe('usc 24–17');
  });
  it('omits the name on a tie', () => {
    expect(leadingScoreLabel({ status: 'in_progress', away: 'usc', awayScore: 7, home: 'rice', homeScore: 7 })).toBe('7–7');
  });
});

// confRaceInfo isn't unit-tested here -- like computeField (which it wraps), it reads module-level
// state derived from the real imported data/current.json at import time rather than taking data as
// an argument, so it can't be exercised against a hand-built fixture without a larger dependency-
// injection refactor this feature doesn't need. Covered instead by the manual/visual verification
// pass and the live pipeline runs (see the live-score and conference-tracker architecture plans).

describe('confSlugFor', () => {
  it('hyphenates on spaces, unlike confSlug (which strips them)', () => {
    expect(confSlugFor('Big Ten')).toBe('big-ten');
  });
  it('hyphenates on other non-alphanumeric runs too', () => {
    expect(confSlugFor('Big 12')).toBe('big-12');
  });
  it('matches the id format already baked into fieldStorylines ids (conf-race-big-ten)', () => {
    expect(`conf-race-${confSlugFor('Big Ten')}`).toBe('conf-race-big-ten');
  });
});

describe('confByRouteSlug', () => {
  it('round-trips every Power 4 conference through confSlugFor', () => {
    for (const conf of ['Big Ten', 'SEC', 'ACC', 'Big 12']) {
      expect(confByRouteSlug(confSlugFor(conf))).toBe(conf);
    }
  });
  it('returns null for an unknown or invalid slug', () => {
    expect(confByRouteSlug('mid-american')).toBeNull();
    expect(confByRouteSlug('not-a-real-conf')).toBeNull();
  });
});

describe('confRecord', () => {
  it('counts only games where the opponent shared the team\'s own conference', () => {
    const team = {
      conf: 'Big Ten',
      games: [
        { res: 'W', oppConf: 'Big Ten' },   // in-conference win
        { res: 'L', oppConf: 'Big Ten' },   // in-conference loss
        { res: 'W', oppConf: 'SEC' },       // out-of-conference, doesn't count
        { res: 'W', oppConf: null },        // FCS opponent (no conf on file), doesn't count
      ],
    };
    expect(confRecord(team)).toEqual({ wins: 1, losses: 1, record: '1-1' });
  });
  it('is realignment-safe -- compares against the team\'s CURRENT conf, not a stored relationship', () => {
    // A team that changed conferences mid-history: an old game tagged with the FORMER conf no
    // longer counts once team.conf reflects the new one, without needing to touch the game log.
    const team = { conf: 'Big Ten', games: [{ res: 'W', oppConf: 'Pac-12' }] };
    expect(confRecord(team)).toEqual({ wins: 0, losses: 0, record: '0-0' });
  });
  it('returns 0-0 for a team with no games yet', () => {
    expect(confRecord({ conf: 'SEC', games: [] })).toEqual({ wins: 0, losses: 0, record: '0-0' });
  });
});

describe('dirFor', () => {
  it('reports up for a positive delta', () => {
    expect(dirFor(3)).toBe('up');
  });
  it('reports down for a negative delta', () => {
    expect(dirFor(-2)).toBe('down');
  });
  it('reports flat for zero', () => {
    expect(dirFor(0)).toBe('flat');
  });
});

describe('trendColor', () => {
  it('is the good color for a positive delta', () => {
    expect(trendColor(1)).toBe('var(--good)');
  });
  it('is the critical color for a negative delta', () => {
    expect(trendColor(-1)).toBe('var(--critical)');
  });
  it('is the muted color for zero', () => {
    expect(trendColor(0)).toBe('var(--muted)');
  });
});

describe('deltaLabel', () => {
  it('renders an up arrow with the magnitude', () => {
    expect(deltaLabel(4)).toBe('▲4');
  });
  it('renders a down arrow with the magnitude', () => {
    expect(deltaLabel(-2)).toBe('▼2');
  });
  it('renders just the flat glyph with no trailing number', () => {
    expect(deltaLabel(0)).toBe(arrowGlyph(0));
    expect(deltaLabel(0)).toBe('–');
  });
});

describe('computerRatingNote', () => {
  it('says not yet available when the computer rank is missing', () => {
    expect(computerRatingNote(null, 5, 'AP Poll')).toBe('Not yet available');
  });
  it('says not yet available when the primary rank is missing (team unranked)', () => {
    expect(computerRatingNote(3, null, 'AP Poll')).toBe('Not yet available');
  });
  it('says the model likes them more when the computer rank is better (lower number)', () => {
    expect(computerRatingNote(2, 5, 'AP Poll')).toBe('Model likes them more');
  });
  it('says the model ranks them lower when the computer rank is worse (higher number)', () => {
    expect(computerRatingNote(9, 5, 'AP Poll')).toBe('Model ranks them lower');
  });
  it('says it matches the poll source when the ranks are equal', () => {
    expect(computerRatingNote(5, 5, 'AP Poll')).toBe('Matches AP Poll');
  });
});

describe('byRankAsc', () => {
  it('sorts ascending by the extracted rank', () => {
    const items = [{ rank: 3 }, { rank: 1 }, { rank: 2 }];
    expect(items.sort(byRankAsc((x) => x.rank)).map((x) => x.rank)).toEqual([1, 2, 3]);
  });
  it('sorts null ranks to the end instead of the front', () => {
    // Plain `a.rank - b.rank` would coerce null to 0 and put these at the FRONT -- this is
    // exactly the bug this helper exists to prevent (see teams.js's byRankAsc comment and the
    // git history: MyTeamsSection.jsx and ComparePanel.jsx both had this bug independently).
    const items = [{ rank: null }, { rank: 4 }, { rank: null }, { rank: 1 }];
    expect(items.sort(byRankAsc((x) => x.rank)).map((x) => x.rank)).toEqual([1, 4, null, null]);
  });
  it('supports a different field name via the extractor function', () => {
    const items = [{ cfpRank: 2 }, { cfpRank: null }, { cfpRank: 1 }];
    expect(items.sort(byRankAsc((x) => x.cfpRank)).map((x) => x.cfpRank)).toEqual([1, 2, null]);
  });
});

describe('trendOf', () => {
  it('reports up when the most recent value is a better (lower) rank than the one before it', () => {
    // Series is one entry per week; last two non-null values are what matters.
    expect(trendOf([10, 8, 5])).toEqual({ dir: 'up', diff: 3 });
  });
  it('reports down when the most recent value is worse', () => {
    expect(trendOf([5, 5, 9])).toEqual({ dir: 'down', diff: 4 });
  });
  it('reports flat when the last two non-null values are equal', () => {
    expect(trendOf([7, 7])).toEqual({ dir: 'flat', diff: 0 });
  });
  it('skips nulls to find the last two real values', () => {
    expect(trendOf([10, null, null, 6, null])).toEqual({ dir: 'up', diff: 4 });
  });
  it('falls back to flat/0 when there are fewer than two non-null values', () => {
    expect(trendOf([null, null, 3])).toEqual({ dir: 'flat', diff: 0 });
    expect(trendOf([])).toEqual({ dir: 'flat', diff: 0 });
  });
});

describe('formatKickoff', () => {
  it('returns null for a missing date', () => {
    expect(formatKickoff(null)).toBeNull();
    expect(formatKickoff(undefined)).toBeNull();
  });
  it('omits the month/day for a game within the next few days', () => {
    const soon = new Date(Date.now() + 2 * 86400000).toISOString();
    expect(formatKickoff(soon)).not.toMatch(/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/);
  });
  it('adds the month/day once the game is more than a week out', () => {
    const farOut = new Date(Date.now() + 10 * 86400000).toISOString();
    expect(formatKickoff(farOut)).toMatch(/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/);
  });
  it('adds the month/day for a game that already kicked off (daysOut < 0), by default', () => {
    const alreadyStarted = new Date(Date.now() - 2 * 86400000).toISOString();
    expect(formatKickoff(alreadyStarted)).toMatch(/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/);
  });
  it('alwaysThisWeek: true suppresses the month/day even for a far-future or already-started game', () => {
    const farOut = new Date(Date.now() + 10 * 86400000).toISOString();
    const alreadyStarted = new Date(Date.now() - 2 * 86400000).toISOString();
    expect(formatKickoff(farOut, true)).not.toMatch(/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/);
    expect(formatKickoff(alreadyStarted, true)).not.toMatch(/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/);
  });
  it('includes the weekday by default', () => {
    const soon = new Date(Date.now() + 2 * 86400000).toISOString();
    expect(formatKickoff(soon)).toMatch(/Mon|Tue|Wed|Thu|Fri|Sat|Sun/);
  });
  it('omitWeekday: true drops the weekday too, leaving just the time', () => {
    const soon = new Date(Date.now() + 2 * 86400000).toISOString();
    expect(formatKickoff(soon, true, true)).not.toMatch(/Mon|Tue|Wed|Thu|Fri|Sat|Sun/);
    expect(formatKickoff(soon, true, true)).toMatch(/^\d{1,2}:\d{2}\s*[AP]M$/);
  });
});

describe('isToday', () => {
  it('is false for a missing date', () => {
    expect(isToday(null)).toBe(false);
    expect(isToday(undefined)).toBe(false);
  });
  it('is true for a kickoff later today', () => {
    const laterToday = new Date();
    laterToday.setHours(23, 59, 0, 0);
    expect(isToday(laterToday.toISOString())).toBe(true);
  });
  it('is true for a kickoff earlier today, even though it is in the past', () => {
    const earlierToday = new Date();
    earlierToday.setHours(0, 1, 0, 0);
    expect(isToday(earlierToday.toISOString())).toBe(true);
  });
  it('is false for tomorrow', () => {
    const tomorrow = new Date(Date.now() + 25 * 3600000);
    expect(isToday(tomorrow.toISOString())).toBe(false);
  });
  it('is false for yesterday', () => {
    const yesterday = new Date(Date.now() - 25 * 3600000);
    expect(isToday(yesterday.toISOString())).toBe(false);
  });
});

describe('gameAlert', () => {
  // A live/final game between "Away U" and "Home U". Ranks null = unranked. Scores are away/home.
  const game = ({
    awayRank = null, homeRank = null, away = 0, home = 0, period = 4, status = 'in_progress',
    spread = null, awayName = 'Away U', homeName = 'Home U', clock = '5:00',
  } = {}) => ({
    status, period, clock, awayRank, homeRank,
    awayTeam: { name: awayName }, homeTeam: { name: homeName },
    awayScore: away, homeScore: home, spread,
  });

  // Replaces the old betting-line-only isPotentialUpset (2026-09-26): a game with a ranked team in it
  // now takes its underdog from the POLL, not the line -- #21 Florida (a 3.5-pt favorite) blowing out
  // #4 Ole Miss got no alert under the line rule. Games with no ranked team still use the line.
  describe('the four games that prompted the change (2026-09-26, Q4)', () => {
    it('#21 Florida 38-21 over #4 Ole Miss is an upset, even though the line made Florida the favorite', () => {
      const g = game({ awayRank: 4, homeRank: 21, away: 21, home: 38, awayName: 'Ole Miss', homeName: 'Florida', spread: 'Florida -3.5' });
      expect(gameAlert(g)).toBe('upset');
    });
    it('#18 Michigan 19-14 over #17 Iowa is only a tight game -- adjacent ranks, no underdog', () => {
      expect(gameAlert(game({ awayRank: 17, homeRank: 18, away: 14, home: 19, spread: 'Home U -5.5' }))).toBe('tight');
    });
    it('#15 Utah 24-17 over unranked Iowa State is only a tight game -- the higher-ranked team is winning', () => {
      expect(gameAlert(game({ awayRank: 15, homeRank: null, away: 24, home: 17, spread: 'Away U -7.5' }))).toBe('tight');
    });
    it('#2 Georgia 41-6 over unranked Oklahoma gets nothing', () => {
      expect(gameAlert(game({ awayRank: null, homeRank: 2, away: 6, home: 41, spread: 'Home U -13.5' }))).toBeNull();
    });
  });

  describe('who the underdog is when a ranked team is playing (the poll decides, the line is ignored)', () => {
    it('an unranked team ahead of a ranked one is an upset', () => {
      expect(gameAlert(game({ awayRank: null, homeRank: 10, away: 17, home: 14, period: 3 }))).toBe('upset');
    });
    it('the lower-ranked team is the underdog when both are ranked, from a 2-spot gap up', () => {
      expect(gameAlert(game({ awayRank: 10, homeRank: 12, away: 14, home: 17, period: 3 }))).toBe('upset'); // gap 2
      expect(gameAlert(game({ awayRank: 10, homeRank: 11, away: 14, home: 17, period: 3 }))).toBeNull();     // gap 1: no underdog
    });
    it('ignores the line, even when the line makes the higher-ranked team the underdog', () => {
      // #5 is +7 on the line against an unranked team but is still the higher-ranked side, so its lead is no upset
      expect(gameAlert(game({ awayRank: 5, homeRank: null, away: 24, home: 17, period: 3, spread: 'Home U -7' }))).toBeNull();
    });
    it('does not fall back to the line for adjacent ranks -- there is simply no underdog', () => {
      // line makes #17 the favorite, #18 leads by 12 in Q4: neither an upset nor tight
      expect(gameAlert(game({ awayRank: 17, homeRank: 18, away: 10, home: 22, spread: 'Away U -3' }))).toBeNull();
    });
  });

  describe('a game with no ranked team uses the betting line', () => {
    it('ignores a tiny underdog (3 points or fewer) leading in Q3, but not 3.5 or more', () => {
      expect(gameAlert(game({ away: 17, home: 14, period: 3, spread: 'Home U -3' }))).toBeNull();
      expect(gameAlert(game({ away: 17, home: 14, period: 3, spread: 'Home U -3.5' }))).toBe('upset');
    });
    it('cannot judge a line with no number in Q3, so it does not flag on a guess', () => {
      expect(gameAlert(game({ away: 17, home: 14, period: 3, spread: 'Home U' }))).toBeNull();
    });
    it('still flags a tiny underdog in Q4/OT and once final', () => {
      expect(gameAlert(game({ away: 17, home: 14, spread: 'Home U -3' }))).toBe('upset');
      expect(gameAlert(game({ away: 24, home: 21, status: 'final', spread: 'Home U -2.5' }))).toBe('upset');
    });
    it('has no underdog at all without a line -- never an upset, though it can still be tight', () => {
      expect(gameAlert(game({ away: 30, home: 10 }))).toBeNull();
      expect(gameAlert(game({ away: 20, home: 17 }))).toBe('tight');
    });
  });

  describe('timing', () => {
    it('never alerts in the first half, however big the lead -- including at halftime itself', () => {
      expect(gameAlert(game({ awayRank: null, homeRank: 4, away: 21, home: 0, period: 1 }))).toBeNull();
      expect(gameAlert(game({ awayRank: null, homeRank: 4, away: 24, home: 3, period: 2, clock: '5:00' }))).toBeNull();
      expect(gameAlert(game({ awayRank: null, homeRank: 4, away: 24, home: 3, period: 2, clock: '0:00' }))).toBeNull();
    });
    it('Q3: the underdog tied or ahead is an upset; a close game is NOT tight yet', () => {
      expect(gameAlert(game({ awayRank: null, homeRank: 4, away: 14, home: 14, period: 3 }))).toBe('upset');
      expect(gameAlert(game({ awayRank: null, homeRank: 4, away: 10, home: 14, period: 3 }))).toBeNull();
    });
    it('Q4/OT: the underdog tied or ahead by any amount is an upset', () => {
      expect(gameAlert(game({ awayRank: null, homeRank: 4, away: 35, home: 14 }))).toBe('upset');
      expect(gameAlert(game({ awayRank: null, homeRank: 4, away: 14, home: 14 }))).toBe('upset');
    });
    it('Q4/OT: any game within 7 that is not an upset is tight -- 8 is not', () => {
      expect(gameAlert(game({ awayRank: null, homeRank: 4, away: 10, home: 17 }))).toBe('tight'); // fav up 7
      expect(gameAlert(game({ awayRank: null, homeRank: 4, away: 10, home: 18 }))).toBeNull();    // fav up 8
      expect(gameAlert(game({ away: 20, home: 24 }))).toBe('tight');                              // no ranks, no line
    });
    it('treats overtime like Q4', () => {
      expect(gameAlert(game({ awayRank: null, homeRank: 4, away: 27, home: 24, period: 5 }))).toBe('upset');
      expect(gameAlert(game({ awayRank: null, homeRank: 4, away: 24, home: 27, period: 6 }))).toBe('tight');
    });
    it('upset outranks tight: an underdog leading by 3 in Q4 is an upset, not just a close game', () => {
      expect(gameAlert(game({ awayRank: null, homeRank: 4, away: 17, home: 14 }))).toBe('upset');
    });
  });

  describe('once final', () => {
    it('the underdog winning is an upset (poll-based and line-based)', () => {
      expect(gameAlert(game({ awayRank: 4, homeRank: 21, away: 21, home: 38, status: 'final' }))).toBe('upset');
      expect(gameAlert(game({ away: 10, home: 7, status: 'final', spread: 'Home U -14' }))).toBe('upset');
    });
    it('a favorite winning gets nothing -- tight games stop being tight once they end', () => {
      expect(gameAlert(game({ awayRank: null, homeRank: 4, away: 20, home: 21, status: 'final' }))).toBeNull();
      expect(gameAlert(game({ awayRank: 17, homeRank: 18, away: 20, home: 21, status: 'final' }))).toBeNull();
      expect(gameAlert(game({ away: 20, home: 21, status: 'final' }))).toBeNull();
    });
  });

  it('never alerts before kickoff, without scores, or with a "live" game that has no period yet', () => {
    expect(gameAlert(game({ awayRank: null, homeRank: 4, away: null, home: null, status: 'scheduled', period: null }))).toBeNull();
    expect(gameAlert(game({ awayRank: null, homeRank: 4, away: 7, home: 0, period: null }))).toBeNull();
    expect(gameAlert(game({ awayRank: null, homeRank: 4, away: 7, home: 0, period: 0 }))).toBeNull();
  });
});

describe('periodLabel', () => {
  it('labels regulation periods as Q1-Q4', () => {
    expect(periodLabel(1)).toBe('Q1');
    expect(periodLabel(4)).toBe('Q4');
  });
  it('labels overtime periods as OT, 2OT, 3OT... instead of Q5, Q6, Q7', () => {
    expect(periodLabel(5)).toBe('OT');
    expect(periodLabel(6)).toBe('2OT');
    expect(periodLabel(7)).toBe('3OT');
  });
  it('returns null for an unknown period', () => {
    expect(periodLabel(null)).toBeNull();
  });
  it('returns null for period 0 -- not a real quarter', () => {
    expect(periodLabel(0)).toBeNull();
  });
});
