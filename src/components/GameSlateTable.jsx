import { Link } from 'react-router-dom';
import { formatKickoff, gameStatusBadge, leadingScoreLabel, leadingScoreParts, isPotentialUpset, periodLabel } from '../data/teams.js';
import TeamMark from './TeamMark.jsx';

// "#8 Michigan" / "Ball State" -- rank omitted for unranked side. Guards on the resolved team
// object since a game can still be paired against an opponent missing from teams{} (e.g. an
// unresolved FCS buy-game foe).
function TeamCell({ id, rank, team }) {
  return (
    <span className="team-inline">
      {rank != null && <span style={{ color: 'var(--muted)' }}>#{rank} </span>}
      {team && <TeamMark team={team} />}
      <Link to={`/team/${id}`}>{team?.name ?? id}</Link>
    </span>
  );
}

// A live score needs to read bigger than the surrounding text (see .live-score-num) -- final and
// scheduled scores/spreads stay plain-text, matching leadingScoreLabel's existing convention.
function ScoreCell({ g }) {
  const decided = g.status === 'in_progress' || g.status === 'final';
  if (!decided) return g.spread ?? '—';
  if (g.status !== 'in_progress') return leadingScoreLabel(g);
  const p = leadingScoreParts(g);
  if (p.tied) return <span className="live-score-num">{p.leaderScore}–{p.trailerScore}</span>;
  return <>{p.leaderName} {p.verb}, <span className="live-score-num">{p.leaderScore}–{p.trailerScore}</span></>;
}

// Shared by RankedMatchupsTable (Top 25 Full Slate) and UpNext -- both are "list of games, kickoff
// column, score column" tables that differ only in which games they pass in and whether the
// upset flag applies. Callers are responsible for sorting `games` and merging any live-score
// overlay onto them before passing in.
export default function GameSlateTable({ games, showUpset = false, showNetwork = false }) {
  if (games.length === 0) return null;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table">
        <thead>
          <tr><th>Matchup</th><th>Kickoff</th><th>Score</th></tr>
        </thead>
        <tbody>
          {games.map((g) => {
            const badge = gameStatusBadge(g.status, g.period, g.clock);
            const upset = showUpset && isPotentialUpset(g);
            return (
              <tr key={g.id} className={upset ? 'upset-row' : undefined}>
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
                      {g.period != null ? `${periodLabel(g.period)}, ${g.clock} remaining` : 'Live'}
                    </span>
                  ) : badge.text ? (
                    <span className="badge-status badge-final">{badge.text}</span>
                  ) : (
                    formatKickoff(g.when)
                  )}
                  {showNetwork && g.network && `, ${g.network}`}
                </td>
                <td className="tabnum">
                  {upset && <span role="img" aria-label="Potential upset">🔥 </span>}
                  <ScoreCell g={g} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
