// Fetches AP/Coaches/CFP rankings, game results, betting lines, SP+ and FPI ratings from
// CollegeFootballData.com (CFBD) and reshapes them into data/current.json, per the LOCKED schema
// documented in docs/data-schema.md. Also writes/append-only-updates the current week's raw poll
// snapshot at data/rankings/<season>-wkNN.json and the current week's computer-ratings snapshot
// at data/ratings/<season>-wkNN.json.
//
// Endpoints hit (base https://api.collegefootballdata.com, exact paths/params verified against
// the live OpenAPI spec at https://api.collegefootballdata.com/api-docs.json -- not guessed from
// memory):
//   GET /rankings    ?year, seasonType         -> full-season poll history (AP/Coaches/CFP)
//   GET /games        ?year, seasonType, classification -> full-season game results + schedule
//   GET /lines        ?year, seasonType, week   -> betting lines for the upcoming week's slate
//   GET /games/media  ?year, seasonType, week, classification -> TV/streaming outlet per game
//   GET /ratings/sp   ?year                     -> SP+ ratings (has a `ranking` field directly)
//   GET /ratings/fpi  ?year                     -> FPI ratings (rating only, no rank -- see TODO below)
//   GET /ratings/elo  ?year                     -> Elo ratings (rating only, no rank -- ranked like FPI)
//
// RATINGS SNAPSHOTS: unlike /rankings, the three /ratings/* endpoints have NO `week` parameter
// (verified against the live OpenAPI spec) -- they only ever return the CURRENT season-to-date
// snapshot, so historical rating data can't be backfilled the way poll history can. The only way
// to get a week-by-week record is to capture it forward as it happens: each run writes this
// week's SP+/FPI/Elo ranks to data/ratings/<season>-wkNN.json (append-only, same convention as
// the poll snapshots above), accumulating the history a future poll-vs-computers trend chart
// will need. Zero extra API calls -- it reuses the Step 7-9 responses already in hand.
//
// SEASON CHANGEOVER: which year is "the season" flips Aug 1 (scripts/lib/season.mjs) -- the
// previous season's final data stays the target through the off-season, then the site points at
// the new season starting Aug 1 even though that new season won't have committee rankings for
// another couple months.
//
// allGames vs games: this script writes the FULL current-week slate to `allGames`; `games` starts
// empty and is populated downstream by scripts/score.mjs as the top-6-by-stakesScore SUBSET of
// allGames, in place -- not a separate list. Everything that needs "every game this week" (e.g. a
// Conference Tracker page) reads allGames; the sitewide "biggest games" marquee panel reads games.
//
// PRE-COMMITTEE POLL FALLBACK: the CFP committee's first reveal is ~week 7-11 depending on the
// season -- for every week before that (which, right after the Aug 1 changeover, is EVERY week
// until the committee starts), there's no CFP data to rank/tier/seed teams by. Confirmed live:
// as of this comment, 2026 has exactly one poll on file -- a preseason Coaches Poll, tagged
// week 1, with real teams/points/first-place votes; no AP, no CFP, no SP+ yet. resolvePrimaryPoll
// below picks, per week: CFP if it exists that week, else Coaches Poll, else AP. Everything that
// needs "the" ranking (Top 25 order, tiers, the Playoff Watch bracket, time-travel) reads this
// resolved `primary` order rather than assuming CFP is always populated -- because for a real
// chunk of every season, it isn't.
//
// ---------------------------------------------------------------------------------------------
// HOW TO TEST (once a live CFBD_API_KEY is available -- get a free one at
// https://collegefootballdata.com/key):
//
//   CFBD_API_KEY=xxxxxxxx node scripts/fetch-cfb-data.mjs
//
// Optional env overrides:
//   CFBD_SEASON=2026     -- defaults to resolveSeasonYear()'s Aug-1 rule
//
// Verified against real 2024 (fully committee-covered) and 2026 (pre-committee, preseason-poll-
// only) data -- see the git history for what each run surfaced. Every remaining unverified
// assumption is marked TODO(schema) or "ASSUMPTION" inline.
// ---------------------------------------------------------------------------------------------

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { resolveSeasonYear } from './lib/season.mjs';
import { tagFor } from './lib/game-log.mjs';
import { cfbdGet } from './lib/cfbd.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'data');
const RANKINGS_DIR = join(DATA_DIR, 'rankings');
const RATINGS_DIR = join(DATA_DIR, 'ratings');

