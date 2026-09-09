// Client-side live-score overlay for the homepage marquee panel ("games" in src/data/teams.js).
// Runs entirely in the visitor's browser -- fetches ESPN's public scoreboard directly from their
// own connection (no server, no proxy; see espnTeamMap.json's header comment for why this exists:
// CFBD's /scoreboard now requires a paid Patreon tier, so the old server-side poller is gone).
//
// data/current.json (baked in at build time) stays the source of truth for everything else --
// this only patches status/period/clock/scores onto the ~6 marquee games, in memory, per visitor.
// A game this can't confidently match (see matchLiveGames) just keeps whatever the last deploy
// already committed.

import { useEffect, useRef, useState } from 'react';
import espnTeamMap from '../data/espnTeamMap.json';

const SCOREBOARD_URL =
  'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?groups=80&limit=150';
const POLL_MS = 60_000;
// How long before/after a tracked game's kickoff to keep polling even though it isn't (yet, or
// still) reporting in_progress -- covers a page opened well before kickoff (which used to make
// exactly one call and then go silent through the entire game, since nothing was live YET at
// that first fetch) and a game whose ESPN status is lagging right around its scheduled start.
const KICKOFF_WINDOW_MS = 4 * 60 * 60 * 1000;
const MAX_BACKOFF_MS = 5 * POLL_MS;

