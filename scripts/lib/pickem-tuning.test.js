import { describe, it, expect } from 'vitest';
import { PARAMS_V1 } from './pickem-model-params.mjs';
import { replayWeek } from './pickem-backtest.mjs';
import {
  mulberry32, errorMatrix, fitIndex, crossValidate, stability, oneSeChoice, carryOver, notOneTeam,
  testCandidate, forwardSelect,
} from './pickem-tuning.mjs';

const PENALTY = { setting: 'unrankedLossPenalty', noChange: 0, grid: [0, 2, 4, 6, 8, 10, 12] };
const SCALE = { setting: 'driftScale', noChange: 1, grid: [1, 1.25, 1.5, 2, 2.5, 3] };
const SURPRISE = { setting: 'surpriseK', noChange: 0, grid: [0, 0.05, 0.1, 0.15, 0.2, 0.3, 0.4] };
const FAST = { draws: 2000, seed: 7 };

const IDS = Array.from({ length: 12 }, (_, i) => `t${String(i + 1).padStart(2, '0')}`);

// A synthetic week whose "real" next poll is produced by a known voter model (`truth`), so a
// setting's right answer is known in advance. `loser` pins every loss on one team.
function makeWeek(rand, week, truth, { loser = null } = {}) {
  const currentOrder = [...IDS].sort(() => rand() - 0.5);
  const teams = currentOrder.map((id) => {
    const loses = loser ? id === loser : rand() < 0.25;
    const outcome = loses ? (rand() < 0.5 ? 'loss' : 'blowoutLoss') : (rand() < 0.5 ? 'win' : 'blowoutWin');
    const margin = loses ? -1 - Math.floor(rand() * 20) : 1 + Math.floor(rand() * 30);
    return {
      id, outcome,
      inputs: { sp: null, fpi: null, elo: null, qualityWins: 0, oppPollRank: null, oppSpRank: 20 + Math.floor(rand() * 80) },
      game: { opponent: `opp-${id}`, margin, expectedMargin: Math.floor(rand() * 30) - 5 + 0.5 },
    };
  });
  const record = { season: 2025, week, currentOrder, teams };
  return { ...record, actualOrder: replayWeek(record, truth) };
}

function season(seed, truthFor, opts = {}) {
  const rand = mulberry32(seed);
  return Array.from({ length: 14 }, (_, i) => makeWeek(rand, i + 1, truthFor(i + 1), opts));
}

const withPenalty = (p) => ({ ...PARAMS_V1, unrankedLossPenalty: p });
const PENALTY_SEASON = season(11, () => withPenalty(6));
const V1_SEASON = season(12, () => PARAMS_V1);

describe('errorMatrix / fitIndex', () => {
  it('recovers a penalty that explains the synthetic season perfectly', () => {
    const M = errorMatrix(PENALTY_SEASON, PARAMS_V1, PENALTY);
    const idx = fitIndex(M, PENALTY_SEASON.map(() => true));
    expect(M[idx].reduce((a, b) => a + b.e, 0)).toBe(0);
    expect(PENALTY.grid[idx]).toBeGreaterThan(0);
  });

  it('breaks ties toward the no-change value', () => {
    const M = [[{ e: 1 }, { e: 1 }], [{ e: 1 }, { e: 1 }]];
    expect(fitIndex(M, [true, true])).toBe(0);
  });
});

describe('crossValidate (R1)', () => {
  it('passes a real effect, with the 5th bootstrap percentile above zero', () => {
    const cv = crossValidate(errorMatrix(PENALTY_SEASON, PARAMS_V1, PENALTY), FAST);
    expect(cv.sumDelta).toBeGreaterThan(0);
    expect(cv.ci5).toBeGreaterThan(0);
    expect(cv.pass).toBe(true);
  });

  it('fails when the setting has nothing to explain', () => {
    const cv = crossValidate(errorMatrix(V1_SEASON, PARAMS_V1, PENALTY), FAST);
    expect(cv.sumDelta).toBeLessThanOrEqual(0);
    expect(cv.pass).toBe(false);
  });
});

describe('stability (R2)', () => {
  it('passes when early and late halves agree', () => {
    const s = stability(PENALTY_SEASON, errorMatrix(PENALTY_SEASON, PARAMS_V1, PENALTY), PENALTY);
    expect(s.pass).toBe(true);
  });

  it('fails when the effect disappears in the second half of the season', () => {
    const split = season(13, (w) => (w <= 8 ? withPenalty(6) : PARAMS_V1));
    const s = stability(split, errorMatrix(split, PARAMS_V1, PENALTY), PENALTY);
    expect(s.late).toBe(0);
    expect(s.pass).toBe(false);
  });
});

describe('oneSeChoice (R5)', () => {
  it('backs off to the value nearest no-change that is within one standard error of the best', () => {
    const M = [
      [{ e: 9 }, { e: 9 }, { e: 9 }],
      [{ e: 2 }, { e: 1 }, { e: 2 }],
      [{ e: 1 }, { e: 2 }, { e: 1 }],
    ];
    const r = oneSeChoice(M, FAST);
    expect(r.bestIndex).toBe(2);
    expect(r.index).toBe(1);
  });
});

describe('carryOver (R3)', () => {
  it('fails a value that makes the check season worse', () => {
    const r = carryOver(V1_SEASON, PARAMS_V1, PENALTY, 6);
    expect(r.eCand).toBeGreaterThan(r.eBase);
    expect(r.pass).toBe(false);
  });

  it('passes a value that helps the check season', () => {
    expect(carryOver(season(14, () => withPenalty(6)), PARAMS_V1, PENALTY, 6).pass).toBe(true);
  });
});

describe('notOneTeam (R4)', () => {
  it('fails when every bit of the gain runs through a single team', () => {
    const one = season(15, () => withPenalty(6), { loser: 't03' });
    const r = notOneTeam(one, PARAMS_V1, PENALTY, 6);
    expect(r.worstTeam).toBe('t03');
    expect(r.pass).toBe(false);
  });

  it('passes when the gain is spread across teams', () => {
    expect(notOneTeam(PENALTY_SEASON, PARAMS_V1, PENALTY, 6).pass).toBe(true);
  });
});

describe('forwardSelect', () => {
  it('keeps the setting that generated the data and stops when nothing else helps', () => {
    const r = forwardSelect(PENALTY_SEASON, season(16, () => withPenalty(6)), PARAMS_V1, [SCALE, PENALTY, SURPRISE], FAST);
    expect(r.selected.map((s) => s.setting)).toEqual(['unrankedLossPenalty']);
    expect(r.params.unrankedLossPenalty).toBeGreaterThan(0);
    expect(r.rounds[0].results).toHaveLength(3);
  });

  it('keeps nothing when the data came from the current model', () => {
    const r = forwardSelect(V1_SEASON, season(17, () => PARAMS_V1), PARAMS_V1, [SCALE, PENALTY, SURPRISE], FAST);
    expect(r.selected).toEqual([]);
    expect(r.params).toEqual(PARAMS_V1);
  });
});

describe('testCandidate', () => {
  it('reports every rule and passes only when all pass', () => {
    const t = testCandidate(PENALTY_SEASON, season(18, () => withPenalty(6)), PARAMS_V1, PENALTY, FAST);
    expect(Object.keys(t.rules).sort()).toEqual(['R1', 'R2', 'R3', 'R4']);
    expect(t.pass).toBe(Object.values(t.rules).every((r) => r.pass));
    expect(t.pass).toBe(true);
  });
});
