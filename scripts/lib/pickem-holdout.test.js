import { describe, it, expect } from 'vitest';
import { PARAMS_V1 } from './pickem-model-params.mjs';
import { compareOnHoldout, runChain } from './pickem-holdout.mjs';
import { syntheticSeason } from './pickem-synthetic.fixture.mjs';

const FAST = { draws: 2000, seed: 7 };
const LS = { ...PARAMS_V1, lossScale: 2.5 };
const P4 = { ...PARAMS_V1, unrankedLossPenalty: 4 };
const SPEC = {
  models: {
    P4: { unrankedLossPenalty: 4 },
    LS: { lossScale: 2.5 },
    LSW: { lossScale: 2.5, earlyWinScale: 1.25, earlyThroughWeek: 8 },
  },
  chain: [
    { step: 1, candidate: 'P4' },
    { step: 2, candidate: 'LS' },
    { step: 3, candidate: 'LSW', onlyIfCurrent: ['LS'] },
    { step: 4, label: 'penalty 4', adds: { unrankedLossPenalty: 4 }, onlyIfCurrent: ['LS', 'LSW'] },
  ],
};

describe('compareOnHoldout', () => {
  it('passes a candidate that generated the held-out season', () => {
    const r = compareOnHoldout(syntheticSeason(21, () => LS), PARAMS_V1, LS, FAST);
    expect(r.delta).toBeGreaterThan(0);
    expect(r.ci5).toBeGreaterThan(0);
    expect(r.pass).toBe(true);
  });

  it('fails a candidate when the held-out season came from the current model', () => {
    const r = compareOnHoldout(syntheticSeason(22, () => PARAMS_V1), PARAMS_V1, LS, FAST);
    expect(r.delta).toBeLessThan(0);
    expect(r.pass).toBe(false);
  });

  it('fails when one half of the season gets worse, whatever the total', () => {
    const r = compareOnHoldout(syntheticSeason(23, (w) => (w <= 8 ? LS : PARAMS_V1)), PARAMS_V1, LS, FAST);
    expect(r.early).toBeGreaterThan(0);
    expect(r.late).toBeLessThan(0);
    expect(r.pass).toBe(false);
  });
});

describe('runChain', () => {
  it('ends on the model that generated the data and stops adding once nothing helps', () => {
    const r = runChain(syntheticSeason(24, () => LS), syntheticSeason(25, () => LS), SPEC, FAST);
    expect(r.final.name).toBe('LS');
    expect(r.steps.slice(1).map((s) => s.pass)).toEqual([true, false, false]);
    expect(r.guard.steppedBack).toBe(false);
  });

  it('skips steps that only apply on top of a model that was not adopted', () => {
    const r = runChain(syntheticSeason(26, () => P4), syntheticSeason(27, () => P4), SPEC, FAST);
    expect(r.final.name).toBe('P4');
    expect(r.steps.map((s) => (s.skipped ? 'skipped' : s.pass))).toEqual([true, false, 'skipped', 'skipped']);
  });

  it('steps back to a model that does not make the check season worse than V1', () => {
    const r = runChain(syntheticSeason(28, () => LS), syntheticSeason(29, () => PARAMS_V1), SPEC, FAST);
    expect(r.final.name).toBe('V1');
    expect(r.guard.steppedBack).toBe(true);
  });
});
