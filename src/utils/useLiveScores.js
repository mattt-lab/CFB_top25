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

// Pure: given our marquee games[] and a raw ESPN scoreboard response, returns
// { [gameId]: { status, period, clock, awayScore, homeScore } } for every game it could match.
// A game is skipped (absent from the result) if either team has no ESPN id in espnTeamMap, or no
// ESPN event contains both teams -- callers should merge this onto the static game, not replace it.
export function matchLiveGames(games, espnScoreboard, teamMap = espnTeamMap) {
  const events = espnScoreboard?.events ?? [];
  // ESPN team id (string) -> event, for O(1) lookup instead of scanning events per game.
  const eventByEspnTeamId = new Map();
  for (const event of events) {
    const competitors = event.competitions?.[0]?.competitors ?? [];
    for (const c of competitors) {
      if (c.team?.id) eventByEspnTeamId.set(String(c.team.id), event);
    }
  }

  const overlay = {};
  for (const g of games) {
    const awayEspnId = teamMap[g.away];
    const homeEspnId = teamMap[g.home];
    if (!awayEspnId || !homeEspnId) continue;
    const event = eventByEspnTeamId.get(awayEspnId);
    if (!event || event !== eventByEspnTeamId.get(homeEspnId)) continue; // same event, both sides

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
      awayScore: status === 'scheduled' ? null : Number(away.score),
      homeScore: status === 'scheduled' ? null : Number(home.score),
    };
  }
  return overlay;
}

// Adapts a team's nextGame (opponent-relative: opponentId + homeAway) into the away/home-relative
// {id, away, home} shape matchLiveGames expects, so the SAME matcher/hook serves both the marquee
// panel (already away/home-relative) and a team's next-game card. `id` is the owning team's own id
// -- unlike a marquee game, there's no natural shared game id here, but each team only ever needs
// to look up its own overlay entry, so using teamId as the key is sufficient and collision-free.
// Returns null (skip -- no live overlay possible) for a bye week or a pre-opponentId-field snapshot.
export function toPseudoGame(teamId, nextGame) {
  if (!nextGame?.opponentId) return null;
  return nextGame.homeAway === 'home'
    ? { id: teamId, away: nextGame.opponentId, home: teamId }
    : { id: teamId, away: teamId, home: nextGame.opponentId };
}

// Fetches once when the tracked game(s) change, then polls every POLL_MS ONLY while at least one
// matched game is in_progress AND the tab is visible -- an idle/pre-kickoff/all-final page makes
// exactly one call. Never throws: a failed fetch or unmatched game just leaves the static
// data/current.json values in place (see the header comment).
//
// Keyed off a content SIGNATURE, not just mount: the marquee panel's `games` list is fixed for a
// page's lifetime (mount-once is correct there), but a team-detail page's caller re-renders the
// SAME mounted component with a different team's nextGame when the visitor navigates between team
// pages (React Router doesn't remount on a param-only route change) -- without re-keying on the
// actual games being tracked, this would keep showing whichever team's game it fetched first.
export function useLiveScores(games) {
  const [overlay, setOverlay] = useState({});
  const gamesRef = useRef(games);
  gamesRef.current = games;
  const signature = games.map((g) => `${g.id}:${g.away}:${g.home}`).join(',');

  useEffect(() => {
    if (!gamesRef.current.length) {
      setOverlay({}); // nothing to track (e.g. a bye week) -- skip the fetch entirely
      return;
    }
    let cancelled = false;
    let timer = null;

    async function tick() {
      try {
        const res = await fetch(SCOREBOARD_URL);
        if (!res.ok) throw new Error(`ESPN scoreboard HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        const next = matchLiveGames(gamesRef.current, data);
        setOverlay(next);
        const anyLive = Object.values(next).some((g) => g.status === 'in_progress');
        if (anyLive && document.visibilityState === 'visible') {
          timer = setTimeout(tick, POLL_MS);
        }
      } catch (err) {
        console.warn('useLiveScores: fetch failed, keeping last known state', err);
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        if (!timer) tick(); // came back to a live game with no poll pending -- refresh right away
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
