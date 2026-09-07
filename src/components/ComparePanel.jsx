import { useState, useEffect } from 'react';
import { teams, teamById, byRankAsc } from '../data/teams.js';

export default function ComparePanel({ team }) {
  // team.games now covers the full season including upcoming games (res: null) -- head-to-head/
  // common-opponent comparisons only make sense against games that actually happened, so this is
  // filtered to completed-only before any of the logic below runs.
  const teamCompleted = team.games.filter((g) => g.res != null);
  const teamOppNames = new Set(teamCompleted.map((g) => g.opp));

  // Only offer opponents a comparison would actually say something about: a direct head-to-head,
  // or at least one common opponent. Early in a season (few completed games anywhere yet) this can
  // come back very short or even empty -- that's real, not a bug, and the empty-state message below
  // covers it explicitly rather than rendering an empty/broken-looking dropdown.
  const others = Object.values(teams)
    .filter((t) => t.id !== team.id)
    .filter((t) => {
      const tCompleted = t.games.filter((g) => g.res != null);
      return tCompleted.some((g) => g.opp === team.name || teamOppNames.has(g.opp));
    })
    .sort(byRankAsc((t) => t.cfpRank));
  const [otherId, setOtherId] = useState(others[0]?.id);

  // If the current team changes (navigated to a different team page), reset the comparison target.
  useEffect(() => {
    if (!others.some((t) => t.id === otherId)) setOtherId(others[0]?.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team.id]);

  const other = teamById(otherId);
  const otherCompleted = other ? other.games.filter((g) => g.res != null) : [];

  let body = null;
  if (other) {
    // Guaranteed non-empty by the `others` filter above -- every candidate in the dropdown has
    // either a direct game against `team` or at least one common opponent, so there's always
    // something real to show here (no "no data" empty state needed inside this branch anymore).
    const directGame = teamCompleted.find((g) => g.opp === other.name);
    const oppMapA = {};
    teamCompleted.forEach((g) => { oppMapA[g.opp] = g; });
    const common = otherCompleted.filter((g) => oppMapA[g.opp]);

    body = (
      <>
        {directGame ? (
          <div className="bubble-row" style={{ cursor: 'default', marginBottom: 10 }}>
            <span className="nm">Head-to-head — Week {directGame.wk}</span>
            <span className="needs">
              {team.name} {directGame.res === 'W' ? 'beat' : 'lost to'} {other.name}
            </span>
          </div>
        ) : (
          <p style={{ fontSize: 12.5, color: 'var(--ink-2)', margin: '0 0 10px' }}>
            {team.name} and {other.name} haven't played each other this season.
          </p>
        )}
        {common.length ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr><th>Common opponent</th><th>{team.name}</th><th>{other.name}</th></tr>
              </thead>
              <tbody>
                {common.map((g) => {
                  const mine = oppMapA[g.opp];
                  return (
                    <tr key={g.opp}>
                      <td>{g.opp}</td>
                      <td><span className={`result ${mine.res}`}>{mine.res}</span></td>
                      <td><span className={`result ${g.res}`}>{g.res}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ fontSize: 12.5, color: 'var(--ink-2)', margin: '8px 0 0' }}>
            No common opponents this season.
          </p>
        )}
      </>
    );
  }

  return (
    <section className="card" style={{ marginTop: 16 }}>
      <div className="panel-title">
        <div>
          <h2>Compare</h2>
          <p>Head-to-head result and common opponents against another team in the field.</p>
        </div>
        {others.length > 0 && (
          <select className="toggle-btn" value={otherId} onChange={(e) => setOtherId(e.target.value)}>
            {others.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
      </div>
      {others.length === 0 ? (
        <p style={{ fontSize: 12.5, color: 'var(--ink-2)', margin: 0 }}>
          No comparable opponents yet — check back once more of the season's been played.
        </p>
      ) : body}
    </section>
  );
}
