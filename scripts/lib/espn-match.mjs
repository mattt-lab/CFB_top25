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

function espnDateParam(date) {
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(date.getUTCDate()).padStart(2, '0')}`;
}

// Confirmed live 2026-09-12: ESPN's DATELESS scoreboard (no `dates` param) applies some
// undocumented "current window" heuristic that can silently OMIT a real, currently-relevant
// game -- a ranked FBS team hosting an FCS opponent was missing entirely from the dateless
// response while genuinely in progress, though the exact same query WITH an explicit dates=
// range correctly included it. Scopes every fetch to the actual span of tracked kickoffs, padded
// a day on each side, instead of hoping the undocumented default happens to cover whatever's
// being enriched this run. Same fix, same reasoning, as src/utils/useLiveScores.js's
// scoreboardUrl() (this file's own client-side counterpart) -- `baseUrl` is passed in rather than
// hardcoded here since the actual endpoint string lives in narrate.mjs, matching where
// espnSummaryUrl's own URL construction already lives.
export function buildScoreboardUrl(games, baseUrl) {
  const times = games.map((g) => Date.parse(g.when)).filter((t) => !Number.isNaN(t));
  if (!times.length) return baseUrl;
  const dayMs = 24 * 60 * 60 * 1000;
  const from = espnDateParam(new Date(Math.min(...times) - dayMs));
  const to = espnDateParam(new Date(Math.max(...times) + dayMs));
  return `${baseUrl}&dates=${from === to ? from : `${from}-${to}`}`;
}
