import { useLiveScores } from '../utils/useLiveScores.js';
import GameSlateTable from './GameSlateTable.jsx';

export default function RankedMatchupsTable({ games }) {
  // Static current.json data is only ever 'scheduled'/'final' (see useLiveScores.js's header
  // comment) -- without this overlay, the table's live badge/score/upset-flag code paths would
  // never actually fire. `games` already carries {id, away, home}, exactly what the hook expects.
  const liveOverlay = useLiveScores(games);
  const liveGames = games.map((g) => ({ ...g, ...(liveOverlay[g.id] ?? {}) }));

  return (
    <section className="card" style={{ marginTop: 22 }}>
      <div className="panel-title">
        <div>
          <h2>Top 25 — Full Slate</h2>
          <p>Every game this week involving a ranked team, in kickoff order.</p>
        </div>
      </div>

      {liveGames.length === 0 ? (
        <p style={{ fontSize: 12.5, color: 'var(--ink-2)', margin: 0 }}>
          No ranked matchups on the board this week.
        </p>
      ) : (
        <GameSlateTable games={liveGames} showUpset />
      )}
    </section>
  );
}
