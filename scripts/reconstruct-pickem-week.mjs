#!/usr/bin/env node
// Rebuilds a Pick 'em week from git history into data/pickem-backtest/{season}-wk{NN}.json, for
// weeks that were never snapshotted live. The data rolls to the next week once the new poll lands
// (Sunday/Monday), so a Tuesday run never sees the finished week -- but git still has it. See
// scripts/lib/pickem-reconstruct.mjs.
//
// Usage: node scripts/reconstruct-pickem-week.mjs --week N [--commit sha] [--out path] [--force]
//   --week N      the week to rebuild: its poll plus that week's results
//   --commit sha  use this commit's data/current.json instead of searching the log
//   --out path    write here instead of data/pickem-backtest/{season}-wk{NN}.json
//   --force       overwrite an existing output file
//
// Runs today's model code on that commit's data: the result is what the current model would have
// projected then, which is not necessarily what the live page showed at the time.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSnapshot } from './lib/pickem-snapshot.mjs';
import { selectReconstructSource } from './lib/pickem-reconstruct.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i === -1 ? null : args[i + 1]; };
const pad = (n) => String(n).padStart(2, '0');

const week = Number(opt('--week'));
if (!Number.isInteger(week) || week < 1) {
  console.error('Usage: node scripts/reconstruct-pickem-week.mjs --week N [--commit sha] [--out path] [--force]');
  process.exit(1);
}

const git = (...a) => execFileSync('git', a, {
  cwd: ROOT, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
});
const showJson = (sha, path) => {
  try { return JSON.parse(git('show', `${sha}:${path}`)); } catch { return null; }
};

function* candidates() {
  const lines = opt('--commit')
    ? [git('show', '-s', '--format=%H %cI', opt('--commit')).trim()]
    : git('log', '--format=%H %cI', '--', 'data/current.json').trim().split('\n');
  for (const line of lines) {
    const [sha, date] = line.split(' ');
    const current = showJson(sha, 'data/current.json');
    if (current) yield { sha, date, current };
  }
}

const found = selectReconstructSource(candidates(), week);
if (!found) {
  console.error(`No commit of data/current.json has currentWeek=${week} with every ranked game final.`);
  process.exit(2);
}

const { sha, date, current } = found;
const { season } = current.meta;
const outPath = opt('--out')
  ? resolve(opt('--out'))
  : join(ROOT, 'data', 'pickem-backtest', `${season}-wk${pad(week)}.json`);
if (existsSync(outPath) && !args.includes('--force')) {
  console.error(`${outPath} already exists -- re-run with --force to overwrite it.`);
  process.exit(1);
}

const snapshot = buildSnapshot({
  current,
  pollsFile: showJson(sha, `data/rankings/${season}-wk${pad(week)}.json`),
  espnEvents: [],
  teamMap: {},
  appVersion: showJson(sha, 'package.json')?.version ?? null,
});
snapshot.reconstructed = {
  commit: sha,
  commitDate: date,
  source: `git show ${sha.slice(0, 7)}:data/current.json`,
  note: 'Rebuilt from git history with the model code checked out at reconstruction time, not captured live.',
};

const name = (id) => current.teams[id]?.name ?? id;
console.log(`Week ${week} rebuilt from ${sha.slice(0, 7)} (${date}); every ranked game final: ${snapshot.complete}\n`);
for (const t of [...snapshot.teams].sort((a, b) => a.projectedRank - b.projectedRank)) {
  const arrow = t.move > 0 ? `▲${t.move}` : t.move < 0 ? `▼${-t.move}` : '–';
  const g = t.game;
  const result = !g ? 'bye'
    : `${g.margin > 0 ? 'W' : 'L'} ${g.score.mine}-${g.score.theirs} vs ${name(g.opponent)}`
      + ` (${g.spread ?? 'no line'}; ${g.surprise == null ? 'n/a' : `${g.surprise > 0 ? '+' : ''}${g.surprise} vs line`})`;
  console.log(`${String(t.projectedRank).padStart(2)}. ${name(t.id).padEnd(18)} was #${String(t.currentRank).padEnd(2)} ${arrow.padEnd(4)} ${result}`);
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`\nWrote ${outPath}`);
