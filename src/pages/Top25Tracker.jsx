import { Link } from 'react-router-dom';
import { useWeekStore } from '../store/useWeekStore.js';
import {
  WEEK_IDX_MAX, games, predictions, primaryLabel, PRIMARY_SOURCE_BY_WEEK, formatKickoff,
  gameStatusBadge,
} from '../data/teams.js';
import MyTeamsSection from '../components/MyTeamsSection.jsx';
import TeamMark from '../components/TeamMark.jsx';

export default function Top25Tracker() {
  const weekIdx = useWeekStore((s) => s.weekIdx);
  const currentWeekNumber = WEEK_IDX_MAX + 1;
  const weekSource = primaryLabel(PRIMARY_SOURCE_BY_WEEK[weekIdx]);
  // Current-week poll source is already shown in the sticky header -- only worth repeating here
  // when time-traveling to a past week, where the source may differ from the header's latest one.
  const eyebrow = weekIdx === WEEK_IDX_MAX
    ? `Week ${currentWeekNumber}`
    : `Week ${weekIdx + 1} snapshot (historical, by ${weekSource})`;

  return (
    <div>
      <div className="page-title">
        <div className="eyebrow">{eyebrow}</div>
        <h1>CFB This Week</h1>
        <p>This week's biggest games and what the model expects next.</p>
      </div>

      <MyTeamsSection weekIdx={weekIdx} />

      <section>
        <div className="panel-title" style={{ marginBottom: 10 }}>
          <div>
            <h2 style={{ fontSize: 17 }}>This week's biggest games</h2>
          </div>
        </div>
        <div className="games-grid">
          {games.map((g) => {
            const badge = gameStatusBadge(g.status, g.period, g.clock);
            const decided = g.status === 'in_progress' || g.status === 'final';
            return (
              <div className="game-card" key={g.id}>
                <div className="game-meta">
                  {badge.text ? (
                    <span className={`badge-status${badge.live ? ' badge-live' : ' badge-final'}`}>
                      {badge.live && <span className="pulse-dot" aria-hidden="true" />}
                      {badge.text}{badge.detail && ` · ${badge.detail}`}
                    </span>
                  ) : (
                    formatKickoff(g.when)
                  )}
                  {g.network && <span> · {g.network}</span>}
                  {g.rivalry && <span className="tag rivalry" style={{ marginLeft: 8 }}>Rivalry</span>}
                </div>
                <div className="game-teams">
                  <Link className="game-team" to={`/team/${g.away}`}>
                    {g.awayRank != null && <span className="r">#{g.awayRank}</span>}
                    {g.awayTeam && <TeamMark team={g.awayTeam} />}
                    {g.awayTeam?.name ?? g.away}
                    {g.awayTeam?.record && (
                      <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 12 }}> ({g.awayTeam.record})</span>
                    )}
                  </Link>
                  <div className="game-at">at</div>
                  <Link className="game-team" to={`/team/${g.home}`}>
                    {g.homeRank != null && <span className="r">#{g.homeRank}</span>}
                    {g.homeTeam && <TeamMark team={g.homeTeam} />}
                    {g.homeTeam?.name ?? g.home}
                    {g.homeTeam?.record && (
                      <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 12 }}> ({g.homeTeam.record})</span>
                    )}
                  </Link>
                </div>
                <div className="game-line">
                  {decided ? (
                    <span className="score">
                      {g.awayTeam?.name ?? g.away} {g.awayScore} – {g.homeTeam?.name ?? g.home} {g.homeScore}
                    </span>
                  ) : (
                    <>
                      {g.spread && <span className="spread">{g.spread}</span>}
                      {g.ou != null && <span style={{ color: 'var(--muted)' }}>O/U {g.ou}</span>}
                    </>
                  )}
                </div>
                <div className="game-impl">{g.blurb}</div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card" style={{ marginTop: 22 }}>
        <div className="panel-title">
          <div>
            <h2>What the model expects — Week {currentWeekNumber} → {currentWeekNumber + 1}</h2>
            <p>Notes generated from rankings, resume, and this week's lines.</p>
          </div>
        </div>
        <ul className="pred-list">
          {predictions.map((p, i) => (
            <li key={p.teamId ?? i}>
              <span className="ic">{i + 1}</span>
              <Link to={`/team/${p.teamId}`}>{p.blurb}</Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
