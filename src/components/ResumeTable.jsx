// The schema (docs/data-schema.md) only carries `tag` ("quality" | "bad" | "") -- there's no
// separate human-readable `note` field, so the display text is derived from `tag` + result here
// rather than depending on a field the real fetch script never produces. (An earlier version of
// this component read a mockup-era `g.note` string directly -- real fetched games don't have
// one, so every note would have rendered blank.)
function noteFor(g) {
  if (g.tag === 'quality') return 'Quality win';
  if (g.tag === 'bad') return 'Bad loss';
  return g.res === 'W' ? 'Expected result' : 'Loss';
}

// Show only the most recent games -- team.games can hold every game since the first week with
// poll data (which grows across a season, potentially well past 6), but the panel is titled
// "last 6 games" on purpose to keep the resume focused on recent form.
const RESUME_LENGTH = 6;

export default function ResumeTable({ team }) {
  // team.games now covers the full regular season (completed + upcoming), not just completed
  // games -- filter to completed-only BEFORE the empty-check/slice below so an unplayed future
  // game at the tail of the array can't get pulled into the "recent form" resume.
  const completedGames = team.games.filter((g) => g.res != null);

  if (!completedGames.length) {
    return (
      <p style={{ fontSize: 12.5, color: 'var(--ink-2)', margin: 0 }}>
        No game-by-game data available for {team.name} yet.
      </p>
    );
  }

  const recentGames = completedGames.slice(-RESUME_LENGTH);

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table">
        <thead><tr><th>Wk</th><th>Opponent</th><th>Result</th><th>Note</th></tr></thead>
        <tbody>
          {recentGames.map((g) => (
            <tr key={g.wk}>
              <td className="tabnum">{g.wk}</td>
              <td>
                {g.opp}
                {g.oppRank ? <span style={{ color: 'var(--muted)' }}> #{g.oppRank}</span> : null}
              </td>
              <td><span className={`result ${g.res}`}>{g.res}</span></td>
              <td>
                {g.tag ? (
                  <span className={`tag ${g.tag === 'quality' ? 'quality' : 'bad'}`}>{noteFor(g)}</span>
                ) : (
                  <span style={{ color: 'var(--muted)' }}>{noteFor(g)}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
