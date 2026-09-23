// The pass rules and forward selection from data/pickem-backtest/experiment-1.json. Pure: week
// records in, decisions out. Every candidate setting has a grid ordered outward from its
// no-change value, so "lowest index" always means "nearest to today's model".

import { evaluate } from './pickem-backtest.mjs';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const sum = (xs) => xs.reduce((a, b) => a + b, 0);

// Sorted sums of `values` resampled with replacement (one sum per draw).
export function bootstrapSums(values, { draws = 10000, seed = 20260923 } = {}) {
  const rand = mulberry32(seed);
  const n = values.length;
  const sums = new Array(draws);
  for (let d = 0; d < draws; d++) {
    let s = 0;
    for (let k = 0; k < n; k++) s += values[Math.floor(rand() * n)];
    sums[d] = s;
  }
  return sums.sort((a, b) => a - b);
}

function sd(xs) {
  const m = sum(xs) / xs.length;
  return Math.sqrt(sum(xs.map((x) => (x - m) ** 2)) / xs.length);
}

const withSetting = (base, candidate, value) => ({ ...base, [candidate.setting]: value });

// M[gridIndex][transition] = { e: weight x D_model, w, perTeam } for that grid value.
export function errorMatrix(records, base, candidate) {
  return candidate.grid.map((v) => evaluate(records, withSetting(base, candidate, v)).weeks
    .map((w) => ({ e: w.w * w.dModel, w: w.w, week: w.week, season: w.season, perTeam: w.perTeam })));
}

export function fitIndex(M, mask) {
  let best = 0;
  let bestE = Infinity;
  M.forEach((row, idx) => {
    const E = row.reduce((s, c, i) => s + (mask[i] ? c.e : 0), 0);
    if (E < bestE) { bestE = E; best = idx; }
  });
  return best;
}

// R1: hold out each transition, fit on the rest, score the held-out one against row 0 (no change).
export function crossValidate(M, opts = {}) {
  const n = M[0].length;
  const folds = M[0].map((_, i) => {
    const idx = fitIndex(M, M[0].map((__, j) => j !== i));
    return { index: i, fittedIndex: idx, delta: M[0][i].e - M[idx][i].e };
  });
  const deltas = folds.map((f) => f.delta);
  const sumDelta = sum(deltas);
  const sums = bootstrapSums(deltas, opts);
  const ci5 = sums[Math.floor(0.05 * sums.length)];
  return { n, folds, sumDelta, ci5, pass: sumDelta > 0 && ci5 > 0 };
}

// R2: fit on transitions out of poll weeks 3-8 and 9+ separately.
export function stability(records, M, candidate) {
  const ie = fitIndex(M, records.map((r) => r.week >= 3 && r.week <= 8));
  const il = fitIndex(M, records.map((r) => r.week >= 9));
  const early = candidate.grid[ie];
  const late = candidate.grid[il];
  const de = Math.abs(early - candidate.noChange);
  const dl = Math.abs(late - candidate.noChange);
  const close = Math.abs(ie - il) <= 1 || Math.max(de, dl) <= 2 * Math.min(de, dl);
  return { early, late, pass: ie !== 0 && il !== 0 && close };
}

// R5: the value nearest no-change whose total error is within one bootstrap standard error of
// the best value's, measured on their paired per-transition difference.
export function oneSeChoice(M, opts = {}) {
  const bestIndex = fitIndex(M, M[0].map(() => true));
  const table = M.map((row, idx) => {
    const d = row.map((c, i) => c.e - M[bestIndex][i].e);
    const D = sum(d);
    const se = sd(bootstrapSums(d, opts));
    return { index: idx, E: sum(row.map((c) => c.e)), excess: D, se, ok: D <= se };
  });
  return { bestIndex, index: table.find((t) => t.ok).index, table };
}

// R3
export function carryOver(check, base, candidate, value) {
  const eBase = evaluate(check, base).wModel;
  const eCand = evaluate(check, withSetting(base, candidate, value)).wModel;
  return { eBase, eCand, pass: eCand <= eBase };
}

// R4: remove every pair involving one team (perTeam holds half of each wrong pair) and re-check.
export function notOneTeam(records, base, candidate, value) {
  return improvementWithoutEachTeam(records, base, withSetting(base, candidate, value));
}

// Weighted improvement of candParams over baseParams, and the smallest it gets when every pair
// involving any one team is removed.
export function improvementWithoutEachTeam(records, baseParams, candParams) {
  const b = evaluate(records, baseParams).weeks;
  const c = evaluate(records, candParams).weeks;
  const improvement = sum(b.map((wb, i) => wb.w * (wb.dModel - c[i].dModel)));
  const teams = [...new Set(records.flatMap((r) => r.currentOrder))];
  let minImprovement = Infinity;
  let worstTeam = null;
  for (const t of teams) {
    const imp = sum(b.map((wb, i) => {
      const wc = c[i];
      const without = (w) => w.dModel - 2 * (w.perTeam[t]?.model ?? 0);
      return wb.w * (without(wb) - without(wc));
    }));
    if (imp < minImprovement) { minImprovement = imp; worstTeam = t; }
  }
  return { improvement, minImprovement, worstTeam, pass: improvement > 0 && minImprovement > 0 };
}

export function testCandidate(tuning, check, base, candidate, opts = {}) {
  if (candidate.grid[0] !== candidate.noChange || base[candidate.setting] !== candidate.noChange) {
    throw new Error(`${candidate.setting}: grid must start at its no-change value, which the base model must use`);
  }
  const M = errorMatrix(tuning, base, candidate);
  const R1 = crossValidate(M, opts);
  const R2 = stability(tuning, M, candidate);
  const rep = oneSeChoice(M, opts);
  const value = candidate.grid[rep.index];
  const R3 = carryOver(check, base, candidate, value);
  const R4 = notOneTeam(tuning, base, candidate, value);
  return {
    setting: candidate.setting,
    curve: candidate.grid.map((v, idx) => ({ value: v, E: sum(M[idx].map((x) => x.e)) })),
    best: candidate.grid[rep.bestIndex],
    value,
    oneSe: rep.table,
    rules: { R1, R2, R3, R4 },
    pass: [R1, R2, R3, R4].every((r) => r.pass),
  };
}

export function forwardSelect(tuning, check, base, candidates, opts = {}) {
  let params = { ...base };
  let remaining = [...candidates];
  const selected = [];
  const rounds = [];
  while (remaining.length && selected.length < 3) {
    const results = remaining.map((c) => testCandidate(tuning, check, params, c, opts));
    const chosen = results.filter((r) => r.pass)
      .sort((a, b) => b.rules.R1.sumDelta - a.rules.R1.sumDelta)[0] ?? null;
    rounds.push({ base: { ...params }, results, chosen: chosen?.setting ?? null });
    if (!chosen) break;
    params = { ...params, [chosen.setting]: chosen.value };
    selected.push({ setting: chosen.setting, value: chosen.value });
    remaining = remaining.filter((c) => c.setting !== chosen.setting);
  }
  return { selected, params, rounds };
}
