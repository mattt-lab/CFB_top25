// Unit tests for the pure helper functions in teams.js -- the shared logic several components
// were duplicating with slightly different inline ternaries before being consolidated here
// (see the "Rank-delta helpers" comment block in teams.js for the convention they all share).
import { describe, it, expect } from 'vitest';
import {
  arrowGlyph, dirFor, trendColor, deltaLabel, computerRatingNote, byRankAsc, trendOf, formatKickoff,
} from './teams.js';

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
