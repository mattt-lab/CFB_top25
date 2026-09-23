#!/usr/bin/env node
// Compares a Pick 'em snapshot (scripts/snapshot-pickem.mjs) with the poll that came out after it:
// projected vs actual order, against a "leave the poll alone" baseline, and against the pre-game
// betting line. See scripts/lib/pickem-review.mjs for the metrics.
//
// Usage: node scripts/review-pickem.mjs [--week N] [--write] [--poll-file path] [--params path]
//   --week N          review the snapshot for week N (default: the latest snapshot on disk)
//   --write           also save the report next to the snapshot as {season}-wkNN.review.md/.json
//   --poll-file path  read the "actual" poll from this rankings file instead of
//                     data/rankings/{season}-wk{N+1}.json (for testing the tooling)
//   --params path     also score a challenger model: a JSON file { "label": "...", "params": {...} }
//                     whose params override PARAMS_V1 (scripts/lib/pickem-model-params.mjs)
//
// Exit codes: 0 report produced; 1 usage/IO problem; 3 the next week's poll isn't in the data yet
// (not a failure -- the pipeline lands it Sunday-Tuesday; run again later).

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderReport, reviewSnapshot } from './lib/pickem-review.mjs';
import { PARAMS_V1 } from './lib/pickem-model-params.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => { const i = args.indexOf(name); return i === -1 ? null : args[i + 1]; };
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const pad = (n) => String(n).padStart(2, '0');

const snapDir = join(ROOT, 'data', 'pickem-snapshots');
const snapFiles = existsSync(snapDir)
  ? readdirSync(snapDir).filter((f) => /^\d{4}-wk\d{2}\.json$/.test(f)).sort()
  : [];
if (!snapFiles.length) {
  console.error('No snapshots in data/pickem-snapshots/ -- run scripts/snapshot-pickem.mjs first.');
  process.exit(1);
}
const wanted = opt('--week');
const snapFile = wanted
  ? snapFiles.find((f) => f.endsWith(`-wk${pad(wanted)}.json`))
  : snapFiles[snapFiles.length - 1];
if (!snapFile) {
  console.error(`No snapshot for week ${wanted}. Have: ${snapFiles.join(', ')}`);
  process.exit(1);
}
const snapshot = readJson(join(snapDir, snapFile));

const pollPath = opt('--poll-file')
  ?? join(ROOT, 'data', 'rankings', `${snapshot.season}-wk${pad(snapshot.week + 1)}.json`);
if (!existsSync(pollPath)) {
  const have = readdirSync(join(ROOT, 'data', 'rankings')).filter((f) => f.startsWith(`${snapshot.season}-`)).sort();
  console.log(`The week ${snapshot.week + 1} poll is not in the data yet (expected ${pollPath}).`);
  console.log(`Latest rankings on disk: ${have[have.length - 1] ?? 'none'}. Pull the latest data (git pull) or try again later.`);
  process.exit(3);
}
const pollsFile = readJson(pollPath);
const actualOrder = pollsFile.polls?.[snapshot.pollSource];
if (!actualOrder?.length) {
  console.log(`${pollPath} has no ${snapshot.pollSource} poll yet (has: ${Object.keys(pollsFile.polls ?? {}).join(', ') || 'nothing'}).`);
  process.exit(3);
}

const current = readJson(join(ROOT, 'data', 'current.json'));
const nameOf = (id) => current.teams[id]?.name ?? id;

const challengerFile = opt('--params') ? readJson(opt('--params')) : null;
const challenger = challengerFile
  ? { label: challengerFile.label ?? 'challenger', params: { ...PARAMS_V1, ...challengerFile.params } }
  : null;
const review = reviewSnapshot(snapshot, actualOrder, { challenger });
const report = renderReport(review, nameOf);
console.log(`Snapshot: ${snapFile} (taken ${snapshot.generatedAt}); actual poll: ${pollPath} (fetched ${pollsFile.fetchedAt ?? 'unknown'})\n`);
console.log(report);

if (flag('--write')) {
  const base = join(snapDir, snapFile.replace(/\.json$/, ''));
  writeFileSync(`${base}.review.md`, `${report}\n`);
  writeFileSync(`${base}.review.json`, `${JSON.stringify(review, null, 2)}\n`);
  console.log(`Wrote ${base}.review.md and .review.json`);
}
