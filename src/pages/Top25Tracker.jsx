import { Link } from 'react-router-dom';
import { useWeekStore } from '../store/useWeekStore.js';
import { WEEK_IDX_MAX, games, predictions, primaryLabel, PRIMARY_SOURCE_BY_WEEK } from '../data/teams.js';
import WeekTravelBar from '../components/WeekTravelBar.jsx';
import MyTeamsSection from '../components/MyTeamsSection.jsx';
import Top25Table from '../components/Top25Table.jsx';

// `when` is ISO 8601 in the real schema (e.g. "2026-09-05T23:30:00Z") -- format it for display
// rather than rendering the raw string.
function formatKickoff(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString('en-US', {
      weekday: 'short', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
    });
  } catch {
    return iso;
  }
}

export default function Top25Tracker() {
  const weekIdx = useWeekStore((s) => s.weekIdx);
  const currentWeekNumber = WEEK_IDX_MAX + 1;
  const weekSource = primaryLabel(PRIMARY_SOURCE_BY_WEEK[weekIdx]);
  const eyebrow = weekIdx === WEEK_IDX_MAX
    ? `Week ${currentWeekNumber} · Ranked by ${weekSource}`
    : `Week ${weekIdx + 1} snapshot (historical, by ${weekSource})`;

  return (
    <div>
      <WeekTravelBar />

      <div className="page-title">
        <div className="eyebrow">{eyebrow}</div>
        <h1>CFB Top 25 Tracker</h1>
        <p>Full ranking board, the games that will move it, and what the model expects next.</p>
      </div>

      <MyTeamsSection weekIdx={weekIdx} />

      <section>
        <div className="panel-title" style={{ marginBottom: 10 }}>
          <div>
            <h2 style={{ fontSize: 17 }}>This week's biggest games</h2>
            <p>Matchups that move the field.</p>
          </div>
        </div>
        <div className="games-grid">
          {games.map((g) => (
            <div className="game-card" key={g.id}>
              <div className="game-meta">{formatKickoff(g.when)}</div>
              <div className="game-teams">
                <div className="game-team">
                  {g.awayRank != null && <span className="r">#{g.awayRank}</span>}
                  {g.awayTeam?.name ?? g.away}
                </div>
                <div className="game-at">at</div>
                <div className="game-team">
                  {g.homeRank != null && <span className="r">#{g.homeRank}</span>}
                  {g.homeTeam?.name ?? g.home}
                </div>
              </div>
              <div className="game-line">
                {g.spread && <span className="spread">{g.spread}</span>}
                {g.ou != null && <span style={{ color: 'var(--muted)' }}>O/U {g.ou}</span>}
              </div>
              <div className="game-impl">{g.blurb}</div>
            </div>
          ))}
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
            <li key={p.teamId ?? i}><span className="ic">{i + 1}</span><span>{p.blurb}</span></li>
          ))}
        </ul>
      </section>

      <div className="section-header">
        <div>
          <h2>Top 25</h2>
          <p>Tap any team for full history, scorecard, and odds.</p>
        </div>
        <span className="odds-hint">Playoff / title odds are a simplified model — see note below</span>
      </div>
      <Top25Table weekIdx={weekIdx} />

      <div className="cta-card">
        <div className="txt">
          <b>How's the 12-team field actually shaping up?</b>
          <span>Projected byes, first-round matchups, and who's on the bubble.</span>
        </div>
        <Link className="cta-btn" to="/playoff-watch">Open Playoff Watch →</Link>
      </div>

      <p className="footnote">
        Rankings, records, and betting lines are real, fetched from CollegeFootballData.com.
        Playoff and title odds are a simplified in-house model (rank, record, and computer-rating
        deltas) — not sportsbook prices. Records and each team's resume/chart reflect the full
        season regardless of the week snapshot selected above.
      </p>
    </div>
  );
}
