// Pure date-grouping/sorting logic behind the "Up Next" page -- kept separate from the page
// component so it's independently testable without rendering React or wiring the live-score hook.

function dateKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

// Picks which day's games to show: today's, if any exist; otherwise the next date (within
// whatever `games` already covers -- see UpNext.jsx's header comment on the current-week-only
// limitation) that has any. Returns { games, dateLabel } -- dateLabel is null when showing today
// (the page's own heading already says so), else a human string like "Thursday, Sep 11" for
// whichever future day got picked, so the page can make clear it's not showing today.
export function pickDayGames(games, now = new Date()) {
  const todayKey = dateKey(now);
  const withDates = games.filter((g) => g.when);
  const todayGames = withDates.filter((g) => dateKey(new Date(g.when)) === todayKey);
  if (todayGames.length) return { games: todayGames, dateLabel: null };

  const future = withDates
    .filter((g) => new Date(g.when) > now)
    .sort((a, b) => new Date(a.when) - new Date(b.when));
  if (!future.length) return { games: [], dateLabel: null };
  const nextKey = dateKey(new Date(future[0].when));
  const nextDayGames = future.filter((g) => dateKey(new Date(g.when)) === nextKey);
  const dateLabel = new Date(future[0].when).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  return { games: nextDayGames, dateLabel };
}

// Finished (status 'final') games sink to the bottom; everything else (live or not-yet-started)
// sorts by kickoff ascending, same convention as the Full Slate table. Callers should merge any
// live-score overlay onto `games` BEFORE calling this, so a game that's actually gone final (per
// live data) sinks even if the static current.json snapshot still says 'scheduled'.
export function sortDayGames(games) {
  return games.slice().sort((a, b) => {
    const aFinal = a.status === 'final';
    const bFinal = b.status === 'final';
    if (aFinal !== bFinal) return aFinal ? 1 : -1;
    return new Date(a.when) - new Date(b.when);
  });
}
