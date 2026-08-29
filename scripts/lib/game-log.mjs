// Shared W/L-tagging logic for a team's historical games[] log, used by fetch-cfb-data.mjs
// (building the season-to-date log for every team). Used to also be shared with
// fetch-live-scores.mjs (appending the one entry for a game the instant it went final, ahead of
// the next daily run) -- that script's retired (see cfbd.mjs), so game-log entries now only ever
// settle once/day, on fetch-cfb-data.mjs's own schedule.

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
