// Descriptive cuts of backtest weeks for the write-up: who really moved, by how much, next to what
// each model projected. Pure; no decisions are made from these (experiment-1.json's pass rules do
// that).

import { replayWeek, rootMovers, weekWeight } from './pickem-backtest.mjs';

export function tier(rank) {
  const lo = Math.floor((rank - 1) / 5) * 5 + 1;
  return `${lo}-${lo + 4}`;
}

export function surpriseBin(s) {
  if (s == null) return null;
  if (s <= -14) return '<= -14';
  if (s <= -7) return '-14 to -7';
  if (s < 0) return '-7 to 0';
  if (s < 7) return '0 to 7';
  if (s < 14) return '7 to 14';
  return '>= 14';
}

// One row per ranked team per transition. An exit counts as falling to #26. `models` maps a label
// to a params object; each gets its projected rank and move.
export function teamWeekRows(records, models) {
  const rows = [];
  for (const r of records) {
    const projections = Object.entries(models).map(([label, params]) => [label, replayWeek(r, params)]);
    const movers = new Set(rootMovers(r.currentOrder, r.actualOrder).movers);
    for (const t of r.teams) {
      const currentRank = r.currentOrder.indexOf(t.id) + 1;
      const ai = r.actualOrder.indexOf(t.id);
      const actualRank = ai === -1 ? null : ai + 1;
      const proj = Object.fromEntries(projections.map(([label, order]) => [label, order.indexOf(t.id) + 1]));
      rows.push({
        season: r.season, week: r.week, w: weekWeight(r.week), id: t.id, name: t.name ?? t.id,
        currentRank, actualRank, exited: actualRank == null, actualMove: currentRank - (actualRank ?? 26),
        outcome: t.outcome ?? null, margin: t.game?.margin ?? null, surprise: t.game?.surprise ?? null,
        oppRanked: t.inputs?.oppPollRank != null, rootMover: movers.has(t.id),
        proj,
        projMove: Object.fromEntries(Object.entries(proj).map(([label, p]) => [label, currentRank - p])),
      });
    }
  }
  return rows;
}

export function meanBy(rows, keyFn, fields) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (key == null) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups].map(([key, rs]) => ({
    key,
    n: rs.length,
    ...Object.fromEntries(Object.entries(fields).map(([field, fn]) => {
      const vals = rs.map(fn).filter((v) => v != null);
      return [field, vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null];
    })),
  }));
}
