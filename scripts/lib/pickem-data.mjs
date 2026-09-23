// File loading shared by the backtest runners: this season's weeks (live snapshot, else the git
// rebuild) scored against the next AP poll, and a past season's weeks from its cached CFBD data.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildHistoryWeeks } from './pickem-history.mjs';

const pad = (n) => String(n).padStart(2, '0');

export function readJsonAt(root, path) {
  return JSON.parse(readFileSync(join(root, path), 'utf8'));
}

// Consecutive weeks from week 1 while both the week's record and the next AP poll exist.
export function loadSeasonWeeks(root, season) {
  const weeks = [];
  for (let week = 1; ; week++) {
    const live = `data/pickem-snapshots/${season}-wk${pad(week)}.json`;
    const rebuilt = `data/pickem-backtest/${season}-wk${pad(week)}.json`;
    const next = `data/rankings/${season}-wk${pad(week + 1)}.json`;
    const path = existsSync(join(root, live)) ? live : existsSync(join(root, rebuilt)) ? rebuilt : null;
    if (!path || !existsSync(join(root, next))) break;
    const actualOrder = readJsonAt(root, next).polls?.ap;
    if (!actualOrder?.length) break;
    weeks.push({ ...readJsonAt(root, path), actualOrder, file: path });
  }
  return weeks;
}

// { raw, records, stats, names } for a cached past season, or null if it hasn't been fetched.
export function loadHistorySeason(root, season) {
  const path = `data/pickem-history/${season}-raw.json`;
  if (!existsSync(join(root, path))) return null;
  const raw = readJsonAt(root, path);
  const names = {};
  for (const g of raw.games) {
    names[String(g.homeId)] = g.homeTeam;
    names[String(g.awayId)] = g.awayTeam;
  }
  return { raw, names, ...buildHistoryWeeks(raw) };
}
