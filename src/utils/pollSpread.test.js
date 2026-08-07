// Unit tests for pollSpread -- the pure [min, max] helper behind RankingChart's shaded
// poll-spread band. The fixture mirrors the real teams[id] shape from docs/data-schema.md:
// one entry per week in each of ap/coaches/cfp, null where that poll didn't rank the team
// (including the always-null pre-committee cfp weeks).
import { describe, it, expect } from 'vitest';
import { pollSpread } from './pollSpread.js';

// 4-week team: wk1 all three polls disagree; wk2 Coaches-only (single poll); wk3 unranked
// everywhere; wk4 AP/Coaches agree pre-committee (cfp still null).
const team = {
  ap:      [3,    null, null, 12],
  coaches: [5,    8,    null, 12],
  cfp:     [2,    null, null, null],
};

describe('pollSpread', () => {
  it('spans min to max across all three polls when they disagree', () => {
    expect(pollSpread(team, 0)).toEqual([2, 5]);
  });
  it('collapses to a zero-height [r, r] band when only one poll ranks the team', () => {
    expect(pollSpread(team, 1)).toEqual([8, 8]);
  });
  it('returns null (band break) for a week the team is unranked in every poll', () => {
    expect(pollSpread(team, 2)).toBeNull();
  });
  it('handles pre-committee null cfp: spreads over just AP/Coaches', () => {
    // Identical AP/Coaches ranks + null cfp -> zero-height band, not [12, null] garbage.
    expect(pollSpread(team, 3)).toEqual([12, 12]);
  });
});
