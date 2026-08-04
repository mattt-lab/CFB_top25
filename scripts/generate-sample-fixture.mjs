// Dev-only utility: regenerates data/current.sample.json from the mockup-era hand-authored
// data in src/data/teams.js + src/data/content.js, reshaped into the real schema documented in
// docs/data-schema.md. Lets the frontend rewire (task #8) and any local dev happen without
// hitting the live CFBD API. Not part of the scheduled fetch pipeline — that's scripts/fetch-cfb-data.mjs.
//
// Run with: node scripts/generate-sample-fixture.mjs

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  DETAILED, SUMMARY, WEEKLY_ORDER, WEEK_IDX_MIN, WEEK_IDX_MAX, WEEKS, teamById,
} from '../src/data/teams.js';
import { GAMES, PREDICTIONS } from '../src/data/content.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

// ---- rankingsByWeek: derive directly from WEEKLY_ORDER so every team's cross-team rank at every
// historical week is internally consistent (no separate per-team cfp array to drift out of sync).
const rankingsByWeek = {};
for (let w = WEEK_IDX_MIN; w <= WEEK_IDX_MAX; w++) {
  const week = w + 1;
  rankingsByWeek[week] = {
    ap: WEEKLY_ORDER[w].slice(),
    coaches: WEEKLY_ORDER[w].slice(),
    cfp: WEEKLY_ORDER[w].slice(),
  };
}

function rankAt(id, w) { return 1 + WEEKLY_ORDER[w].indexOf(id); }

// ---- teams: every team gets the same shape, no DETAILED/SUMMARY split in the real schema.
const teams = {};
DETAILED.forEach((t) => {
  const [wins, losses] = t.record.split('-').map(Number);
  teams[t.id] = {
    name: t.name,
    conf: t.conf,
    wins, losses,
    sp: t.sp, fpi: t.fpi, elo: t.elo,
    ap: t.ap.slice(),
    coaches: t.coaches.slice(),
    cfp: WEEKS.map((wk, i) => (i < WEEK_IDX_MIN ? null : rankAt(t.id, i))),
    games: t.games.map((g) => ({ wk: g.wk, opp: g.opp, oppRank: g.oppRank, res: g.res, tag: g.tag || '' })),
  };
});
SUMMARY.forEach((s) => {
  const [wins, losses] = s.record.split('-').map(Number);
  teams[s.id] = {
    name: s.name,
    conf: s.conf,
    wins, losses,
    sp: s.sp, fpi: s.fpi, elo: s.fpi,
    ap: WEEKS.map((wk, i) => (i < WEEK_IDX_MIN ? null : rankAt(s.id, i))),
    coaches: WEEKS.map((wk, i) => (i < WEEK_IDX_MIN ? null : rankAt(s.id, i))),
    cfp: WEEKS.map((wk, i) => (i < WEEK_IDX_MIN ? null : rankAt(s.id, i))),
    // Sparse on purpose — real CFBD data fills this in for every team uniformly. The app's
    // resume/compare panels need a graceful empty state for teams with no games on record.
    games: [],
  };
});

// ---- this week's slate + predictions, reshaped from the hand-authored mockup content.
const gamesOut = GAMES.map((g, i) => ({
  id: `2026-wk12-${slugify(g.away.name)}-${slugify(g.home.name)}`,
  away: slugify(g.away.name), awayRank: g.away.rank,
  home: slugify(g.home.name), homeRank: g.home.rank,
  when: g.when,
  spread: g.spread,
  ou: +g.ou.replace('O/U ', ''),
  rivalry: false, // fixture doesn't cross-reference data/rivalries.json — real pipeline does
  stakesScore: null,
  blurb: g.note,
  blurbSource: 'manual',
}));

const predictionsOut = PREDICTIONS.map((text, i) => ({
  teamId: null, // hand-authored predictions in the mockup weren't all single-team scoped
  score: null,
  blurb: text,
  blurbSource: 'manual',
}));

const out = {
  meta: {
    season: 2026,
    currentWeek: 12,
    lastUpdated: new Date(0).toISOString(), // placeholder — real fetch stamps the actual run time
    weeksAvailable: WEEKS.filter((wk) => wk >= WEEK_IDX_MIN + 1),
  },
  rankingsByWeek,
  teams,
  games: gamesOut,
  predictions: predictionsOut,
};

const outPath = join(__dirname, '..', 'data', 'current.sample.json');
writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
console.log(`Wrote ${outPath}`);
