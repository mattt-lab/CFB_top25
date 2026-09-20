#!/usr/bin/env node
// Freezes what the Top 25 Pick 'em page projected for the current week -- plus every game's
// pre-game line and final score -- into data/pickem-snapshots/{season}-wk{NN}.json, so it can be
// compared with the real poll once it comes out (scripts/review-pickem.mjs). See
// scripts/lib/pickem-snapshot.mjs for what's captured and why.
//
// Usage: node scripts/snapshot-pickem.mjs [--force] [--require-complete]
//   --force             overwrite an existing snapshot for this week (default: refuse -- like the
//                       raw poll snapshots this is meant to be a frozen record, not a moving one)
//   --require-complete  exit non-zero, writing nothing, if any ranked team's game isn't final
//
// Reads the committed data/current.json, then asks ESPN about any game that file still has as
// unfinished (it lags a final whistle by hours), so a snapshot taken right after the last game
// reflects real results. Nothing here calls a paid API.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSnapshot } from './lib/pickem-snapshot.mjs';
import { buildScoreboardUrls } from './lib/espn-match.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ESPN_SCOREBOARD_BASE_URL =
  'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?groups=80&limit=150';
const force = process.argv.includes('--force');
const requireComplete = process.argv.includes('--require-complete');

const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const pad = (n) => String(n).padStart(2, '0');

const current = readJson('data/current.json');
const { season, currentWeek: week } = current.meta;
const outPath = join(ROOT, 'data', 'pickem-snapshots', `${season}-wk${pad(week)}.json`);
if (existsSync(outPath) && !force) {
  console.error(`${outPath} already exists -- re-run with --force to overwrite it.`);
  process.exit(1);
}

const pollsPath = `data/rankings/${season}-wk${pad(week)}.json`;
const pollsFile = existsSync(join(ROOT, pollsPath)) ? readJson(pollsPath) : null;

const pending = current.allGames.filter((g) => g.status !== 'final');
let espnEvents = [];
if (pending.length) {
  const urls = buildScoreboardUrls(pending, ESPN_SCOREBOARD_BASE_URL);
  const settled = await Promise.allSettled(urls.map(async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} (${url})`);
    return res.json();
  }));
  for (const s of settled) {
    if (s.status === 'rejected') console.warn(`ESPN scoreboard day failed: ${s.reason.message}`);
  }
  espnEvents = settled.filter((s) => s.status === 'fulfilled').flatMap((s) => s.value.events ?? []);
  console.log(`Asked ESPN about ${pending.length} game(s) not final in the committed data (${espnEvents.length} events).`);
}

const snapshot = buildSnapshot({
  current,
  pollsFile,
  espnEvents,
  teamMap: readJson('src/data/espnTeamMap.json'),
  appVersion: readJson('package.json').version,
});

const name = (id) => current.teams[id]?.name ?? id;
console.log(`\nWeek ${week} ${snapshot.pollSource.toUpperCase()} poll -> projected order (model: real results as picks)\n`);
for (const t of [...snapshot.teams].sort((a, b) => a.projectedRank - b.projectedRank)) {
  const arrow = t.move > 0 ? `▲${t.move}` : t.move < 0 ? `▼${-t.move}` : '–';
  const g = t.game;
  const result = !g ? 'bye'
    : g.status === 'final'
      ? `${g.margin > 0 ? 'W' : 'L'} ${g.score.mine}-${g.score.theirs} vs ${g.opponentRank ? `#${g.opponentRank} ` : ''}${name(g.opponent)}`
        + ` (${g.spread ?? 'no line'}; ${g.surprise == null ? 'n/a' : `${g.surprise > 0 ? '+' : ''}${g.surprise} vs line`})`
      : `NOT FINAL (${g.status})`;
  console.log(`${String(t.projectedRank).padStart(2)}. ${name(t.id).padEnd(16)} was #${String(t.currentRank).padEnd(2)} ${arrow.padEnd(4)} ${result}`);
}

if (!snapshot.complete) {
  console.warn(`\nWARNING: ${snapshot.notFinal.length} ranked team(s) have no final result yet: ${snapshot.notFinal.join(', ')}`);
  if (requireComplete) {
    console.error('--require-complete set: nothing written.');
    process.exit(2);
  }
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`\nWrote ${outPath} (complete: ${snapshot.complete}, ${snapshot.games.length} games with lines).`);
