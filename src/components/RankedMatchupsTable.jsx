import { Link } from 'react-router-dom';
import { formatKickoff, gameStatusBadge, leadingScoreLabel } from '../data/teams.js';
import TeamMark from './TeamMark.jsx';

// "#8 Michigan" / "Ball State" -- rank omitted for unranked side, same as OpponentCell's
// convention in SeasonSchedule.jsx. Guards on the resolved team object since a ranked team can
// still be paired against an opponent missing from teams{} (e.g. an unresolved FCS buy-game foe).
function TeamCell({ id, rank, team }) {
  return (
    <>
      {rank != null && <span style={{ color: 'var(--muted)' }}>#{rank} </span>}
      {team && <TeamMark team={team} />}
      <Link to={`/team/${id}`}>{team?.name ?? id}</Link>
    </>
  );
}

export default function RankedMatchupsTable({ games }) {
  return (
    <section className="card" style={{ marginTop: 22 }}>
      <div className="panel-title">
        <div>
          <h2>Top 25 — Full Slate</h2>
          <p>Every game this week involving a ranked team, in kickoff order.</p>
        </div>
      </div>

      {games.length === 0 ? (
        <p style={{ fontSize: 12.5, color: 'var(--ink-2)', margin: 0 }}>
          No ranked matchups on the board this week.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr><th>Matchup</th><th>Kickoff</th><th>Score</th></tr>
            </thead>
            <tbody>
              {games.map((g) => {
                const badge = gameStatusBadge(g.status, g.period, g.clock);
                const decided = g.status === 'in_progress' || g.status === 'final';
                return (
                  <tr key={g.id}>
                    <td>
                      <TeamCell id={g.away} rank={g.awayRank} team={g.awayTeam} /> at{' '}
                      <TeamCell id={g.home} rank={g.homeRank} team={g.homeTeam} />
                    </td>
                    <td>
                      {badge.live ? (
                        // A dense table row reads better as plain time-remaining text than the
                        // marquee's compact "LIVE" chip -- this IS the kickoff column once a game
                        // has one, not a status badge competing with it for space.
                        <span className="badge-status badge-live">
                          <span className="pulse-dot" aria-hidden="true" />
                          {g.period != null ? `Q${g.period}, ${g.clock} remaining` : 'Live'}
                        </span>
                      ) : badge.text ? (
                        <span className="badge-status badge-final">{badge.text}</span>
                      ) : (
                        formatKickoff(g.when)
                      )}
                    </td>
                    <td className="tabnum">
                      {decided ? leadingScoreLabel(g) : (g.spread ?? '—')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
