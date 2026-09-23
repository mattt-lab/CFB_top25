// Replays saved Pick 'em weeks through the tunable model (pickem-model-params.mjs) and scores each
// projection against the poll that actually followed. Pure: week records in, numbers out.
//
// A week record is a snapshot-format object (scripts/lib/pickem-snapshot.mjs: currentOrder,
// teams[].inputs/outcome/game) plus `actualOrder`, the next poll's order, attached by the loader.
//
// The headline metric is pairwise: for every pair of teams in the old poll, did the projection put
// them in the same order as the real next poll? A 25-slot poll is zero-sum, so one team's big fall
// shifts everyone below it a slot -- but those passive teams keep their order relative to each
// other, so pairs ignore that ripple without the hand-graded longest-increasing-subsequence (LIS)
// "root mover" judgment calls. Root movers are still computed, for continuity with the weekly docs.

import { projectOrderWith } from './pickem-model-params.mjs';

// Transitions out of the first two polls are noisier (preseason priors, little data), so they
// count half.
export function weekWeight(week) {
  return week <= 2 ? 0.5 : 1;
}

export function replayInputs(record) {
  const { currentOrder } = record;
  const ranked = new Set(currentOrder);
  const teams = {};
  const picks = {};
  const info = {};
  const lines = {};
  const h2h = {};
  for (const t of record.teams) {
    const inp = t.inputs;
    teams[t.id] = {
      sp: inp.sp, fpi: inp.fpi, elo: inp.elo,
      games: Array.from({ length: inp.qualityWins }, () => ({ tag: 'quality' })),
    };
    if (t.outcome) picks[t.id] = t.outcome;
    // Records rebuilt from past seasons have no week-by-week SP+; oppEloRank stands in for it.
    info[t.id] = { oppPollRank: inp.oppPollRank ?? null, oppSpRank: inp.oppSpRank ?? inp.oppEloRank ?? null };
    const g = t.game;
    lines[t.id] = g && g.margin != null && g.expectedMargin != null
      ? { margin: g.margin, expectedMargin: g.expectedMargin }
      : null;
    if (g && ranked.has(g.opponent)) h2h[t.id] = g.opponent;
  }
  return {
    currentOrder, picks, teams,
    opts: { getOpponentInfo: (id) => info[id] ?? null, h2h, getLineInfo: (id) => lines[id] ?? null },
  };
}

export function replayWeek(record, params) {
  const { currentOrder, picks, teams, opts } = replayInputs(record);
  return projectOrderWith(params, currentOrder, picks, teams, opts);
}

// Teams that fell out of the poll count as tied just below it; a pair of two such teams has no
// real order and is skipped. Entrants can't be projected (the model only re-sorts the teams it was
// given), so they're listed, not scored. perTeam splits each wrong pair half-and-half between its
// two teams, so a team's share says how much of the error ran through it.
export function pairwiseScore(currentOrder, projectedOrder, actualOrder) {
  const OUT = actualOrder.length + 1;
  const cur = new Map(currentOrder.map((id, i) => [id, i]));
  const proj = new Map(projectedOrder.map((id, i) => [id, i]));
  const act = new Map(actualOrder.map((id, i) => [id, i]));
  const actualPos = (id) => (act.has(id) ? act.get(id) : OUT);
  const perTeam = Object.fromEntries(currentOrder.map((id) => [id, { base: 0, model: 0 }]));
  let pairs = 0;
  let dBase = 0;
  let dModel = 0;
  let flipsMade = 0;
  let flipsRight = 0;
  for (let i = 0; i < currentOrder.length; i++) {
    for (let j = i + 1; j < currentOrder.length; j++) {
      const a = currentOrder[i];
      const b = currentOrder[j];
      const ra = actualPos(a);
      const rb = actualPos(b);
      if (ra === rb) continue;
      pairs++;
      const real = Math.sign(ra - rb);
      const c = Math.sign(cur.get(a) - cur.get(b));
      const p = Math.sign(proj.get(a) - proj.get(b));
      if (c !== real) { dBase++; perTeam[a].base += 0.5; perTeam[b].base += 0.5; }
      if (p !== real) { dModel++; perTeam[a].model += 0.5; perTeam[b].model += 0.5; }
      if (p !== c) { flipsMade++; if (p === real) flipsRight++; }
    }
  }
  const currentSet = new Set(currentOrder);
  return {
    pairs, dBase, dModel, flipsMade, flipsRight,
    exits: currentOrder.filter((id) => !act.has(id)),
    entrants: actualOrder.filter((id) => !currentSet.has(id)),
    perTeam,
  };
}

