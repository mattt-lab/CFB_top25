// The data-prep half of the Top 25 Pick 'em page, extracted from Pickem.jsx so the SAME code feeds
// both the page and the Node snapshot/review scripts (scripts/snapshot-pickem.mjs). Pure: no
// imports of data/current.json or React, everything arrives via arguments -- the page passes in
// its live-merged games, the script passes in current.json plus an ESPN overlay. Keeping one copy
// is the whole point: a snapshot is only worth reviewing if it is exactly what the page showed.

// Real result -> pick category, once a team's game is final. Margin >= 14 either way counts as a
// blowout (the user's own threshold) -- ties are impossible in football, so margin is never 0 for
// a final game. Returns null for a bye week or a game that hasn't finished yet -- those stay
// user-assignable via the chips. Takes the game object directly (not a teamId lookup) so it works
// the same whether `g` is the static snapshot or the live-merged version.
export function autoResultFor(g, teamId) {
  if (!g || g.status !== 'final' || g.awayScore == null || g.homeScore == null) return null;
  const isHome = g.home === teamId;
  const mine = isHome ? g.homeScore : g.awayScore;
  const theirs = isHome ? g.awayScore : g.homeScore;
  const margin = mine - theirs;
  if (margin > 0) return margin >= 14 ? 'blowoutWin' : 'win';
  return Math.abs(margin) >= 14 ? 'blowoutLoss' : 'loss';
}

// Everything the model needs to know about this week's slate, keyed for O(1) lookup:
//   oppId       { teamId: opponentTeamId } for every team on the slate
//   h2h         the same, restricted to games where BOTH teams are in the current Top 25 -- these
//               picks auto-sync and get the winner-above-loser hard constraint in the model
//   gameByTeam  { teamId: that team's game } (both sides of a game map to the SAME object)
//   getOpponentInfo(teamId) -> { oppPollRank, oppSpRank } | null, the opponent-quality resolver
//               projectOrder takes: poll rank straight off currentOrder, SP+ rank via the
//               opponent's own team record (may be absent for a non-Power-4 unranked opponent --
//               degrades to null, which the model treats as a generic unranked team)
export function buildPickemContext(currentOrder, slate, teamById) {
  const ranked = new Set(currentOrder);
  const oppId = {};
  const h2h = {};
  const gameByTeam = {};
  for (const g of slate) {
    oppId[g.away] = g.home;
    oppId[g.home] = g.away;
    gameByTeam[g.away] = g;
    gameByTeam[g.home] = g;
    if (ranked.has(g.away) && ranked.has(g.home)) {
      h2h[g.away] = g.home;
      h2h[g.home] = g.away;
    }
  }
  function getOpponentInfo(teamId) {
    const opp = oppId[teamId];
    if (!opp) return null;
    const idx = currentOrder.indexOf(opp);
    return {
      oppPollRank: idx === -1 ? null : idx + 1,
      oppSpRank: teamById(opp)?.sp ?? null,
    };
  }
  return { oppId, h2h, gameByTeam, getOpponentInfo };
}

// { teamId: outcome } for every ranked team whose game is already final -- the page's
// pre-filled "what really happened" baseline. `gameByTeam` may be the static slate or a live-merged
// one; a team with no game (bye) or an unfinished one is simply absent.
export function autoPicksFor(currentOrder, gameByTeam) {
  const picks = {};
  for (const id of currentOrder) {
    const result = autoResultFor(gameByTeam[id], id);
    if (result) picks[id] = result;
  }
  return picks;
}
