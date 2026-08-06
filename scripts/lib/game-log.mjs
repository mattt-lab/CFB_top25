// Shared W/L-tagging logic for a team's historical games[] log. Used by both fetch-cfb-data.mjs
// (building the season-to-date log for every team) and fetch-live-scores.mjs (appending the one
// entry for a game that just went final) -- pulled out so the "quality win" / "bad loss"
// thresholds live in exactly one place rather than drifting out of sync between the two scripts.

// Point-in-time "quality win" / "bad loss" thresholds, roughly: beating a team ranked ~20-or-
// better reads as "quality"; losing to a team that wasn't ranked at all reads as "bad".
export const QUALITY_WIN_MAX_RANK = 20;

export function tagFor(res, oppRank) {
  if (res === 'W' && oppRank != null && oppRank <= QUALITY_WIN_MAX_RANK) return 'quality';
  if (res === 'L' && oppRank == null) return 'bad';
  return '';
}

// W/L for both sides of a final score, from the home team's perspective's point of view flipped
// for away -- home/away naming here matches games[]/nextGame's own "home"/"away" vocabulary.
export function resultFor(homeScore, awayScore) {
  const homeWon = homeScore > awayScore;
  return { home: homeWon ? 'W' : 'L', away: homeWon ? 'L' : 'W' };
}