// Root movers, the weekly docs' method made mechanical. Among teams in both polls, list their new
// positions in old order; teams on a longest increasing subsequence kept their order relative to
// their neighbours (passive), the rest moved on their own. When more than one LIS exists, a team on
// some but not all of them is ambiguous: it counts as passive only if its own rank didn't change
// (the docs' rule -- USC 12->12 vs Texas Tech 13->11, 2026 week 3), so both teams in a symmetric
// swap count as movers.
export function rootMovers(currentOrder, actualOrder) {
  const act = new Map(actualOrder.map((id, i) => [id, i]));
  const both = currentOrder.filter((id) => act.has(id));
  const seq = both.map((id) => act.get(id));
  const n = seq.length;
  const end = Array(n).fill(1);
  const start = Array(n).fill(1);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < i; j++) if (seq[j] < seq[i]) end[i] = Math.max(end[i], end[j] + 1);
  }
  for (let i = n - 1; i >= 0; i--) {
    for (let j = i + 1; j < n; j++) if (seq[j] > seq[i]) start[i] = Math.max(start[i], start[j] + 1);
  }
  const L = n ? Math.max(...end) : 0;
  const onSome = seq.map((_, i) => end[i] + start[i] - 1 === L);
  // Every LIS takes exactly one element per depth, so a depth with a single candidate is on all.
  const perDepth = {};
  seq.forEach((_, i) => { if (onSome[i]) perDepth[end[i]] = (perDepth[end[i]] ?? 0) + 1; });
  const currentRank = new Map(currentOrder.map((id, i) => [id, i + 1]));
  const movers = [];
  const passive = [];
  both.forEach((id, i) => {
    const onAll = onSome[i] && perDepth[end[i]] === 1;
    const unchanged = currentRank.get(id) === act.get(id) + 1;
    if (onAll || (onSome[i] && unchanged)) passive.push(id);
    else movers.push(id);
  });
  return { movers, passive, lisLength: L };
}

export function rootMoverMae(currentOrder, projectedOrder, actualOrder) {
  const { movers } = rootMovers(currentOrder, actualOrder);
  if (!movers.length) return { n: 0, model: null, baseline: null };
  const rank = (order) => new Map(order.map((id, i) => [id, i + 1]));
  const cr = rank(currentOrder);
  const pr = rank(projectedOrder);
  const ar = rank(actualOrder);
  const mean = (f) => movers.reduce((s, id) => s + f(id), 0) / movers.length;
  return {
    n: movers.length,
    model: mean((id) => Math.abs(pr.get(id) - ar.get(id))),
    baseline: mean((id) => Math.abs(cr.get(id) - ar.get(id))),
  };
}

export function evaluate(records, params, { weightOf = weekWeight } = {}) {
  const weeks = records.map((r) => {
    const projected = replayWeek(r, params);
    return { season: r.season, week: r.week, w: weightOf(r.week), projected, ...pairwiseScore(r.currentOrder, projected, r.actualOrder) };
  });
  const wBase = weeks.reduce((s, x) => s + x.w * x.dBase, 0);
  const wModel = weeks.reduce((s, x) => s + x.w * x.dModel, 0);
  return { weeks, wBase, wModel, skill: wBase ? 1 - wModel / wBase : null };
}
