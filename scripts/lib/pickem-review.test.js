import { describe, it, expect } from 'vitest';
import { pearson, slope, spearman, reviewSnapshot, renderReport } from './pickem-review.mjs';

describe('stats helpers', () => {
  it('pearson: perfect, inverse, and undefined cases', () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1);
    expect(pearson([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1);
    expect(pearson([1, 1, 1], [1, 2, 3])).toBeNull();   // no variance
    expect(pearson([1, 2], [1, 2])).toBeNull();          // too few points to mean anything
  });

  it('slope is units of y per unit of x', () => {
    expect(slope([0, 1, 2, 3], [1, 3, 5, 7])).toBeCloseTo(2);
    expect(slope([2, 2, 2], [1, 2, 3])).toBeNull();
  });

  it('spearman: identical order is 1, reversed is -1', () => {
    expect(spearman(['a', 'b', 'c', 'd'], ['a', 'b', 'c', 'd'])).toBeCloseTo(1);
    expect(spearman(['a', 'b', 'c', 'd'], ['d', 'c', 'b', 'a'])).toBeCloseTo(-1);
  });
});

// Five ranked teams a..e; the model projects e to jump to #1 and a to fall; the real poll
// instead drops c out entirely and brings in an unranked team "n".
const team = (id, currentRank, projectedRank, game) => ({
  id, name: id.toUpperCase(), currentRank, projectedRank, move: currentRank - projectedRank, game,
});
const played = (margin, expectedMargin) => ({
  status: 'final', margin, expectedMargin, surprise: margin - expectedMargin,
  wasFavorite: expectedMargin > 0, upsetWin: margin > 0 && expectedMargin < 0, upsetLoss: margin < 0 && expectedMargin > 0,
  opponent: 'x', opponentRank: null, spread: 'x', score: { mine: 20 + Math.max(margin, 0), theirs: 20 + Math.max(-margin, 0) },
});
const SNAP = {
  season: 2026, week: 3, pollSource: 'ap', generatedAt: '2026-09-20T05:00:00Z',
  currentOrder: ['a', 'b', 'c', 'd', 'e'],
  projectedOrder: ['e', 'b', 'd', 'a', 'c'],
  teams: [
    team('a', 1, 4, played(-3, 14)),   // favored by 14, lost by 3 -> surprise -17
    team('b', 2, 2, played(10, 10)),   // exactly on the number
    team('c', 3, 5, played(-20, 7)),   // will drop out of the real poll
    team('d', 4, 3, played(21, 3)),    // crushed the line
    team('e', 5, 1, played(30, 3)),    // crushed it
  ],
  games: [{
    id: 'gn', away: 'n', home: 'q', awayRank: null, homeRank: null, status: 'final',
    awayScore: 40, homeScore: 10, homeMargin: -30, spread: 'Q -3', expectedHomeMargin: 3,
  }],
};
// Real poll: e, b, d, n (new), a. c fell out.
const ACTUAL = ['e', 'b', 'd', 'n', 'a'];

describe('reviewSnapshot', () => {
  const r = reviewSnapshot(SNAP, ACTUAL);
  const row = (id) => r.rows.find((x) => x.id === id);

  it('computes actual ranks and moves, and treats an exit as out rather than an error', () => {
    expect(row('e')).toMatchObject({ actualRank: 1, actualMove: 4, projectedMove: 4, rankError: 0 });
    expect(row('a')).toMatchObject({ actualRank: 5, actualMove: -4, projectedRank: 4, rankError: -1 });
    expect(row('c')).toMatchObject({ actualRank: null, actualMove: null, rankError: null });
    expect(r.dropped.map((d) => d.id)).toEqual(['c']);
    expect(r.entered.map((e) => e.id)).toEqual(['n']);
  });

  it('scores the model against the do-nothing baseline on teams in both polls', () => {
    // model errors: e0 b0 d0 a1 -> mean 0.25; baseline (current vs actual): e4 b0 d1 a4 -> mean 2.25
    expect(r.accuracy.teamsInBothPolls).toBe(4);
    expect(r.accuracy.maeModel).toBe(0.25);
    expect(r.accuracy.maeBaselineNoChange).toBe(2.25);
    expect(r.accuracy.exact).toBe(3);
    expect(r.accuracy.within1).toBe(4);
    expect(r.accuracy.baselineExact).toBe(1);
  });

  it('checks direction of the projected move against the real one', () => {
    // a: proj down, real down; e: up/up; d: up/up; b: same/same (excluded); c: out (excluded)
    expect(r.accuracy.directionTotal).toBe(3);
    expect(r.accuracy.directionCorrect).toBe(3);
  });

  it('summarises how the ranked teams did against the line', () => {
    // covered = surprise > 0: only d (+18) and e (+27); b landed exactly on the number (a push, not a cover)
    expect(r.lineLens).toMatchObject({ gamesWithLine: 5, favoritesTotal: 5, favoritesWon: 3, coveredSpread: 2 });
    expect(r.lineLens.upsetLosses).toEqual(['a', 'c']);
  });

  it('relates the poll move to beating the line, and finds voters disagreeing with it', () => {
    expect(r.correlations.n).toBe(4);
    expect(r.correlations.surpriseVsActualMove).toBeGreaterThan(0.9);
    // b is exactly on the number (surprise 0) so it is not a "voter surprise"; a missed by 17 and fell (agrees)
    expect(r.voterSurprises).toEqual([]);
  });

  it('flags a team that beat the line by a lot but did not rise', () => {
    const snap = { ...SNAP, teams: SNAP.teams.map((t) => (t.id === 'b' ? team('b', 2, 2, played(20, 3)) : t)) };
    const out = reviewSnapshot(snap, ACTUAL); // b beat the line by 17 but held at #2
    expect(out.voterSurprises.map((v) => v.id)).toEqual(['b']);
  });

  it('lists only teams that were actually off in "biggest misses", worst first -- not padded with exact hits', () => {
    expect(r.biggestMisses.map((m) => m.id)).toEqual(['a']); // only a (proj #4, actual #5) missed
    const perfect = reviewSnapshot(SNAP, SNAP.projectedOrder);
    expect(perfect.biggestMisses).toEqual([]);
    expect(renderReport(perfect)).toContain('Biggest misses: none');
  });

  it("gives an unranked entrant's own result against its line", () => {
    expect(r.entered[0]).toMatchObject({ id: 'n', margin: 30, expectedMargin: -3, surprise: 33 });
  });
});

describe('renderReport', () => {
  it('produces the markdown sections a reader needs', () => {
    const md = renderReport(reviewSnapshot(SNAP, ACTUAL), (id) => id.toUpperCase());
    expect(md).toContain("# Week 3 Pick 'em review -- AP poll");
    expect(md).toContain('## 1. Did the projected poll match the real one?');
    expect(md).toContain('## 2. Against the betting line');
    expect(md).toContain('| Mean abs rank error | 0.25 | 2.25 |');
    expect(md).toContain('Dropped out of the poll');
  });
});
