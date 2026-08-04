export default function ResumeTable({ team }) {
  // Fixture is intentionally sparse for non-priority teams (empty `games: []`) — see the
  // comment in scripts/generate-sample-fixture.mjs. Show a plain message instead of a
  // headers-only empty table.
  if (!team.games.length) {
    return (
      <p style={{ fontSize: 12.5, color: 'var(--ink-2)', margin: 0 }}>
        No game-by-game data available for {team.name} yet.
      </p>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table">
        <thead><tr><th>Wk</th><th>Opponent</th><th>Result</th><th>Note</th></tr></thead>
        <tbody>
          {team.games.map((g) => (
            <tr key={g.wk}>
              <td className="tabnum">{g.wk}</td>
              <td>
                {g.opp}
                {g.oppRank ? <span style={{ color: 'var(--muted)' }}> #{g.oppRank}</span> : null}
              </td>
              <td><span className={`result ${g.res}`}>{g.res}</span></td>
              <td>
                {g.tag ? (
                  <span className={`tag ${g.tag === 'quality' ? 'quality' : 'bad'}`}>{g.note}</span>
                ) : (
                  <span style={{ color: 'var(--muted)' }}>{g.note}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
