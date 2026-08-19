// Lightweight game-day companion to fetch-cfb-data.mjs -- runs frequently (every ~15 min, only
// during real game windows -- see .github/workflows/fetch-live-scores.yml) to patch live/final
// score, status, period, and clock into data/current.json between the heavy pipeline's once-daily
// runs. Patches BOTH the marquee `games[]` panel and the full weekly `allGames[]` slate (so a
// Conference Tracker page's schedule section shows live state too), plus every team's `nextGame`.
// Never calls Claude, never re-scores or re-selects anything Stage 1 already picked -- it
// only patches chrome onto games the heavy pipeline already knows about, plus a one-time
// deterministic settle (win/loss, game-log entry, a plain recap sentence) the moment a game first
// goes final. The nicer LLM recap arrives later, whenever narrate.mjs (now status-aware) next runs.
//
// Uses CFBD's /scoreboard endpoint, NOT /games -- /games (used by fetch-cfb-data.mjs) only ever
// reports a final `completed` flag + final points, with zero visibility into a game that's
// currently being played. /scoreboard returns every currently-relevant game in ONE call (not
// per-game), including true in-progress status/period/clock/live score -- see the live-score
// architecture plan for the full investigation. It also means every tick, live or not, costs
// exactly one CFBD call, which is why the guard below (skip entirely when nothing's actually near
// kickoff) is about avoiding *wasted* ticks, not about controlling per-game cost.
//
// Run with: node scripts/fetch-live-scores.mjs   (after fetch-cfb-data.mjs has run at least once
// this week, so teams[id].nextGame/games[] already have cfbdId to match against)
//
// Requires CFBD_API_KEY. Does NOT require ANTHROPIC_API_KEY -- this script never calls Claude.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execSync } from 'node:child_process';
import { cfbdGet } from './lib/cfbd.mjs';
import { tagFor, resultFor } from './lib/game-log.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CURRENT_PATH = join(ROOT, 'data', 'current.json');

// Only bother calling /scoreboard if some tracked game could plausibly be live or about to be --
// avoids wasting a call during the dead middle of a cron window before/after the actual kickoff
// cluster, without needing hardcoded season/calendar logic (the cron schedule already handles the
// coarse "which days" question; this handles the fine "is anything actually happening" one).
const GUARD_WINDOW_MS = 18 * 60 * 60 * 1000;

function mapStatus(cfbdStatus) {
  if (cfbdStatus === 'completed') return 'final';
  if (cfbdStatus === 'in_progress') return 'in_progress';
  return 'scheduled';
}

// Every team playing this week has a `nextGame` (built by fetch-cfb-data.mjs from the FULL
// current-week slate, before Stage 1 trims `games[]` down to the top 6) -- walking `teams` instead
// of the trimmed `games[]` array is what lets this script settle records/game-logs for every game
// this week, not just the ~12 teams in the marquee panel. Deduped by cfbdId since each game
// produces two nextGame entries, one per participant.
function buildCanonicalGames(current) {
  const primaryOrder = current.rankingsByWeek[String(current.meta.currentWeek)]?.primary ?? [];
  const rankOf = (id) => {
    const i = primaryOrder.indexOf(id);
    return i === -1 ? null : i + 1;
  };

  const canonical = new Map(); // cfbdId -> { cfbdId, when, status, awayScore, homeScore, period, clock, awayId, awayRank, homeId, homeRank }
  for (const [teamId, t] of Object.entries(current.teams)) {
    const ng = t.nextGame;
    if (!ng || ng.cfbdId == null) continue;
    let entry = canonical.get(ng.cfbdId);
    if (!entry) {
      entry = {
        cfbdId: ng.cfbdId, when: ng.when, status: ng.status,
        // Carry the PREVIOUS score/period/clock too, not just status -- needed so the "did
        // anything actually change" check below compares against real prior values instead of
        // `undefined`, which would otherwise report a change on every tick even when nothing moved.
        awayScore: ng.awayScore ?? null, homeScore: ng.homeScore ?? null,
        period: ng.period ?? null, clock: ng.clock ?? null,
        awayId: null, awayRank: null, homeId: null, homeRank: null,
      };
      canonical.set(ng.cfbdId, entry);
    }
    if (ng.homeAway === 'home') { entry.homeId = teamId; entry.homeRank = rankOf(teamId); }
    else { entry.awayId = teamId; entry.awayRank = rankOf(teamId); }
  }
  return canonical;
}

