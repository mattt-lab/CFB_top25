// File loading shared by the backtest runners: this season's weeks (live snapshot, else the git
// rebuild) scored against the next AP poll, and a past season's weeks from its cached CFBD data.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildHistoryWeeks } from './pickem-history.mjs';

const pad = (n) => String(n).padStart(2, '0');

export function readJsonAt(root, path) {
  return JSON.parse(readFileSync(join(root, path), 'utf8'));
}

// Consecutive weeks from week 1 while both the week's record and the next AP poll exist. Some
// data/rankings week files were written before that week's AP poll came out and hold only the
// Coaches poll (they're write-once), so for the current season the AP order falls back to
// data/current.json's rankingsByWeek, which keeps updating. Each record also gets lossesAfter
// (team -> losses through that week's games) from current.json's game logs when it's this season.
export function loadSeasonWeeks(root, season) {
  const cur = existsSync(join(root, 'data/current.json')) ? readJsonAt(root, 'data/current.json') : null;
  const isCurrent = cur?.meta?.season === season;
  const weeks = [];
  for (let week = 1; ; week++) {
    const live = `data/pickem-snapshots/${season}-wk${pad(week)}.json`;
    const rebuilt = `data/pickem-backtest/${season}-wk${pad(week)}.json`;
    const next = `data/rankings/${season}-wk${pad(week + 1)}.json`;
    const path = existsSync(join(root, live)) ? live : existsSync(join(root, rebuilt)) ? rebuilt : null;
    if (!path) break;
    let actualOrder = existsSync(join(root, next)) ? readJsonAt(root, next).polls?.ap : null;
    if (!actualOrder?.length && isCurrent) actualOrder = cur.rankingsByWeek?.[String(week + 1)]?.ap;
    if (!actualOrder?.length) break;
    const record = { ...readJsonAt(root, path), actualOrder, file: path };
    if (isCurrent) {
      record.lossesAfter = Object.fromEntries(record.currentOrder.map((id) => [id,
        (cur.teams[id]?.games ?? []).filter((g) => g.res === 'L' && g.wk <= week).length]));
    }
    weeks.push(record);
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
