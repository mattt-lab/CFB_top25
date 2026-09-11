// Selects every game (beyond the marquee "biggest games") that still involves at least one
// currently-ranked Top 25 team -- lets "Your Teams" show an analysis blurb for a pinned team's
// next game even when it wasn't stakes-y enough for the marquee cut. Extracted from score.mjs
// (same convention as ranking.mjs/game-log.mjs/poll.mjs) so it's independently testable without
// importing score.mjs's own main()-calling entry point.
export function selectRankedNextGames(scoredGames, keptGames) {
  const keptIds = new Set(keptGames.map((g) => g.id));
  return scoredGames.filter(
    (g) => !keptIds.has(g.id) && (g.awayRank != null || g.homeRank != null),
  );
}
