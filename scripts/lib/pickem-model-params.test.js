import { describe, it, expect } from 'vitest';
import { projectOrder } from '../../src/utils/projectTop25.js';
import { PARAMS_V1, PARAMS_LIVE, driftWith, projectOrderWith } from './pickem-model-params.mjs';

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const OUTCOMES = ['blowoutWin', 'win', 'loss', 'blowoutLoss'];
const WIN = { blowoutWin: true, win: true };

function randomScenario(rand) {
  const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
  const maybe = (p, v) => (rand() < p ? null : v);
  const order = Array.from({ length: 25 }, (_, i) => `t${String(i + 1).padStart(2, '0')}`);
  const teams = {};
  const picks = {};
  const info = {};
  const lines = {};
  for (const id of order) {
    const quality = int(0, 4);
    teams[id] = {
      sp: maybe(0.2, int(1, 130)), fpi: maybe(0.2, int(1, 130)), elo: maybe(0.2, int(1, 130)),
      games: [...Array(quality).fill({ tag: 'quality' }), ...Array(int(0, 3)).fill({ tag: '' })],
    };
    if (rand() < 0.1) continue;
    picks[id] = OUTCOMES[int(0, 3)];
    info[id] = rand() < 0.05 ? null : { oppPollRank: maybe(0.6, int(1, 25)), oppSpRank: maybe(0.2, int(1, 130)) };
    const margin = WIN[picks[id]] ? int(1, 50) : -int(1, 50);
    lines[id] = rand() < 0.1 ? null : { margin, expectedMargin: int(-30, 45) + 0.5 };
  }
  const h2h = {};
  const shuffled = [...order].sort(() => rand() - 0.5);
  for (let i = 0; i + 1 < 8; i += 2) {
    const [x, y] = [shuffled[i], shuffled[i + 1]];
    h2h[x] = y;
    h2h[y] = x;
    if (rand() < 0.8) {
      picks[x] = OUTCOMES[int(0, 3)];
      picks[y] = { blowoutWin: 'blowoutLoss', win: 'loss', loss: 'win', blowoutLoss: 'blowoutWin' }[picks[x]];
    }
  }
  return { order, teams, picks, info, lines, h2h };
}

describe('projectOrderWith at PARAMS_LIVE', () => {
  it('reproduces production projectOrder exactly on 2000 random 25-team weeks', () => {
    const rand = mulberry32(20260923);
    for (let n = 0; n < 2000; n++) {
      const s = randomScenario(rand);
      const opts = { getOpponentInfo: (id) => s.info[id] ?? null, h2h: s.h2h };
      const prod = projectOrder(s.order, s.picks, s.teams, opts);
      const mine = projectOrderWith(PARAMS_LIVE, s.order, s.picks, s.teams, {
        ...opts, getLineInfo: (id) => s.lines[id] ?? null,
      });
      expect(mine).toEqual(prod);
    }
  });

  it('does not mutate the input order', () => {
    const order = ['a', 'b', 'c'];
    projectOrderWith(PARAMS_V1, order, { c: 'blowoutWin' }, {});
    expect(order).toEqual(['a', 'b', 'c']);
  });
});

