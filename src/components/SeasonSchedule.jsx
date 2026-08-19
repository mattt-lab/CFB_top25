import { teamById, formatKickoff } from '../data/teams.js';
import TeamMark from './TeamMark.jsx';

// Mirrors ResumeTable.jsx's noteFor exactly -- kept local since it's a tiny, display-only
// derivation and this table's copy needs to read identically without pulling in a shared-helper
// module for four lines of logic.
function noteFor(g) {
  if (g.tag === 'quality') return 'Quality win';
  if (g.tag === 'bad') return 'Bad loss';
  return g.res === 'W' ? 'Expected result' : 'Loss';
}

// "vs #8 Michigan" / "at Ball State" -- same homeAway-driven convention nextGameParts() in
// teams.js already uses for the single next game, extended here to every game on the schedule.
function OpponentCell({ g }) {
  const oppTeam = teamById(g.oppId);
  const vsAt = g.homeAway === 'home' ? 'vs' : 'at';
  return (
    <>
      {vsAt} {g.oppRank != null && <span style={{ color: 'var(--muted)' }}>#{g.oppRank} </span>}
      {oppTeam && <TeamMark team={oppTeam} />}
      {g.opp}
    </>
  );
}

export default function SeasonSchedule({ team }) {
  if (!team.games.length) {
    return (
      <section className="card" style={{ marginTop: 22 }}>
        <div className="panel-title">
          <div><h2>Season Schedule</h2></div>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--ink-2)', margin: 0 }}>
          No schedule data available for {team.name} yet.
        </p>
      </section>
    );
  }

  // team.games is already wk-ascending (sorted once at fetch time) -- both blocks below just
  // filter that single source of truth, no re-sort needed.
  const completedGames = team.games.filter((g) => g.res != null);
  const upcomingGames = team.games.filter((g) => g.res == null);

  return (
    <section className="card" style={{ marginTop: 22 }}>
      <div className="panel-title">
        <div>
          <h2>Season Schedule</h2>
          <p>Every game on {team.name}'s regular-season schedule, played and upcoming.</p>
        </div>
      </div>

      {completedGames.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          {upcomingGames.length > 0 && (
            <div className="eyebrow-lbl" style={{ margin: '4px 0 8px' }}>Completed</div>
          )}
          <table className="data-table">
            <thead><tr><th>Wk</th><th>Opponent</th><th>Result</th><th>Note</th></tr></thead>
            <tbody>
              {completedGames.map((g) => (
                <tr key={g.wk}>
                  <td className="tabnum">{g.wk}</td>
                  <td><OpponentCell g={g} /></td>
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
      )}

      {upcomingGames.length > 0 && (
        <div style={{ overflowX: 'auto', marginTop: completedGames.length ? 18 : 0 }}>
          <div className="eyebrow-lbl" style={{ margin: '4px 0 8px' }}>Upcoming</div>
          <table className="data-table">
            <thead><tr><th>Wk</th><th>Opponent</th><th>Kickoff</th><th>Status</th></tr></thead>
            <tbody>
              {upcomingGames.map((g) => (
                <tr key={g.wk}>
                  <td className="tabnum">{g.wk}</td>
                  <td><OpponentCell g={g} /></td>
                  <td>{formatKickoff(g.when) ?? '—'}</td>
                  <td><span style={{ color: 'var(--muted)' }}>Scheduled</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