function needsCheck(canonical, now) {
  for (const g of canonical.values()) {
    if (g.status === 'final') continue;
    if (!g.when) continue;
    if (Math.abs(new Date(g.when).getTime() - now.getTime()) <= GUARD_WINDOW_MS) return true;
  }
  return false;
}

function teamLabel(current, teamId, rank) {
  const name = current.teams[teamId]?.name ?? teamId;
  return rank != null ? `#${rank} ${name}` : name;
}

// fetch-cfb-data.mjs (the once-daily heavy pipeline) now writes an "upcoming" teamGameLog entry
// (res: null) for every game on the full-season schedule, including this week's -- so by the time
// a game we're tracking goes final, there's almost always already a matching entry sitting in
// teams[id].games[] for this exact week/opponent. Update that entry in place instead of pushing a
// second one, or the team's schedule would show a duplicate row (one stale res:null, one final)
// until tomorrow's pipeline run overwrites teams{} from scratch. Falls back to a push in the OLD
// lean shape only for a `current.json` that predates this feature and never got an upcoming entry
// written for this game -- short-lived either way, same reason.
function settleGameLogEntry(teamGames, wk, oppName, res, tag, awayScore, homeScore, fallbackOppRank) {
  const idx = teamGames.findIndex((g) => g.wk === wk && g.opp === oppName);
  if (idx === -1) {
    teamGames.push({ wk, opp: oppName, oppConf: null, oppRank: fallbackOppRank, res, tag, awayScore, homeScore });
    return;
  }
  teamGames[idx] = { ...teamGames[idx], res, tag, awayScore, homeScore };
}

// Pure: takes a `current` object and the raw /scoreboard response, returns a freshly-cloned,
// patched `current` plus whether anything actually changed. Never mutates its input -- needed so
// the git-race retry loop below can call this again against a freshly-reset base without paying
// for another /scoreboard call (the response is already in hand).
export function applyScoreboardPatch(current, scoreboardGames) {
  const patched = structuredClone(current);
  const canonical = buildCanonicalGames(patched);
  const sbById = new Map(scoreboardGames.map((g) => [g.id, g]));
  const updates = new Map(); // cfbdId -> { status, awayScore, homeScore, period, clock, settledBlurb? }
  const summary = [];
  let changed = false;

  for (const entry of canonical.values()) {
    const sb = sbById.get(entry.cfbdId);
    if (!sb) continue; // not on the current scoreboard snapshot this tick -- leave untouched

    const newStatus = mapStatus(sb.status);
    const newAwayScore = sb.awayTeam?.points ?? null;
    const newHomeScore = sb.homeTeam?.points ?? null;
    const newPeriod = sb.period ?? null;
    const newClock = sb.clock ?? null;
    const update = { status: newStatus, awayScore: newAwayScore, homeScore: newHomeScore, period: newPeriod, clock: newClock };

    const justWentFinal = entry.status !== 'final' && newStatus === 'final'
      && entry.awayId && entry.homeId && newAwayScore != null && newHomeScore != null;

    if (justWentFinal) {
      const homeTeam = patched.teams[entry.homeId];
      const awayTeam = patched.teams[entry.awayId];
      const { home: homeRes, away: awayRes } = resultFor(newHomeScore, newAwayScore);
      if (homeRes === 'W') { homeTeam.wins += 1; awayTeam.losses += 1; }
      else { awayTeam.wins += 1; homeTeam.losses += 1; }
      // oppConf here (not re-derived) matches fetch-cfb-data.mjs's game-log entries exactly --
      // without it, a game settled by this script would carry a temporary gap in confRecord()
      // (src/data/teams.js) until the next daily pipeline run overwrites teams{} from scratch.
      settleGameLogEntry(
        homeTeam.games, patched.meta.currentWeek, awayTeam.name,
        homeRes, tagFor(homeRes, entry.awayRank), newAwayScore, newHomeScore, entry.awayRank,
      );
      settleGameLogEntry(
        awayTeam.games, patched.meta.currentWeek, homeTeam.name,
        awayRes, tagFor(awayRes, entry.homeRank), newAwayScore, newHomeScore, entry.homeRank,
      );
      const awayLabel = teamLabel(patched, entry.awayId, entry.awayRank);
      const homeLabel = teamLabel(patched, entry.homeId, entry.homeRank);
      update.settledBlurb = `Final: ${awayLabel} ${newAwayScore}, ${homeLabel} ${newHomeScore}.`;
      summary.push(`Settled: ${awayLabel} ${newAwayScore} @ ${homeLabel} ${newHomeScore}`);
      changed = true;
    }

    if (entry.status !== newStatus || entry.awayScore !== newAwayScore
      || entry.homeScore !== newHomeScore || entry.period !== newPeriod || entry.clock !== newClock) {
      changed = true;
    }

    updates.set(entry.cfbdId, update);
  }

  if (!changed) return { current: patched, changed: false, summary };

  patched.games = patched.games.map((g) => {
    const u = updates.get(g.cfbdId);
    if (!u) return g;
    return {
      ...g,
      status: u.status, awayScore: u.awayScore, homeScore: u.homeScore, period: u.period, clock: u.clock,
      blurb: u.settledBlurb ?? g.blurb,
      blurbSource: u.settledBlurb ? 'fallback' : g.blurbSource,
    };
  });

  // Same patch, applied to the full weekly slate (not just the marquee 6) so a Conference Tracker
  // page's schedule section shows live/final state too. `?? []` guards a stray snapshot predating
  // this field -- matches this file's existing defensiveness elsewhere (e.g. the `ng.cfbdId == null`
  // guards below).
  patched.allGames = (patched.allGames ?? []).map((g) => {
    const u = updates.get(g.cfbdId);
    if (!u) return g;
    return {
      ...g,
      status: u.status, awayScore: u.awayScore, homeScore: u.homeScore, period: u.period, clock: u.clock,
      blurb: u.settledBlurb ?? g.blurb,
      blurbSource: u.settledBlurb ? 'fallback' : g.blurbSource,
    };
  });

  for (const t of Object.values(patched.teams)) {
    const ng = t.nextGame;
    if (!ng || ng.cfbdId == null) continue;
    const u = updates.get(ng.cfbdId);
    if (!u) continue;
    t.nextGame = {
      ...ng,
      status: u.status, awayScore: u.awayScore, homeScore: u.homeScore, period: u.period, clock: u.clock,
    };
  }

  return { current: patched, changed: true, summary };
}