const SEASON = Number(process.env.CFBD_SEASON) || resolveSeasonYear();

// ASSUMPTION: conference championship week is still CFBD seasonType "regular" (only bowls/CFP
// are "postseason"). Confirmed live for 2024: SEC/Big Ten/ACC/etc. championship games are all
// seasonType "regular" -- see the games-slate fix in git history for the investigation.
const SEASON_TYPE = 'regular';

// ---- small helpers --------------------------------------------------------------------------

function slugify(name) {
  // Strip diacritics rather than dropping the letter outright -- "San José State" should slug to
  // "san-jose-state", not "san-jos-state" (confirmed live: that team is real FBS/CFBD data, not
  // a hypothetical). NFD decomposes accented chars into base+combining-mark pairs; stripping the
  // combining-mark Unicode block leaves the plain base letter.
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// CFBD's /rankings response types `poll` as a bare string, not an enum (confirmed against the
// live OpenAPI spec -- components.schemas.Poll.poll is just `{type: "string"}`). The actual
// values it returns ("AP Top 25", "Coaches Poll", "Playoff Committee Rankings", plus lower-tier
// polls like AFCA Division II) are documented informally by downstream client libraries
// (cfbfastR). Matched case-insensitively/fuzzily so small wording drift doesn't silently break
// this script -- unrecognized polls are just skipped.
function classifyPoll(pollName) {
  const p = (pollName || '').toLowerCase();
  // CFBD started also returning FCS-level polls (e.g. "FCS Coaches Poll") in the same /rankings
  // response as the FBS ones -- confirmed live, 2026 week 1 suddenly added one alongside the real
  // "Coaches Poll" where only the FBS one existed before. A loose "coaches" substring match can't
  // tell them apart, and since both entries land in the same `polls` array for that week, whichever
  // one is processed second silently overwrites weekPolls[wk].coaches -- confirmed live, this
  // replaced the real Top 25 Coaches Poll with FCS teams (Montana State, Montana, ...) as the
  // resolved primary ranking. Exclude anything FCS-labeled outright; this app only ever tracks
  // FBS-level rankings, so there's never a legitimate reason for an FCS poll to match here.
  if (p.includes('fcs')) return null;
  if (p.includes('playoff committee') || p === 'cfp') return 'cfp';
  if (p.includes('coaches')) return 'coaches';
  if (p.includes('ap top') || p === 'ap') return 'ap';
  return null;
}

// ---- main -------------------------------------------------------------------------------

async function main() {
  mkdirSync(RANKINGS_DIR, { recursive: true });
  mkdirSync(RATINGS_DIR, { recursive: true });

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

  // Per-week primary-ranking fallback: CFP Committee if that week has it, else AP Top 25, else
  // Coaches Poll (CFBD's "USA Today Coaches Poll"). This is what every cross-team feature (Top 25
  // order, tiers, the Playoff Watch bracket, time-travel) actually ranks teams by -- not raw CFP,
  // because CFP doesn't exist for a real chunk of every season (weeks 1 through ~7-11). AP over
  // Coaches (flipped from the original CFP > Coaches > AP order) per explicit user preference --
  // AP is the more widely-recognized poll, so it should be primary whenever it's actually out,
  // with Coaches only as the fallback for the rare week AP hasn't published yet but Coaches has.
  function resolvePrimaryPoll(wk) {
    const p = weekPolls[wk] || {};
    if (p.cfp && p.cfp.length) return { order: p.cfp, source: 'cfp' };
    if (p.ap && p.ap.length) return { order: p.ap, source: 'ap' };
    if (p.coaches && p.coaches.length) return { order: p.coaches, source: 'coaches' };
    return null;
  }

  const weeksAvailable = Object.keys(weekPolls)
    .map(Number)
    .filter((wk) => resolvePrimaryPoll(wk) != null)
    .sort((a, b) => a - b);

  if (weeksAvailable.length === 0) {
    throw new Error(
      `CFBD /rankings returned data for season ${SEASON}, but none of it parsed into a usable ` +
      'AP/Coaches/CFP poll (see classifyPoll) -- nothing to rank teams by yet.',
    );
  }

  const currentWeek = weeksAvailable[weeksAvailable.length - 1];
  const allWeeksToDate = Array.from({ length: currentWeek }, (_, i) => i + 1); // 1..currentWeek

  // rankingsByWeek: every week with ANY poll data (not committee-only -- see above).
  const rankingsByWeek = {};
  for (const wk of weeksAvailable) {
    const primary = resolvePrimaryPoll(wk);
    rankingsByWeek[wk] = {
      ap: weekPolls[wk].ap || [],
      coaches: weekPolls[wk].coaches || [],
      cfp: weekPolls[wk].cfp || [],
      primary: primary.order,
      primarySource: primary.source,
    };
  }
  const currentSource = rankingsByWeek[currentWeek].primarySource;
  console.log(
    `Current week: ${currentWeek} (ranked by ${currentSource}). Weeks with poll data: ${weeksAvailable.join(', ')}.`,
  );

  // Hoisted up here (out of its original home in Step 6, "this week's slate") because Step 3's
  // games loop now needs it too, for upcoming (not-yet-played) games' opponent ranks -- there's no
  // historical per-week snapshot for a week that hasn't happened yet, so upcoming games fall back
  // to "opponent's current rank as of this fetch", same convention nextGameByTeam already uses.
  // Only depends on rankingsByWeek/currentWeek, both already resolved above, so nothing breaks by
  // moving it earlier.
  const currentPrimaryOrder = rankingsByWeek[currentWeek].primary;
  function currentRank(id) {
    const i = currentPrimaryOrder.indexOf(id);
    return i === -1 ? null : i + 1;
  }

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
    // `primary` already encodes the CFP -> Coaches -> AP fallback for that week (see
    // resolvePrimaryPoll above) -- this is the same ranking used everywhere else, so a "quality
    // win" in October (pre-committee, ranked by Coaches Poll) uses the same definition of
    // "ranked" as one in November (post-committee, ranked by CFP).
    const order = polls.primary;
    if (!Array.isArray(order)) return null;
    const idx = order.indexOf(opponentId);
    return idx === -1 ? null : idx + 1;
  }

  // ---- Step 3: games (full season -- records, per-team game logs, and this week's slate) ------
  console.log(`Fetching games for ${SEASON}...`);
  // ASSUMPTION: classification=fbs returns every game involving at least one FBS team (including
  // FBS-vs-FCS games, which we want for accurate records/schedules), not just FBS-vs-FBS games.
  // Not verified live -- worth a spot check once a key exists.
  const games = await cfbdGet('/games', { year: SEASON, seasonType: SEASON_TYPE, classification: 'fbs' });

  const teamGameLog = {}; // id -> [{ wk, opp, oppId, oppConf, oppRank, homeAway, when, res, tag, awayScore, homeScore }]
  const teamRecord = {}; // id -> { wins, losses }

  for (const g of games) {
    if (!g || !g.homeTeam || !g.awayTeam || typeof g.week !== 'number') continue;
    const homeId = slugify(g.homeTeam);
    const awayId = slugify(g.awayTeam);
    touchTeam(homeId, g.homeTeam, g.homeConference);
    touchTeam(awayId, g.awayTeam, g.awayConference);

    const completed = g.completed && g.homePoints != null && g.awayPoints != null;

    // teamRecord's win/loss counters increment for EVERY completed game regardless of week --
    // deliberately NOT gated by the `g.week >= weeksAvailable[0]` check below, which only ever
    // controls whether a teamGameLog entry gets pushed. Keep that separation: it's a real,
    // intentional distinction in this code, not something to unify.
    if (completed) {
      const homeWon = g.homePoints > g.awayPoints;
      teamRecord[homeId] = teamRecord[homeId] || { wins: 0, losses: 0 };
      teamRecord[awayId] = teamRecord[awayId] || { wins: 0, losses: 0 };
      if (homeWon) { teamRecord[homeId].wins += 1; teamRecord[awayId].losses += 1; }
      else { teamRecord[awayId].wins += 1; teamRecord[homeId].losses += 1; }
    }

    // Per-team game log only covers weeks with poll data (weeksAvailable[0] onward) -- that's
    // the only span the per-week snapshot files can cross-reference for a point-in-time
    // opponent rank. Early in a season this is the preseason poll week; once the CFP committee
    // starts, opponentRankAtWeek is already reading committee ranks for those weeks too. This now
    // covers BOTH completed and upcoming games -- the full regular-season schedule, not just
    // results to date -- so team pages can render a full slate. Completed games use the frozen
    // point-in-time opponent rank (opponentRankAtWeek); upcoming games have no such snapshot for a
    // week that hasn't happened yet, so they use the opponent's CURRENT rank instead (currentRank,
    // hoisted above for exactly this) -- same convention nextGameByTeam's opponentRank uses.
    if (g.week >= weeksAvailable[0]) {
      const homeWon = completed ? g.homePoints > g.awayPoints : null;
      const homeRes = completed ? (homeWon ? 'W' : 'L') : null;
      const awayRes = completed ? (homeWon ? 'L' : 'W') : null;
      const homeOppRank = completed ? opponentRankAtWeek(g.week, awayId) : currentRank(awayId);
      const awayOppRank = completed ? opponentRankAtWeek(g.week, homeId) : currentRank(homeId);
      const awayScore = completed ? g.awayPoints : null;
      const homeScore = completed ? g.homePoints : null;
      // oppConf lets the frontend derive an in-conference win-loss record (confRecord() in
      // src/data/teams.js) without fragile opponent-name matching -- captured here from the same
      // /games response already in hand, not re-looked-up. Filtered against the team's OWN
      // *current* conf at read time, so a past game against a since-realigned former conference
      // mate correctly stops counting once that mate has moved (see confRecord's comment).
      (teamGameLog[homeId] = teamGameLog[homeId] || []).push({
        wk: g.week, opp: g.awayTeam, oppId: awayId, oppConf: g.awayConference, oppRank: homeOppRank,
        homeAway: 'home', when: g.startDate || null,
        res: homeRes, tag: completed ? tagFor(homeRes, homeOppRank) : null,
        awayScore, homeScore,
      });
      (teamGameLog[awayId] = teamGameLog[awayId] || []).push({
        wk: g.week, opp: g.homeTeam, oppId: homeId, oppConf: g.homeConference, oppRank: awayOppRank,
        homeAway: 'away', when: g.startDate || null,
        res: awayRes, tag: completed ? tagFor(awayRes, awayOppRank) : null,
        awayScore, homeScore,
      });
    }
  }
  for (const id of Object.keys(teamGameLog)) teamGameLog[id].sort((a, b) => a.wk - b.wk);

  // NOTE: this used to compute a separately-derived `NEXT_WEEK` (first week >= currentWeek with
  // an incomplete game), on the theory that mid-season `NEXT_WEEK` naturally lands on
  // `currentWeek + 1` (this week's games done, next week's not yet). That theory was wrong: an AP/
  // Coaches "Week N" poll previews week N's games (built from week N-1's results), so the week
  // whose games are being previewed IS `currentWeek`, every week -- not just the preseason special
  // case this comment used to carve out. Confirmed against docs/data-schema.md's own example
  // (`currentWeek: 12`, `games[].id: "2026-wk12-osu-mich"`) and data/current.sample.json (same
  // pattern). The old NEXT_WEEK logic raced ahead of `currentWeek` in the real gap between "all of
  // this week's games finished" (Saturday night) and "next week's poll actually publishes" (Sunday/
  // Monday) -- during that gap it would start previewing next week's slate under this week's
  // still-active rankings, with zero trace of this week's just-finished results anywhere. Using
  // `currentWeek` directly ties the previewed slate to the same signal (poll availability) that
  // already gates everything else, so there's no separate week to keep in sync.

  // ---- Step 4: betting lines for the upcoming slate ----------------------------------------------
  console.log(`Fetching betting lines for week ${currentWeek}...`);
  const lines = await cfbdGet('/lines', { year: SEASON, seasonType: SEASON_TYPE, week: currentWeek });
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

  // ---- Step 4b: broadcast/streaming outlet for the upcoming slate --------------------------------
  // CFBD's /games endpoint has no TV/network field -- broadcast info lives on a separate
  // /games/media endpoint (confirmed against the live OpenAPI spec, components.schemas.GameMedia),
  // joined back to a game by its shared `id`. A game can have more than one media entry (e.g. a
  // regional/alt TV feed alongside a streaming simulcast) -- prefer mediaType "tv" over "web" since
  // "what channel is it on" is the question being asked; fall back to whatever's first (usually a
  // streaming-only outlet, e.g. "SECN+") when there's no over-the-air/cable feed at all.
  console.log(`Fetching broadcast info for week ${currentWeek}...`);
  const media = await cfbdGet('/games/media', { year: SEASON, seasonType: SEASON_TYPE, week: currentWeek, classification: 'fbs' });
  const mediaByGameId = new Map();
  for (const m of media) {
    if (!m || m.id == null) continue;
    if (!mediaByGameId.has(m.id)) mediaByGameId.set(m.id, []);
    mediaByGameId.get(m.id).push(m);
  }
  function pickNetwork(gameId) {
    const entries = mediaByGameId.get(gameId);
    if (!entries || !entries.length) return null;
    const tv = entries.find((m) => m.mediaType === 'tv');
    return (tv || entries[0]).outlet || null;
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

  // ---- Step 6: this week's slate (games under currentWeek's poll -- preview through final) ------
  const weekGames = games.filter((g) => g && g.week === currentWeek && g.seasonType === SEASON_TYPE);

  // Per-team "next matchup" -- built from the FULL weekGames list, not the top-6 slate Stage 1
  // trims `games` down to (score.mjs overwrites current.games, but teams[id].nextGame lives on
  // the team object and survives that trim). This is what lets "Your Teams" show every pinned
  // team's next opponent/kickoff/network, not just the handful in the "biggest games" panel.
  const nextGameByTeam = {};

  const gamesOut = weekGames.map((g) => {
    const awayId = slugify(g.awayTeam);
    const homeId = slugify(g.homeTeam);
    touchTeam(homeId, g.homeTeam, g.homeConference);
    touchTeam(awayId, g.awayTeam, g.awayConference);
    const line = pickLine(linesByGameId.get(g.id));
    const awayRank = currentRank(awayId);
    const homeRank = currentRank(homeId);
    const when = g.startDate || null;
    const network = pickNetwork(g.id);
    // `/games` only ever reports `completed`/final points -- never a true mid-game "in_progress"
    // state (that lived on CFBD's separate /scoreboard endpoint, now behind a paid tier we don't
    // have -- see scripts/lib/cfbd.mjs). So status here is only ever 'scheduled' or 'final'; any
    // "LIVE" state a visitor sees comes entirely from the client-side ESPN overlay
    // (src/utils/useLiveScores.js), never from this committed field.
    const status = g.completed ? 'final' : 'scheduled';
    const awayScore = g.completed ? g.awayPoints : null;
    const homeScore = g.completed ? g.homePoints : null;

    nextGameByTeam[awayId] = {
      opponent: g.homeTeam, opponentId: homeId, opponentRank: homeRank, homeAway: 'away', when, network,
      cfbdId: g.id, status, awayScore, homeScore,
    };
    nextGameByTeam[homeId] = {
      opponent: g.awayTeam, opponentId: awayId, opponentRank: awayRank, homeAway: 'home', when, network,
      cfbdId: g.id, status, awayScore, homeScore,
    };

    return {
      id: `${SEASON}-wk${currentWeek}-${awayId}-${homeId}`,
      cfbdId: g.id,
      away: awayId,
      awayRank,
      home: homeId,
      homeRank,
      when,
      // formattedSpread comes pre-formatted from CFBD (e.g. "Ohio State -6.5") -- using it
      // directly avoids guessing at CFBD's home/away spread-sign convention ourselves.
      spread: line && line.formattedSpread ? line.formattedSpread : null,
      ou: line && line.overUnder != null ? line.overUnder : null,
      network,
      rivalry: isRivalry(awayId, homeId),
      // 'scheduled' | 'in_progress' | 'final' -- only ever 'scheduled'/'final' here (see above).
      // 'in_progress' only ever exists transiently client-side, for the marquee panel -- see
      // src/utils/useLiveScores.js.
      status,
      awayScore,
      homeScore,
      period: null,
      clock: null,
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

  // ---- Step 9b: write this week's ratings snapshot file (append-only -- never overwrite) --------
  // The /ratings/* endpoints have no `week` parameter (see the RATINGS SNAPSHOTS note up top) --
  // this forward-only capture is the ONLY record of what the computers said in week N once week
  // N+1's fetch overwrites the live snapshot. Same write-once convention as Step 2's poll files.
  const ratingsSnapshotPath = join(RATINGS_DIR, `${SEASON}-wk${String(currentWeek).padStart(2, '0')}.json`);
  if (existsSync(ratingsSnapshotPath)) {
    console.log(`${ratingsSnapshotPath} already exists -- leaving it untouched (append-only historical record).`);
  } else {
    const ratingsSnapshot = {
      week: currentWeek,
      fetchedAt: new Date().toISOString(),
      sp: spById,
      fpi: fpiById,
      elo: eloById,
    };
    writeFileSync(ratingsSnapshotPath, JSON.stringify(ratingsSnapshot, null, 2) + '\n');
    console.log(`Wrote ${ratingsSnapshotPath}`);
  }

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

  // Exception to the "ranked or playing this week" rule above, for the 4 conferences the
  // Conference Tracker pages cover: a standings table needs every member team's entry, including
  // an unranked team sitting a bye week -- which the rules above would otherwise silently drop
  // from `teams{}` entirely (confirmed: this doesn't show up in week-1 data, where nearly every
  // FBS team has a game, but would in a later bye week). Free -- teamMeta already has name/conf
  // for virtually every FBS team from the full-season /games fetch (Step 3), no new API call.
  // Deliberately asymmetric: only guarantees full rosters for these 4 conferences, leaving every
  // other conference's team universe exactly as the rule above already defines it.
  const POWER4_CONFS = new Set(['Big Ten', 'SEC', 'ACC', 'Big 12']);
  for (const [id, meta] of Object.entries(teamMeta)) {
    if (meta.conf && POWER4_CONFS.has(meta.conf)) teamIds.add(id);
  }

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
      // Pure filesystem check, no network call -- true if scripts/fetch-team-logos.mjs (a separate,
      // manually-triggered script) has already dropped a logo for this team at public/logos/{id}.png.
      // That script may or may not have run yet, so this just reflects whatever's on disk right now.
      hasLogo: existsSync(join(ROOT, 'public', 'logos', `${id}.png`)),
      ap: apArr,
      coaches: coachesArr,
      cfp: cfpArr,
      games: teamGameLog[id] || [],
      // null when this team has no game in currentWeek's slate (bye week, or a team with no more
      // games left on CFBD's schedule for the season).
      nextGame: nextGameByTeam[id] || null,
    };
  }

  // ---- Step 11: assemble + write current.json ----------------------------------------------------
  const out = {
    meta: {
      season: SEASON,
      currentWeek,
      // Which poll currentWeek's rankings/tiers/bracket are actually built from -- 'cfp' most of
      // the season, 'coaches' (or, rarely, 'ap') for the weeks before the committee's first
      // reveal. The frontend uses this to label things honestly (e.g. "Coaches Poll" instead of
      // a hardcoded "CFP Committee") rather than pretend it's always committee data.
      currentPrimarySource: currentSource,
      lastUpdated: new Date().toISOString(),
      weeksAvailable,
    },
    rankingsByWeek,
    teams,
    // Full current-week slate (~90-100 games), not just the marquee panel -- games[] below is a
    // pure SUBSET of this, selected by Stage 1 scoring. Kept here rather than discarded so a
    // Conference Tracker page can show every one of a conference's games this week, not just
    // whichever happened to make the sitewide top 6.
    allGames: gamesOut,
    // populated by downstream Stage 1 scoring script (task #6), which doesn't exist yet -- becomes
    // the top-6-by-stakesScore subset of allGames above, in place, not a separate fetch.
    games: [],
    predictions: [],
  };

  const outPath = join(DATA_DIR, 'current.json');
  writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
  console.log(`Wrote ${outPath} (${Object.keys(teams).length} teams, ${gamesOut.length} games in the full weekly slate).`);
}

main().catch((err) => {
  console.error('fetch-cfb-data failed:', err && err.stack ? err.stack : err);
  process.exit(1);
});
