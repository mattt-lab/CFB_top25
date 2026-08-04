import { useState, useEffect } from 'react';
import { teams, teamById } from '../data/teams.js';

export default function ComparePanel({ team }) {
  // Every team is fully detailed now (no DETAILED/SUMMARY split), so every other team is a
  // valid compare target — not just the old hand-authored 7.
  const others = Object.values(teams)
    .filter((t) => t.id !== team.id)
    .sort((a, b) => a.cfpRank - b.cfpRank);
  const [otherId, setOtherId] = useState(others[0]?.id);

  // If the current team changes (navigated to a different team page), reset the comparison target.
  useEffect(() => {
    if (!others.some((t) => t.id === otherId)) setOtherId(others[0]?.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team.id]);

  const other = teamById(otherId);

  let body = null;
  if (other) {
    // The fixture is intentionally sparse — most teams have an empty `games: []` (see
    // scripts/generate-sample-fixture.mjs). Head-to-head/common-opponent logic needs real game
    // logs on both sides, so bail out to a plain message instead of rendering an empty table.
    if (!team.games.length || !other.games.length) {
      const missing = !team.games.length && !other.games.length
        ? `${team.name} and ${other.name}`
        : !team.games.length ? team.name : other.name;
      body = (
        <p style={{ fontSize: 12.5, color: 'var(--ink-2)', margin: 0 }}>
          No game data available for {missing} yet — head-to-head and common-opponent comparisons
          need full game logs for both teams.
        </p>
      );
    } else {
      const directGame = team.games.find((g) => g.opp === other.name);
      const oppMapA = {};
      team.games.forEach((g) => { oppMapA[g.opp] = g; });
      const common = other.games.filter((g) => oppMapA[g.opp]);

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
              {team.name} and {other.name} haven't played each other in the last 6 weeks on record.
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
              No common opponents in the last 6 games on record.
            </p>
          )}
        </>
      );
    }
  }

  return (
    <section className="card" style={{ marginTop: 16 }}>
      <div className="panel-title">
        <div>
          <h2>Compare</h2>
          <p>Head-to-head result and common opponents against another team in the field.</p>
        </div>
        <select className="toggle-btn" value={otherId} onChange={(e) => setOtherId(e.target.value)}>
          {others.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      {body}
    </section>
  );
}