describe('driftWith candidate settings', () => {
  const unrankedOpp = { oppPollRank: null, oppSpRank: 40 };
  const rankedOpp = { oppPollRank: 10, oppSpRank: 12 };
  const plainTeam = { sp: null, fpi: null, elo: null, games: [] };

  it('driftScale multiplies the whole V1 drift', () => {
    const v1 = driftWith(PARAMS_V1, 'loss', 5, plainTeam, unrankedOpp, null);
    const scaled = driftWith({ ...PARAMS_V1, driftScale: 2 }, 'loss', 5, plainTeam, unrankedOpp, null);
    expect(scaled).toBeCloseTo(2 * v1, 10);
  });

  it('unrankedLossPenalty only hits losses to teams outside the poll', () => {
    const P = { ...PARAMS_V1, unrankedLossPenalty: 6 };
    expect(driftWith(P, 'loss', 5, plainTeam, unrankedOpp, null))
      .toBeCloseTo(driftWith(PARAMS_V1, 'loss', 5, plainTeam, unrankedOpp, null) - 6, 10);
    expect(driftWith(P, 'loss', 5, plainTeam, rankedOpp, null))
      .toBe(driftWith(PARAMS_V1, 'loss', 5, plainTeam, rankedOpp, null));
    expect(driftWith(P, 'win', 5, plainTeam, unrankedOpp, null))
      .toBe(driftWith(PARAMS_V1, 'win', 5, plainTeam, unrankedOpp, null));
  });

  it('surpriseK adds k times the surprise, clamped at surpriseCap', () => {
    const P = { ...PARAMS_V1, surpriseK: 0.2 };
    const base = driftWith(PARAMS_V1, 'win', 5, plainTeam, unrankedOpp, null);
    expect(driftWith(P, 'win', 5, plainTeam, unrankedOpp, { margin: 3, expectedMargin: 13 }))
      .toBeCloseTo(base - 2, 10);
    expect(driftWith(P, 'win', 5, plainTeam, unrankedOpp, { margin: 1, expectedMargin: 60 }))
      .toBeCloseTo(base - 0.2 * 21, 10);
    expect(driftWith(P, 'win', 5, plainTeam, unrankedOpp, null)).toBe(base);
  });

  it('a loss is never a net positive, however far it beat the line', () => {
    const P = { ...PARAMS_V1, surpriseK: 0.4 };
    expect(driftWith(P, 'loss', 20, plainTeam, rankedOpp, { margin: -1, expectedMargin: -20 })).toBeLessThanOrEqual(0);
  });

  it('a worse result against the line never helps a team', () => {
    const P = { ...PARAMS_V1, surpriseK: 0.15, unrankedLossPenalty: 4, driftScale: 1.5 };
    for (const outcome of OUTCOMES) {
      let prev = Infinity;
      for (let surprise = 30; surprise >= -30; surprise -= 1) {
        const d = driftWith(P, outcome, 8, plainTeam, unrankedOpp, { margin: 7, expectedMargin: 7 - surprise });
        expect(d).toBeLessThanOrEqual(prev);
        prev = d;
      }
    }
  });

  it('lossScale multiplies the loss magnitude, not the quality-win cushion', () => {
    // q = 1 - 40/60; magnitude 1.25 + (2/3) * 3.25 = 3.4167; one quality win = 0.4 cushion.
    const oneQualityWin = { ...plainTeam, games: [{ tag: 'quality' }] };
    expect(driftWith(PARAMS_V1, 'loss', 5, oneQualityWin, unrankedOpp, null)).toBeCloseTo(-3.4167 + 0.4, 3);
    expect(driftWith({ ...PARAMS_V1, lossScale: 2 }, 'loss', 5, oneQualityWin, unrankedOpp, null)).toBeCloseTo(-6.8333 + 0.4, 3);
    expect(driftWith({ ...PARAMS_V1, lossScale: 2 }, 'win', 5, oneQualityWin, unrankedOpp, null))
      .toBe(driftWith(PARAMS_V1, 'win', 5, oneQualityWin, unrankedOpp, null));
  });

  it('earlyWinScale multiplies wins only, and only through earlyThroughWeek', () => {
    const P = { ...PARAMS_V1, earlyWinScale: 2, earlyThroughWeek: 8 };
    const win = driftWith(PARAMS_V1, 'win', 5, plainTeam, unrankedOpp, null);
    expect(driftWith(P, 'win', 5, plainTeam, unrankedOpp, null, 8)).toBeCloseTo(2 * win, 10);
    expect(driftWith(P, 'win', 5, plainTeam, unrankedOpp, null, 9)).toBe(win);
    expect(driftWith(P, 'win', 5, plainTeam, unrankedOpp, null)).toBe(win);
    expect(driftWith(P, 'loss', 5, plainTeam, unrankedOpp, null, 3))
      .toBe(driftWith(PARAMS_V1, 'loss', 5, plainTeam, unrankedOpp, null, 3));
  });

  it('projectOrderWith passes opts.week through to the early-season win scale', () => {
    // Weak opponents (q = 0): a win drifts 0.5, a blowout 0.75; b is idle. V1 keys a 0.5, b 2,
    // c 2.25 -> a, b, c. Tripled early-season wins: a -0.5, b 2, c 0.75 -> c passes idle b.
    const order = ['a', 'b', 'c'];
    const picks = { a: 'win', c: 'blowoutWin' };
    const info = () => ({ oppPollRank: null, oppSpRank: 100 });
    const P = { ...PARAMS_V1, earlyWinScale: 3, earlyThroughWeek: 8 };
    expect(projectOrderWith(P, order, picks, {}, { getOpponentInfo: info, week: 12 })).toEqual(['a', 'b', 'c']);
    expect(projectOrderWith(P, order, picks, {}, { getOpponentInfo: info, week: 2 })).toEqual(['a', 'c', 'b']);
  });

  it('a loss never drifts above a win against the same opponent and line', () => {
    const P = { ...PARAMS_V1, surpriseK: 0.4, unrankedLossPenalty: 12, driftScale: 3 };
    for (const expectedMargin of [-20, -3, 0.5, 14, 40]) {
      const win = driftWith(P, 'win', 8, plainTeam, unrankedOpp, { margin: 1, expectedMargin });
      const loss = driftWith(P, 'loss', 8, plainTeam, unrankedOpp, { margin: -1, expectedMargin });
      expect(win).toBeGreaterThan(loss);
    }
  });
});
