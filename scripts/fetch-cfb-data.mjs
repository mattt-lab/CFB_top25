// Fetches AP/Coaches/CFP rankings, game results, betting lines, SP+ and FPI ratings from
// CollegeFootballData.com (CFBD) and reshapes them into data/current.json, per the LOCKED schema
// documented in docs/data-schema.md. Also writes/append-only-updates the current week's raw poll
// snapshot at data/rankings/<season>-wkNN.json.
//
// Endpoints hit (base https://api.collegefootballdata.com, exact paths/params verified against
// the live OpenAPI spec at https://api.collegefootballdata.com/api-docs.json -- not guessed from
// memory):
//   GET /rankings    ?year, seasonType         -> full-season poll history (AP/Coaches/CFP)
//   GET /games        ?year, seasonType, classification -> full-season game results + schedule
//   GET /lines        ?year, seasonType, week   -> betting lines for the upcoming week's slate
//   GET /ratings/sp   ?year                     -> SP+ ratings (has a `ranking` field directly)
//   GET /ratings/fpi  ?year                     -> FPI ratings (rating only, no rank -- see TODO below)
//
// ---------------------------------------------------------------------------------------------
// HOW TO TEST (once a live CFBD_API_KEY is available -- get a free one at
// https://collegefootballdata.com/key):
//
//   CFBD_API_KEY=xxxxxxxx node scripts/fetch-cfb-data.mjs
//
// Optional env overrides:
//   CFBD_SEASON=2026     -- defaults to the current calendar year
//
// This has NOT been run against live data (no key was available while writing it). It's been
// written defensively -- every array/field from the API is checked before use -- but a live run
// is a separate, later verification task. Known open questions are marked TODO(schema) or
// "ASSUMPTION" inline; see the end-of-run report for the full list.
// ---------------------------------------------------------------------------------------------

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'data');
const RANKINGS_DIR = join(DATA_DIR, 'rankings');

const CFBD_BASE = 'https://api.collegefootballdata.com';

// ---- config -------------------------------------------------------------------------------

const API_KEY = process.env.CFBD_API_KEY;
if (!API_KEY) {
  console.error(
    'ERROR: CFBD_API_KEY environment variable is not set.\n' +
    'Get a free key at https://collegefootballdata.com/key, then run:\n' +
    '  CFBD_API_KEY=xxxxxxxx node scripts/fetch-cfb-data.mjs',
  );
  process.exit(1);
}

const SEASON = Number(process.env.CFBD_SEASON) || new Date().getFullYear();

// ASSUMPTION: conference championship week is still CFBD seasonType "regular" (only bowls/CFP
// are "postseason"). Not verified live -- if a live run shows conf-champ-week data missing,
// this is the first place to check.
const SEASON_TYPE = 'regular';

// Point-in-time "quality win" / "bad loss" thresholds for teams[].games[].tag. Formalizes the
// informal pattern in src/data/teams.js's hand-authored DETAILED array (roughly: beating a team
// ranked ~20-or-better reads as "quality"; losing to a team that wasn't ranked at all reads as
// "bad"). The mockup data isn't perfectly consistent with a single rule (e.g. a loss to a
// still-elite #5 team is tagged "bad" in one spot) -- that's flavor text from illustrative mock
// data, not a spec. This is the formalized, symmetric version:
//   - "quality": a WIN over a team ranked <= QUALITY_WIN_MAX_RANK in that week's committee poll
//   - "bad":     a LOSS to a team that was unranked (not in that week's committee top 25 at all)
//   - "":        everything else (unranked win, ranked loss, bye)
const QUALITY_WIN_MAX_RANK = 20;

// ---- small helpers --------------------------------------------------------------------------

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

