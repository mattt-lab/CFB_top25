// Pure helper for RankingChart's poll-spread band: for one team-week, the [min, max] range of
// whichever of the three poll ranks (AP / Coaches / CFP Committee) exist that week. Weeks where
// only one poll ranks the team collapse to a zero-height [r, r] band -- deliberately not
// special-cased, a zero-height band is the correct picture of "no disagreement to show". Weeks
// where the team is unranked in ALL polls (or pre-committee null cfp with no AP/Coaches rank)
// return null, which breaks the band in recharts the same way the Lines handle their own nulls.
export function pollSpread(team, weekIdx) {
  const ranks = [team.ap[weekIdx], team.coaches[weekIdx], team.cfp[weekIdx]]
    .filter((r) => r != null);
  if (ranks.length === 0) return null;
  return [Math.min(...ranks), Math.max(...ranks)];
}