// Number(undefined) is NaN, not an error -- ESPN can transiently omit a score field on a live
// event. A NaN score rendered as "NaN – NaN" reads as broken; fall back to null (the same "we
// don't actually know" signal a skipped/unmatched game already uses) instead.
function safeScore(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Pure: given our marquee games[] and a raw ESPN scoreboard response, returns
// { [gameId]: { status, period, clock, awayScore, homeScore } } for every game it could match.
// A game is skipped (absent from the result) if either team has no ESPN id in espnTeamMap, no
// ESPN event contains both teams, or that event's shape is malformed (see the per-game try/catch
// below) -- callers should merge this onto the static game, not replace it.
export function matchLiveGames(games, espnScoreboard, teamMap = espnTeamMap) {
  const events = espnScoreboard?.events ?? [];
  // ESPN team id (string) -> every event that team appears in. NOT a single last-write-wins slot
  // per team -- confirmed live that ESPN's scoreboard with no `dates` param can return a window
  // spanning more than one calendar day (e.g. early season, a team's just-played game AND its
  // following week's game both came back in the same response). A flat one-event map let whichever
  // event happened to iterate last silently clobber a team's real, live match.
  const eventsByEspnTeamId = new Map();
  for (const event of events) {
    const competitors = event.competitions?.[0]?.competitors ?? [];
    for (const c of competitors) {
      if (!c.team?.id) continue;
      const key = String(c.team.id);
      let set = eventsByEspnTeamId.get(key);
      if (!set) eventsByEspnTeamId.set(key, (set = new Set()));
      set.add(event);
    }
  }

  const overlay = {};
  for (const g of games) {
    // A malformed event for THIS game (e.g. a postponed/cancelled ESPN event with an empty
    // competitions array) must not abort the whole batch -- every other game in this tick still
    // has a real update waiting. Isolated per-game rather than one try/catch around the loop.
    try {
      const awayEspnId = teamMap[g.away];
      const homeEspnId = teamMap[g.home];
      if (!awayEspnId || !homeEspnId) continue;
      const awayEvents = eventsByEspnTeamId.get(awayEspnId);
      const homeEvents = eventsByEspnTeamId.get(homeEspnId);
      if (!awayEvents || !homeEvents) continue;
      // The one event both teams actually share -- correct regardless of how many OTHER events
      // either team separately appears in.
      const event = [...awayEvents].find((e) => homeEvents.has(e));
      if (!event) continue;

      const competition = event.competitions[0];
      const competitors = competition.competitors;
      const away = competitors.find((c) => String(c.team.id) === awayEspnId);
      const home = competitors.find((c) => String(c.team.id) === homeEspnId);
      if (!away || !home) continue;

      const state = competition.status?.type?.state; // 'pre' | 'in' | 'post'
      const status = state === 'post' ? 'final' : state === 'in' ? 'in_progress' : 'scheduled';
      overlay[g.id] = {
        status,
        period: status === 'in_progress' ? (competition.status?.period ?? null) : null,
        clock: status === 'in_progress' ? (competition.status?.displayClock ?? null) : null,
        awayScore: status === 'scheduled' ? null : safeScore(away.score),
        homeScore: status === 'scheduled' ? null : safeScore(home.score),
      };
    } catch (err) {
      console.warn(`matchLiveGames: skipping game ${g.id}, malformed ESPN event`, err);
    }
  }
  return overlay;
}

// Adapts a team's nextGame (opponent-relative: opponentId + homeAway) into the away/home-relative
// {id, away, home, when} shape matchLiveGames/needsPolling expect, so the SAME matcher/hook serves
// both the marquee panel (already away/home-relative) and a team's next-game card. `id` is the
// owning team's own id -- unlike a marquee game, there's no natural shared game id here, but each
// team only ever needs to look up its own overlay entry, so using teamId as the key is sufficient
// and collision-free. Returns null (skip -- no live overlay possible) for a bye week or a
// pre-opponentId-field snapshot.
export function toPseudoGame(teamId, nextGame) {
  if (!nextGame?.opponentId) return null;
  const when = nextGame.when ?? null;
  return nextGame.homeAway === 'home'
    ? { id: teamId, away: nextGame.opponentId, home: teamId, when }
    : { id: teamId, away: teamId, home: nextGame.opponentId, when };
}

// Whether ANY tracked game still needs another poll: already in_progress, or its kickoff is
// within KICKOFF_WINDOW_MS of now (covers both "not live yet" and "ESPN hasn't reported it live
// yet even though kickoff passed"). A game already known 'final' doesn't need re-checking. A game
// with no `when` at all (shouldn't normally happen, but degrade safely) keeps polling rather than
// silently going stale.
export function needsPolling(games, overlay, now = Date.now()) {
  return games.some((g) => {
    const entry = overlay[g.id];
    if (entry?.status === 'final') return false;
    if (entry?.status === 'in_progress') return true;
    if (!g.when) return true;
    const kickoff = Date.parse(g.when);
    if (Number.isNaN(kickoff)) return true;
    return Math.abs(kickoff - now) < KICKOFF_WINDOW_MS;
  });
}

// Fetches once when the tracked game(s) change, then keeps polling every POLL_MS as long as
// needsPolling says there's still a reason to (live, or within the kickoff window) AND the tab is
// visible -- a genuinely idle page (everything final, or every kickoff far in the future) makes
// exactly one call. A failed fetch retries with exponential backoff (capped at MAX_BACKOFF_MS)
// instead of going permanently silent -- a transient ESPN hiccup shouldn't mean a visitor who
// opened the page early never sees a live score for the rest of the game.
//
// Keyed off a content SIGNATURE, not just mount: the marquee panel's `games` list is fixed for a
// page's lifetime (mount-once is correct there), but a team-detail page's caller re-renders the
// SAME mounted component with a different team's nextGame when the visitor navigates between team
// pages (React Router doesn't remount on a param-only route change) -- without re-keying on the
// actual games being tracked, this would keep showing whichever team's game it fetched first.
export function useLiveScores(games) {
  const [overlay, setOverlay] = useState({});
  const gamesRef = useRef(games);
  const overlayRef = useRef(overlay);
  const signature = games.map((g) => `${g.id}:${g.away}:${g.home}`).join(',');

  // Keeps gamesRef pointing at the LATEST games array (a parent re-render can hand this hook a
  // new array reference with the same logical content, without the signature above changing) so
  // the long-lived tick() closure below always reads current data -- but as a commit-phase effect,
  // not a synchronous write in the render body, which React's own rules disallow outside lazy
  // initialization.
  useEffect(() => {
    gamesRef.current = games;
  });

  useEffect(() => {
    if (!gamesRef.current.length) {
      setOverlay({}); // nothing to track (e.g. a bye week) -- skip the fetch entirely
      return;
    }
    let cancelled = false;
    let timer = null;
    let backoffMs = POLL_MS;

    function scheduleIfNeeded(overlayForCheck) {
      if (cancelled || !needsPolling(gamesRef.current, overlayForCheck, Date.now())) return;
      if (document.visibilityState !== 'visible') return;
      timer = setTimeout(tick, backoffMs);
    }

    async function tick() {
      timer = null;
      try {
        const res = await fetch(SCOREBOARD_URL);
        if (!res.ok) throw new Error(`ESPN scoreboard HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        const next = matchLiveGames(gamesRef.current, data);
        overlayRef.current = next;
        setOverlay(next);
        backoffMs = POLL_MS; // reset after a successful fetch
        scheduleIfNeeded(next);
      } catch (err) {
        console.warn('useLiveScores: fetch failed, retrying with backoff', err);
        if (cancelled) return;
        backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
        // Retry against the last known overlay -- a transient failure doesn't change whether a
        // tracked game is still live/upcoming, so the same "do we still need to check" logic
        // applies to the pre-failure state.
        scheduleIfNeeded(overlayRef.current);
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        if (!timer) tick(); // came back with no poll pending -- refresh right away
      } else if (timer) {
        clearTimeout(timer); // backgrounded -- cancel the pending poll rather than let it fire hidden
        timer = null;
      }
    }

    tick();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [signature]);

  return overlay;
}
