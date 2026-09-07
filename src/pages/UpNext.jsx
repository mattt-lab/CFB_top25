import { allGames } from '../data/teams.js';
import { useLiveScores } from '../utils/useLiveScores.js';
import { pickDayGames, sortDayGames } from '../utils/upNextSchedule.js';
import GameSlateTable from '../components/GameSlateTable.jsx';

export default function UpNext() {
  // Day selection runs against the raw (not live-merged) data -- it's purely about which
  // calendar date to show, independent of live/final state. `allGames` only ever covers the
  // current CFBD week (~5 days) -- there's nothing beyond that already fetched, so on the rare
  // day right after a week's last game (before the pipeline rolls to the next week), this can
  // come back empty. Accepted for v1 -- see the brainstorm on this feature for why.
  const { games: dayGames, dateLabel } = pickDayGames(allGames);

  // Wired to just this day's games, not the whole slate -- smaller payload, and a future
  // ("rolled forward") day is never live yet anyway, so the hook is a no-op there.
  const liveOverlay = useLiveScores(dayGames);
  const liveGames = dayGames.map((g) => ({ ...g, ...(liveOverlay[g.id] ?? {}) }));
  // Sorted AFTER the live merge so a game that's actually gone final (per live data) sinks even
  // if the static snapshot still says 'scheduled'.
  const sortedGames = sortDayGames(liveGames);

  return (
    <div>
      <div className="page-title">
        <div className="eyebrow">{dateLabel ? 'Next games on the board' : "Today's games"}</div>
        <h1>Up Next</h1>
        <p>
          {dateLabel
            ? `Nothing on today's schedule -- here's ${dateLabel}, the next day with games.`
            : "Every game on today's schedule, live scores included."}
        </p>
      </div>

      <section className="card">
        {sortedGames.length === 0 ? (
          <p style={{ fontSize: 12.5, color: 'var(--ink-2)', margin: 0 }}>
            No games on the board right now -- check back once the next slate is out.
          </p>
        ) : (
          <GameSlateTable games={sortedGames} showUpset />
        )}
      </section>
    </div>
  );
}
