#!/usr/bin/env node
// One-off and manual, never scheduled: fetches a finished season's polls, regular-season results
// (with each team's pre-game Elo), and betting lines from CFBD, trimmed and cached at
// data/pickem-history/{season}-raw.json for the Pick 'em backtest. A finished season doesn't
// change, so this runs once per season; everything downstream reads the cache.
//
// Usage: node --env-file=<path to .env> scripts/fetch-pickem-history.mjs --season 2025 [--force]
//
// Metered CFBD calls: /rankings, /games and /lines once each -- /lines falls back to one call per
// week if CFBD refuses a whole season -- plus /info before and after to report quota.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cfbdGet } from './lib/cfbd.mjs';
import { classifyPoll } from './lib/poll.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i === -1 ? null : args[i + 1]; };
const season = Number(opt('--season'));
if (!Number.isInteger(season)) {
  console.error('Usage: node --env-file=<.env> scripts/fetch-pickem-history.mjs --season 2025 [--force]');
  process.exit(1);
}
const outPath = join(ROOT, 'data', 'pickem-history', `${season}-raw.json`);
if (existsSync(outPath) && !args.includes('--force')) {
  console.error(`${outPath} already exists -- re-run with --force to fetch again (it costs CFBD calls).`);
  process.exit(1);
}

// Same sportsbook preference as scripts/fetch-cfb-data.mjs (which can't be imported: it runs its
// pipeline at module load), so past-season lines are chosen the way live ones are.
const PROVIDER_PREFERENCE = ['consensus', 'DraftKings', 'ESPN Bet', 'Bovada', 'Caesars'];
function pickLine(bettingGame) {
  if (!Array.isArray(bettingGame?.lines) || bettingGame.lines.length === 0) return null;
  for (const pref of PROVIDER_PREFERENCE) {
    const hit = bettingGame.lines.find((l) => (l?.provider || '').toLowerCase() === pref.toLowerCase());
    if (hit) return hit;
  }
  return bettingGame.lines[0];
}

// /info returns an object, which cfbdGet (arrays only) rejects.
async function remainingCalls() {
  try {
    const res = await fetch('https://api.collegefootballdata.com/info', {
      headers: { Authorization: `Bearer ${process.env.CFBD_API_KEY}`, Accept: 'application/json' },
    });
    return res.ok ? (await res.json())?.remainingCalls ?? null : null;
  } catch {
    return null;
  }
}

const calls = [];
async function get(path, params) {
  calls.push(`${path} ${JSON.stringify(params)}`);
  return cfbdGet(path, params);
}

const before = await remainingCalls();
console.log(`CFBD calls remaining before: ${before ?? 'unknown'}`);

const rankingWeeks = await get('/rankings', { year: season, seasonType: 'regular' });
const polls = [];
for (const wk of rankingWeeks) {
  for (const p of wk.polls ?? []) {
    const kind = classifyPoll(p.poll);
    if (!kind) continue;
    polls.push({
      week: wk.week, seasonType: wk.seasonType, poll: kind, name: p.poll,
      ranks: (p.ranks ?? []).map((r) => ({
        rank: r.rank, teamId: r.teamId, school: r.school, points: r.points ?? null, firstPlaceVotes: r.firstPlaceVotes ?? null,
      })),
    });
  }
}

const rawGames = await get('/games', { year: season, seasonType: 'regular', classification: 'fbs' });
const games = rawGames.map((g) => ({
  id: g.id, week: g.week, seasonType: g.seasonType, startDate: g.startDate, completed: g.completed,
  neutralSite: g.neutralSite,
  homeId: g.homeId, homeTeam: g.homeTeam, homeClassification: g.homeClassification, homePoints: g.homePoints,
  homePregameElo: g.homePregameElo ?? null, homePostgameElo: g.homePostgameElo ?? null,
  awayId: g.awayId, awayTeam: g.awayTeam, awayClassification: g.awayClassification, awayPoints: g.awayPoints,
  awayPregameElo: g.awayPregameElo ?? null, awayPostgameElo: g.awayPostgameElo ?? null,
}));

let rawLines;
try {
  rawLines = await get('/lines', { year: season, seasonType: 'regular' });
} catch (err) {
  console.warn(`Whole-season /lines refused (${err.message}); falling back to one call per week.`);
  const weeks = [...new Set(games.map((g) => g.week))].sort((a, b) => a - b);
  rawLines = [];
  for (const week of weeks) rawLines.push(...await get('/lines', { year: season, seasonType: 'regular', week }));
}
const lines = rawLines.map((bg) => {
  const l = pickLine(bg);
  return l && {
    id: bg.id, week: bg.week, homeTeamId: bg.homeTeamId, homeTeam: bg.homeTeam, awayTeamId: bg.awayTeamId,
    awayTeam: bg.awayTeam, provider: l.provider, formattedSpread: l.formattedSpread ?? null,
    spread: l.spread ?? null, overUnder: l.overUnder ?? null,
  };
}).filter(Boolean);

const after = await remainingCalls();

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify({
  season, fetchedAt: new Date().toISOString(), source: 'CollegeFootballData.com (CFBD)',
  calls, remainingCalls: { before, after }, polls, games, lines,
})}\n`);

const count = (xs, key) => xs.reduce((m, x) => ({ ...m, [x[key]]: (m[x[key]] ?? 0) + 1 }), {});
console.log(`Metered calls made: ${calls.length} (${calls.join('; ')})`);
console.log(`CFBD calls remaining after: ${after ?? 'unknown'}`);
console.log(`Poll weeks by type: ${JSON.stringify(count(polls, 'poll'))}`);
console.log(`Games: ${games.length} (completed ${games.filter((g) => g.completed).length}); with a line: ${lines.length}`);
console.log(`Line providers used: ${JSON.stringify(count(lines, 'provider'))}`);
console.log(`Wrote ${outPath}`);