const MAX_PUSH_ATTEMPTS = 5;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function commitAndPush(scoreboardGames) {
  for (let attempt = 1; attempt <= MAX_PUSH_ATTEMPTS; attempt++) {
    const current = JSON.parse(readFileSync(CURRENT_PATH, 'utf8'));
    const { current: patched, changed, summary } = applyScoreboardPatch(current, scoreboardGames);

    if (!changed) {
      console.log('No live-score changes this tick.');
      return;
    }

    writeFileSync(CURRENT_PATH, JSON.stringify(patched, null, 2) + '\n');
    if (summary.length) console.log(summary.join('\n'));

    try {
      execSync('git add data/current.json', { cwd: ROOT, stdio: 'inherit' });
      execSync(`git commit -m "Live scores (${new Date().toISOString()})"`, { cwd: ROOT, stdio: 'inherit' });
      execSync('git push', { cwd: ROOT, stdio: 'inherit' });
      console.log('Pushed.');
      return;
    } catch (err) {
      console.warn(`Push attempt ${attempt}/${MAX_PUSH_ATTEMPTS} failed: ${err.message}`);
      if (attempt === MAX_PUSH_ATTEMPTS) {
        throw new Error('Exhausted retries pushing live-score update.');
      }
      // Discard-and-recompute, not rebase: this script and the heavy pipeline both do a full-file
      // JSON.stringify rewrite of current.json, so two concurrent writes guarantee a full-file
      // textual conflict -- a rebase would fail to auto-merge essentially every time this fires,
      // not occasionally. Cheaper and more reliable to just throw away the local commit, fast-
      // forward to whatever's now on origin, and reapply the SAME in-memory /scoreboard response
      // (already paid for -- no new API call) against that fresh base on the next loop iteration.
      execSync('git fetch origin main', { cwd: ROOT, stdio: 'inherit' });
      execSync('git reset --hard origin/main', { cwd: ROOT, stdio: 'inherit' });
      await sleep(2000 * attempt + Math.random() * 1000);
    }
  }
}

async function main() {
  const current = JSON.parse(readFileSync(CURRENT_PATH, 'utf8'));
  const canonical = buildCanonicalGames(current);
  const now = new Date();

  if (!needsCheck(canonical, now)) {
    console.log('No tracked game is live or within the check window -- skipping /scoreboard.');
    return;
  }

  console.log(`Checking /scoreboard for ${canonical.size} tracked game(s)...`);
  const scoreboard = await cfbdGet('/scoreboard', { classification: 'fbs' });
  await commitAndPush(scoreboard);
}

main().catch((err) => {
  console.error('fetch-live-scores failed:', err && err.stack ? err.stack : err);
  process.exit(1);
});