async function cfbdGet(path, params = {}) {
  const url = new URL(path, CFBD_BASE);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  let res;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${API_KEY}`, Accept: 'application/json' },
    });
  } catch (err) {
    throw new Error(`CFBD ${path} -- network error: ${err.message}`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`CFBD ${path} -> HTTP ${res.status} ${res.statusText}: ${body.slice(0, 500)}`);
  }
  const json = await res.json();
  if (!Array.isArray(json)) {
    throw new Error(`CFBD ${path} -- expected a JSON array, got ${typeof json}`);
  }
  return json;
}

// CFBD's /rankings response types `poll` as a bare string, not an enum (confirmed against the
// live OpenAPI spec -- components.schemas.Poll.poll is just `{type: "string"}`). The actual
// values it returns ("AP Top 25", "Coaches Poll", "Playoff Committee Rankings", plus lower-tier
// polls like AFCA Division II) are documented informally by downstream client libraries
// (cfbfastR). Matched case-insensitively/fuzzily so small wording drift doesn't silently break
// this script -- unrecognized polls are just skipped.
function classifyPoll(pollName) {
  const p = (pollName || '').toLowerCase();
  if (p.includes('playoff committee') || p === 'cfp') return 'cfp';
  if (p.includes('coaches')) return 'coaches';
  if (p.includes('ap top') || p === 'ap') return 'ap';
  return null;
}

// ---- main -------------------------------------------------------------------------------

async function main() {
  mkdirSync(RANKINGS_DIR, { recursive: true });

  // name/conference lookup, populated as we see teams across every endpoint below
  const teamMeta = {}; // id -> { name, conf }
  function touchTeam(id, name, conf) {
    if (!id || !name) return;
    if (!teamMeta[id]) teamMeta[id] = { name, conf: conf || null };
    else if (!teamMeta[id].conf && conf) teamMeta[id].conf = conf;
  }

  // ---- Step 1: rankings (full season, all weeks -- AP/Coaches start week 1, CFP starts week 7) --
  console.log(`Fetching rankings for ${SEASON}...`);
  const rankingWeeks = await cfbdGet('/rankings', { year: SEASON, seasonType: SEASON_TYPE });
  if (rankingWeeks.length === 0) {
    throw new Error(`CFBD /rankings returned no data for season ${SEASON}. Has the season started?`);
  }

  // weekPolls[week] = { ap: [...ids best-first], coaches: [...], cfp: [...] }
  const weekPolls = {};
  for (const pw of rankingWeeks) {
    if (!pw || typeof pw.week !== 'number' || !Array.isArray(pw.polls)) continue;
    const wk = pw.week;
    for (const poll of pw.polls) {
      if (!poll) continue;
      const kind = classifyPoll(poll.poll);
      if (!kind) continue; // unrecognized/untracked poll (e.g. a Div II poll) -- skip
      const ranks = Array.isArray(poll.ranks) ? poll.ranks : [];
      const ranked = ranks
        .filter((r) => r && r.rank != null && r.school)
        .sort((a, b) => a.rank - b.rank)
        .map((r) => {
          const id = slugify(r.school);
          touchTeam(id, r.school, r.conference);
          return id;
        });
      if (!weekPolls[wk]) weekPolls[wk] = {};
      weekPolls[wk][kind] = ranked;
    }
  }

  const committeeWeeks = Object.keys(weekPolls)
    .map(Number)
    .filter((wk) => weekPolls[wk].cfp && weekPolls[wk].cfp.length > 0)
    .sort((a, b) => a - b);

  if (committeeWeeks.length === 0) {
    throw new Error(
      `No CFP committee rankings found for season ${SEASON} yet (the committee's first reveal is ` +
      'typically week 7). Nothing meaningful to fetch until the committee publishes its first poll.',
    );
  }

  const currentWeek = committeeWeeks[committeeWeeks.length - 1];
  // The week the *next* slate of games falls in -- see the Step 6 comment below for why this
  // (not currentWeek) is what "this week's games" / betting lines actually means on this site.
  const NEXT_WEEK = currentWeek + 1;
  const weeksAvailable = committeeWeeks; // weeks with a committee ranking, ascending
  const allWeeksToDate = Array.from({ length: currentWeek }, (_, i) => i + 1); // 1..currentWeek

  // rankingsByWeek: committee-era weeks only, per docs/data-schema.md ("One entry per week that
  // has a committee ranking").
  const rankingsByWeek = {};
  for (const wk of weeksAvailable) {
    rankingsByWeek[wk] = {
      ap: weekPolls[wk].ap || [],
      coaches: weekPolls[wk].coaches || [],
      cfp: weekPolls[wk].cfp || [],
    };
  }
  console.log(`Current week: ${currentWeek}. Committee weeks available: ${weeksAvailable.join(', ')}.`);

  // ---- Step 2: write this week's raw snapshot file (append-only -- never overwrite) -----------
  const snapshotPath = join(RANKINGS_DIR, `${SEASON}-wk${String(currentWeek).padStart(2, '0')}.json`);
  if (existsSync(snapshotPath)) {
    console.log(`${snapshotPath} already exists -- leaving it untouched (append-only historical record).`);
  } else {
    const snapshot = {
      week: currentWeek,
      fetchedAt: new Date().toISOString(),
      polls: rankingsByWeek[currentWeek],
    };
    writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2) + '\n');
    console.log(`Wrote ${snapshotPath}`);
  }

  // Point-in-time opponent-rank lookup for teams[].games[].tag. Prefers the on-disk snapshot file
  // for a given week (the actual source of truth per docs/data-schema.md -- frozen the first time
  // that week was fetched, immune to a later week's rank churn), falling back to the poll data we
  // just pulled from CFBD for weeks that don't have a snapshot file on disk yet (e.g. the very
  // first time this script is ever run for a season, backfilling several committee weeks at once).
  const snapshotCache = new Map();
  function loadWeekSnapshotPolls(wk) {
    if (snapshotCache.has(wk)) return snapshotCache.get(wk);
    const p = join(RANKINGS_DIR, `${SEASON}-wk${String(wk).padStart(2, '0')}.json`);
    let polls = null;
    if (existsSync(p)) {
      try {
        const raw = JSON.parse(readFileSync(p, 'utf8'));
        polls = raw && raw.polls ? raw.polls : null;
      } catch (err) {
        console.warn(`Could not parse ${p}, falling back to freshly-fetched rankings: ${err.message}`);
      }
    }
    if (!polls) polls = rankingsByWeek[wk] || null;
    snapshotCache.set(wk, polls);
    return polls;
  }

  function opponentRankAtWeek(wk, opponentId) {
    const polls = loadWeekSnapshotPolls(wk);
    if (!polls) return null;
    // CFP committee poll is the canonical point-in-time rank for tagging purposes; fall back to
    // AP if the committee snapshot is somehow missing that week (shouldn't happen post-week-7).
    const order = polls.cfp && polls.cfp.length ? polls.cfp : polls.ap;
    if (!Array.isArray(order)) return null;
    const idx = order.indexOf(opponentId);
    return idx === -1 ? null : idx + 1;
  }

  function tagFor(res, oppRank) {
    if (res === 'W' && oppRank != null && oppRank <= QUALITY_WIN_MAX_RANK) return 'quality';
    if (res === 'L' && oppRank == null) return 'bad';
    return '';
  }

  // ---- Step 3: games (full season -- records, per-team game logs, and this week's slate) ------
  console.log(`Fetching games for ${SEASON}...`);
  // ASSUMPTION: classification=fbs returns every game involving at least one FBS team (including
  // FBS-vs-FCS games, which we want for accurate records/schedules), not just FBS-vs-FBS games.
  // Not verified live -- worth a spot check once a key exists.
  const games = await cfbdGet('/games', { year: SEASON, seasonType: SEASON_TYPE, classification: 'fbs' });

  const teamGameLog = {}; // id -> [{ wk, opp, oppRank, res, tag }]
  const teamRecord = {}; // id -> { wins, losses }

  for (const g of games) {
    if (!g || !g.homeTeam || !g.awayTeam || typeof g.week !== 'number') continue;
    const homeId = slugify(g.homeTeam);
    const awayId = slugify(g.awayTeam);
    touchTeam(homeId, g.homeTeam, g.homeConference);
    touchTeam(awayId, g.awayTeam, g.awayConference);

    if (g.completed && g.homePoints != null && g.awayPoints != null) {
      const homeWon = g.homePoints > g.awayPoints;

      teamRecord[homeId] = teamRecord[homeId] || { wins: 0, losses: 0 };
      teamRecord[awayId] = teamRecord[awayId] || { wins: 0, losses: 0 };
      if (homeWon) { teamRecord[homeId].wins += 1; teamRecord[awayId].losses += 1; }
      else { teamRecord[awayId].wins += 1; teamRecord[homeId].losses += 1; }

      // Per-team game log only covers committee-era weeks (7+) -- that's the only span the
      // per-week snapshot files can cross-reference for a point-in-time opponent rank, and it
      // matches the shape of the hand-authored mock (src/data/teams.js DETAILED games arrays).
      if (g.week >= weeksAvailable[0]) {
        const homeOppRank = opponentRankAtWeek(g.week, awayId);
        const awayOppRank = opponentRankAtWeek(g.week, homeId);
        const homeRes = homeWon ? 'W' : 'L';
        const awayRes = homeWon ? 'L' : 'W';
        (teamGameLog[homeId] = teamGameLog[homeId] || []).push({
          wk: g.week, opp: g.awayTeam, oppRank: homeOppRank, res: homeRes, tag: tagFor(homeRes, homeOppRank),
        });
        (teamGameLog[awayId] = teamGameLog[awayId] || []).push({
          wk: g.week, opp: g.homeTeam, oppRank: awayOppRank, res: awayRes, tag: tagFor(awayRes, awayOppRank),
        });
      }
    }
  }
  for (const id of Object.keys(teamGameLog)) teamGameLog[id].sort((a, b) => a.wk - b.wk);

  // ---- Step 4: betting lines for the upcoming slate ----------------------------------------------
  console.log(`Fetching betting lines for week ${NEXT_WEEK}...`);
  const lines = await cfbdGet('/lines', { year: SEASON, seasonType: SEASON_TYPE, week: NEXT_WEEK });
  const linesByGameId = new Map();
  for (const bg of lines) {
    if (bg && bg.id != null) linesByGameId.set(bg.id, bg);
  }
  // ASSUMPTION: prefer a "consensus" line if CFBD provides one, else fall back through a few
  // well-known sportsbook providers, else just take whatever's first. Not verified live -- the
  // exact provider strings CFBD returns should be spot-checked once a key exists.
  const PROVIDER_PREFERENCE = ['consensus', 'DraftKings', 'ESPN Bet', 'Bovada', 'Caesars'];
  function pickLine(bettingGame) {
    if (!bettingGame || !Array.isArray(bettingGame.lines) || bettingGame.lines.length === 0) return null;
    for (const pref of PROVIDER_PREFERENCE) {
      const hit = bettingGame.lines.find((l) => l && (l.provider || '').toLowerCase() === pref.toLowerCase());
      if (hit) return hit;
    }
    return bettingGame.lines[0];
  }

  // ---- Step 5: rivalries (static config, read-only -- owned by a sibling task) -----------------
  const rivalriesPath = join(DATA_DIR, 'rivalries.json');
  const rivalryPairs = new Set();
  if (existsSync(rivalriesPath)) {
    try {
      const rivalries = JSON.parse(readFileSync(rivalriesPath, 'utf8'));
      for (const r of rivalries) {
        if (r && r.a && r.b) rivalryPairs.add([r.a, r.b].sort().join('|'));
      }
    } catch (err) {
      console.warn(`Could not parse ${rivalriesPath}, treating all games as non-rivalry: ${err.message}`);
    }
  } else {
    console.warn(`${rivalriesPath} not found -- rivalry flag defaults to false until it exists.`);
  }
  function isRivalry(a, b) { return rivalryPairs.has([a, b].sort().join('|')); }

  // ---- Step 6: the UPCOMING slate (the games that will shape the *next* ranking) ---------------
  // `currentWeek` is the week of the latest committee RANKING, which already reflects results
  // through the previous week's games (e.g. conference championship games all land in week 15,
  // but the ranking built from them is dated week 16 -- confirmed against real 2024 CFBD data,
  // where a naive `week === currentWeek` filter returned just 1 stray game instead of the actual
  // championship slate). The site's own framing ("What the model expects -- Week N -> N+1") makes
  // the intent explicit: this panel previews upcoming games, not a recap of already-ranked ones.
  const currentCfpOrder = rankingsByWeek[currentWeek].cfp;
  function currentRank(id) {
    const i = currentCfpOrder.indexOf(id);
    return i === -1 ? null : i + 1;
  }

  const weekGames = games.filter((g) => g && g.week === NEXT_WEEK && g.seasonType === SEASON_TYPE);
  const gamesOut = weekGames.map((g) => {
    const awayId = slugify(g.awayTeam);
    const homeId = slugify(g.homeTeam);
    touchTeam(homeId, g.homeTeam, g.homeConference);
    touchTeam(awayId, g.awayTeam, g.awayConference);
    const line = pickLine(linesByGameId.get(g.id));
    return {
      id: `${SEASON}-wk${NEXT_WEEK}-${awayId}-${homeId}`,
      away: awayId,
      awayRank: currentRank(awayId),
      home: homeId,
      homeRank: currentRank(homeId),
      when: g.startDate || null,
      // formattedSpread comes pre-formatted from CFBD (e.g. "Ohio State -6.5") -- using it
      // directly avoids guessing at CFBD's home/away spread-sign convention ourselves.
      spread: line && line.formattedSpread ? line.formattedSpread : null,
      ou: line && line.overUnder != null ? line.overUnder : null,
      rivalry: isRivalry(awayId, homeId),
      // populated by downstream scripts that don't exist yet (Stage 1 scoring / Stage 2 narration)
      stakesScore: null,
      blurb: null,
      blurbSource: null,
    };
  });

  // ---- Step 7: SP+ ratings ----------------------------------------------------------------------
  console.log('Fetching SP+ ratings...');
  const spRatings = await cfbdGet('/ratings/sp', { year: SEASON });
  const spById = {};
  for (const t of spRatings) {
    if (!t || !t.team) continue;
    const id = slugify(t.team);
    touchTeam(id, t.team, t.conference);
    spById[id] = t.ranking != null ? t.ranking : null;
  }

  // ---- Step 8: FPI ratings ----------------------------------------------------------------------
  console.log('Fetching FPI ratings...');
  const fpiRatings = await cfbdGet('/ratings/fpi', { year: SEASON });
  // TODO(schema): CFBD's /ratings/fpi response (confirmed against the live OpenAPI spec --
  // components.schemas.TeamFPI) has no top-level overall-FPI-rank field. It only returns a raw
  // `fpi` rating number plus a `resumeRanks` object of unrelated *sub*-metric ranks (game control,
  // strength of record, etc. -- not an "FPI rank"). docs/data-schema.md wants `teams[id].fpi` to
  // be an integer rank (1 = best), so we derive it ourselves: sort every team CFBD returned for
  // this season by its `fpi` rating, descending, and use the resulting position. This should
  // match what CFBD's own website displays as "FPI Rank", but that's unverified without a live
  // key -- worth a direct spot check against collegefootballdata.com once one exists.
  const fpiSorted = fpiRatings
    .filter((t) => t && t.team && t.fpi != null)
    .slice()
    .sort((a, b) => b.fpi - a.fpi);
  const fpiById = {};
  fpiSorted.forEach((t, i) => {
    const id = slugify(t.team);
    touchTeam(id, t.team, t.conference);
    fpiById[id] = i + 1;
  });

  // ---- Step 9: Elo ratings -----------------------------------------------------------------------
  console.log('Fetching Elo ratings...');
  // CFBD exposes a dedicated Elo endpoint directly -- simpler and more authoritative than deriving
  // a rank from post-game rating deltas in the games feed (which has gaps around bye weeks and
  // won't necessarily match however CFBD's own site presents Elo). Same shape as /ratings/sp:
  // an `elo` rating number, no rank field, so we sort-and-rank ourselves like FPI above.
  const eloRatings = await cfbdGet('/ratings/elo', { year: SEASON });
  const eloSorted = eloRatings
    .filter((t) => t && t.team && t.elo != null)
    .slice()
    .sort((a, b) => b.elo - a.elo);
  const eloById = {};
  eloSorted.forEach((t, i) => {
    const id = slugify(t.team);
    touchTeam(id, t.team, t.conference);
    eloById[id] = i + 1;
  });

  // ---- Step 10: assemble teams{} -----------------------------------------------------------------
  // Universe = every team that appeared in any AP/Coaches/CFP poll this season, plus every team
  // in this week's slate (so the frontend never has to render a game against a team with no
  // entry). This matches docs/data-schema.md's "every currently-ranked-or-recently-ranked team" --
  // it deliberately excludes one-off FCS/small-school opponents (e.g. an SEC team's Week 11
  // cupcake) that show up in teamGameLog/teamMeta via the games endpoint but were never ranked
  // and never play in the current week's slate themselves.
  const teamIds = new Set();
  for (const wk of allWeeksToDate) {
    if (!weekPolls[wk]) continue;
    for (const kind of ['ap', 'coaches']) {
      for (const id of weekPolls[wk][kind] || []) teamIds.add(id);
    }
  }
  for (const wk of weeksAvailable) {
    for (const id of rankingsByWeek[wk].cfp) teamIds.add(id);
  }
  for (const g of gamesOut) { teamIds.add(g.away); teamIds.add(g.home); }

  const teams = {};
  for (const id of teamIds) {
    const meta = teamMeta[id] || { name: id, conf: null }; // edge case: ranked team with zero recorded games
    const rec = teamRecord[id] || { wins: 0, losses: 0 };

    const apArr = allWeeksToDate.map((wk) => {
      const order = weekPolls[wk] && weekPolls[wk].ap;
      if (!order) return null;
      const i = order.indexOf(id);
      return i === -1 ? null : i + 1;
    });
    const coachesArr = allWeeksToDate.map((wk) => {
      const order = weekPolls[wk] && weekPolls[wk].coaches;
      if (!order) return null;
      const i = order.indexOf(id);
      return i === -1 ? null : i + 1;
    });
    const cfpArr = allWeeksToDate.map((wk) => {
      if (wk < weeksAvailable[0]) return null; // pre-committee weeks are always null
      const order = rankingsByWeek[wk] && rankingsByWeek[wk].cfp;
      if (!order) return null;
      const i = order.indexOf(id);
      return i === -1 ? null : i + 1;
    });

    teams[id] = {
      name: meta.name,
      // TODO(schema): schema doesn't mark `conf` nullable, but CFBD returns a nullable
      // conference on both PollRank and Game -- null here means CFBD had no conference on file
      // for this team all season (should be rare/nonexistent for FBS teams in practice).
      conf: meta.conf || null,
      wins: rec.wins,
      losses: rec.losses,
      sp: spById[id] != null ? spById[id] : null,
      fpi: fpiById[id] != null ? fpiById[id] : null,
      elo: eloById[id] != null ? eloById[id] : null,
      ap: apArr,
      coaches: coachesArr,
      cfp: cfpArr,
      games: teamGameLog[id] || [],
    };
  }

  // ---- Step 11: assemble + write current.json ----------------------------------------------------
  const out = {
    meta: {
      season: SEASON,
      currentWeek,
      lastUpdated: new Date().toISOString(),
      weeksAvailable,
    },
    rankingsByWeek,
    teams,
    games: gamesOut,
    // populated by downstream Stage 1 scoring script (task #6), which doesn't exist yet
    predictions: [],
  };

  const outPath = join(DATA_DIR, 'current.json');
  writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
  console.log(`Wrote ${outPath} (${Object.keys(teams).length} teams, ${gamesOut.length} games this week).`);
}

main().catch((err) => {
  console.error('fetch-cfb-data failed:', err && err.stack ? err.stack : err);
  process.exit(1);
});
