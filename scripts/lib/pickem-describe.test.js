import { describe, it, expect } from 'vitest';
import { PARAMS_V1 } from './pickem-model-params.mjs';
import { tier, surpriseBin, teamWeekRows, meanBy } from './pickem-describe.mjs';

describe('tier', () => {
  it('groups poll ranks in fives', () => {
    expect([1, 5, 6, 10, 11, 20, 21, 25].map(tier)).toEqual(['1-5', '1-5', '6-10', '6-10', '11-15', '16-20', '21-25', '21-25']);
  });
});

describe('surpriseBin', () => {
  it('bins how far a result beat (+) or missed (-) the line, touchdown-wide', () => {
    expect([-21, -14, -13.5, -7, -6.5, 0, 6.5, 7, 13.5, 14, 30].map(surpriseBin)).toEqual([
      '<= -14', '<= -14', '-14 to -7', '-14 to -7', '-7 to 0', '0 to 7', '0 to 7', '7 to 14', '7 to 14', '>= 14', '>= 14',
    ]);
    expect(surpriseBin(null)).toBeNull();
  });
});

describe('teamWeekRows', () => {
  const record = {
    season: 2025, week: 5,
    currentOrder: ['a', 'b', 'c'],
    actualOrder: ['b', 'a'],
    teams: [
      { id: 'a', name: 'A', outcome: 'win', inputs: { sp: null, fpi: null, elo: null, qualityWins: 0, oppPollRank: null, oppSpRank: 50 }, game: { opponent: 'x', margin: 3, surprise: -10 } },
      { id: 'b', name: 'B', outcome: 'blowoutWin', inputs: { sp: null, fpi: null, elo: null, qualityWins: 0, oppPollRank: null, oppSpRank: 50 }, game: { opponent: 'y', margin: 30, surprise: 12 } },
      { id: 'c', name: 'C', outcome: 'loss', inputs: { sp: null, fpi: null, elo: null, qualityWins: 0, oppPollRank: null, oppSpRank: 50 }, game: { opponent: 'z', margin: -7, surprise: -14 } },
    ],
  };
  const rows = teamWeekRows([record], { V1: PARAMS_V1 });

  it('scores an exit as falling to #26', () => {
    expect(rows.find((r) => r.id === 'c')).toMatchObject({ exited: true, actualRank: null, actualMove: -23, oppRanked: false });
  });

  it('carries each model projection and the real move', () => {
    // V1 drifts: a +0.92 (win, weak opponent), b +1.38 (blowout, weak opponent) -> keys 0.08 vs
    // 0.63, so a stays ahead and b projects to hold #2.
    expect(rows.find((r) => r.id === 'b')).toMatchObject({ actualRank: 1, actualMove: 1, proj: { V1: 2 }, projMove: { V1: 0 } });
  });
});

describe('meanBy', () => {
  it('averages chosen fields within each group, in first-seen order', () => {
    const rows = [{ g: 'x', v: 1 }, { g: 'y', v: 5 }, { g: 'x', v: 3 }];
    expect(meanBy(rows, (r) => r.g, { v: (r) => r.v })).toEqual([{ key: 'x', n: 2, v: 2 }, { key: 'y', n: 1, v: 5 }]);
  });
});
