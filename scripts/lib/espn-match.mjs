// Server-side counterpart to src/utils/useLiveScores.js's matchLiveGames -- maps one of our own
// games (away/home team ids) to the ESPN event covering that same game, via the same
// espnTeamMap.json team-id lookup and the same rematch disambiguation (closest to our own tracked
// kickoff time when a pair has two real events in one dateless scoreboard window).
//
// Deliberately simpler than the client's version: this runs once a day to fetch a game's
// recap/pregame detail, not continuously polled for a live score, so a rare mismatch just means
// that one game falls back to the plain spread-based blurb instead of the enriched one -- an
// acceptable degradation, not a wrong "live" score shown to a visitor. No per-game try/catch here
// either -- the caller (narrate.mjs) already wraps each game's whole enrichment attempt in one.

// ESPN team id (string) -> every event that team appears in this scoreboard response. Same
// multi-day-window reasoning as the client's version: NOT a single last-write-wins slot per team.
export function buildEventsByEspnTeamId(espnScoreboard) {
  const map = new Map();
  for (const event of espnScoreboard?.events ?? []) {
    const competitors = event.competitions?.[0]?.competitors ?? [];
    for (const c of competitors) {
      if (!c.team?.id) continue;
      const key = String(c.team.id);
      let set = map.get(key);
      if (!set) map.set(key, (set = new Set()));
      set.add(event);
    }
  }
  return map;
}

// Returns the matching ESPN event's numeric id, or null if no confident match exists (either
// team missing from espnTeamMap, no shared event, or -- with no `when` to disambiguate multiple
// same-pair candidates -- just takes the first one).
export function findEspnEventId(game, eventsByEspnTeamId, espnTeamMap) {
  const awayEspnId = espnTeamMap[game.away];
  const homeEspnId = espnTeamMap[game.home];
  if (!awayEspnId || !homeEspnId) return null;
  const awayEvents = eventsByEspnTeamId.get(awayEspnId);
  const homeEvents = eventsByEspnTeamId.get(homeEspnId);
  if (!awayEvents || !homeEvents) return null;
  const candidates = [...awayEvents].filter((e) => homeEvents.has(e));
  if (!candidates.length) return null;
  if (candidates.length === 1 || !game.when) return candidates[0].id;

  const target = Date.parse(game.when);
  if (Number.isNaN(target)) return candidates[0].id;
  let best = candidates[0];
  let bestDelta = Infinity;
  for (const c of candidates) {
    const d = Date.parse(c.date);
    if (Number.isNaN(d)) continue;
    const delta = Math.abs(d - target);
    if (delta < bestDelta) { bestDelta = delta; best = c; }
  }
  return best.id;
}

// ESPN files every event under a US-Eastern calendar day -- confirmed live 2026-09-19:
// dates=20260919 returned events from 15:30Z Saturday through 03:00Z Sunday (8pm-11pm ET Saturday
// games included) and dates=20260920 returned none. Same reasoning, same code, as
// src/utils/useLiveScores.js's scoreboardUrls() (this file's own client-side counterpart).
const ESPN_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
});
const espnDay = (ms) => ESPN_DAY.format(ms).replaceAll('-', '');
// A kickoff just after midnight ET might be filed under the night before -- no such game was on
// the board to check, so also ask for the day 6h earlier rather than assume (same day, i.e. no
// extra request, for any ordinary kickoff).
const LATE_NIGHT_LOOKBACK_MS = 6 * 60 * 60 * 1000;

// One URL per ESPN day the tracked games fall on. Never a `dates=A-B` range: as of 2026-09-19 ESPN
// answers EVERY range with HTTP 400 {"message":"Failed to get events endpoint."} while single-day
// queries still return 200 -- narrate.mjs's fetchEspnEnrichment caught that 400 and silently
// skipped every recap/predictor for the run. Explicit per-day dates (rather than the dateless
// default) are still needed because ESPN's dateless "current window" can silently OMIT a real
// game -- confirmed live 2026-09-12 with a ranked FBS team hosting an FCS opponent. Falls back to
// the plain base URL only if no tracked game has a parseable `when` at all. `baseUrl` is passed in
// rather than hardcoded here since the actual endpoint string lives in narrate.mjs, matching where
// espnSummaryUrl's own URL construction already lives.
export function buildScoreboardUrls(games, baseUrl) {
  const days = new Set();
  for (const g of games) {
    const t = Date.parse(g.when);
    if (Number.isNaN(t)) continue;
    days.add(espnDay(t));
    days.add(espnDay(t - LATE_NIGHT_LOOKBACK_MS));
  }
  if (!days.size) return [baseUrl];
  return [...days].sort().map((d) => `${baseUrl}&dates=${d}`);
}
