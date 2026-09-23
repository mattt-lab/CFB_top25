// Rebuilds a Pick 'em week from git history when it wasn't snapshotted live. The data pipeline
// commits data/current.json several times a day, and the last commit before the next poll rolls
// currentWeek forward has every result final -- the same input a live snapshot would have used.

import { buildSnapshot } from './pickem-snapshot.mjs';

// candidates: newest-first iterable of { sha, current } (current = that commit's data/current.json).
// Returns { sha, current, snapshot } for the newest commit still on `week` whose ranked games are
// all final, or null.
export function selectReconstructSource(candidates, week) {
  for (const c of candidates) {
    const wk = c.current?.meta?.currentWeek;
    if (wk < week) break;
    if (wk !== week) continue;
    const snapshot = buildSnapshot({ current: c.current, espnEvents: [], teamMap: {} });
    if (snapshot.complete) return { ...c, snapshot };
  }
  return null;
}
