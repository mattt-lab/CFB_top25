// Unit tests for the pure helper functions in teams.js -- the shared logic several components
// were duplicating with slightly different inline ternaries before being consolidated here
// (see the "Rank-delta helpers" comment block in teams.js for the convention they all share).
import { describe, it, expect } from 'vitest';
import {
  arrowGlyph, dirFor, trendColor, deltaLabel, computerRatingNote, byRankAsc, trendOf, formatKickoff,
  americanOdds, nextGameParts, gameStatusBadge, leadingScoreLabel, confSlugFor, confByRouteSlug, confRecord,
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
  it('shows a live badge with the period/clock as detail', () => {
    expect(gameStatusBadge('in_progress', 3, '8:42')).toEqual({ text: 'LIVE', live: true, detail: 'Q3 · 8:42' });
  });
  it('shows a live badge with no detail when period is unknown', () => {
    expect(gameStatusBadge('in_progress', null, null)).toEqual({ text: 'LIVE', live: true, detail: null });
  });
  it('shows a final badge with no detail (period/clock are moot once the game is over)', () => {
    expect(gameStatusBadge('final', 4, '0:00')).toEqual({ text: 'FINAL', live: false, detail: null });
  });
});

describe('leadingScoreLabel', () => {
  it('prefixes the away team when away is ahead', () => {
    expect(leadingScoreLabel({ away: 'usc', awayScore: 13, home: 'rice', homeScore: 0 })).toBe('usc 13–0');
  });
  it('prefixes the home team when home is ahead', () => {
    expect(leadingScoreLabel({ away: 'rice', awayScore: 0, home: 'usc', homeScore: 13 })).toBe('usc 0–13');
  });
  it('prefers the resolved team object name over the bare id when available', () => {
    expect(leadingScoreLabel({
      away: 'usc', awayScore: 13, awayTeam: { name: 'USC' },
      home: 'rice', homeScore: 0, homeTeam: { name: 'Rice' },
    })).toBe('USC 13–0');
  });
  it('omits the name prefix on a tie', () => {
    expect(leadingScoreLabel({ away: 'usc', awayScore: 7, home: 'rice', homeScore: 7 })).toBe('7–7');
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
});
