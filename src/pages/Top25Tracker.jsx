import { Link } from 'react-router-dom';
import { useWeekStore } from '../store/useWeekStore.js';
import { WEEK_IDX_MAX } from '../data/teams.js';
import { GAMES, PREDICTIONS } from '../data/content.js';
import WeekTravelBar from '../components/WeekTravelBar.jsx';
import MyTeamsSection from '../components/MyTeamsSection.jsx';
import Top25Table from '../components/Top25Table.jsx';

export default function Top25Tracker() {
  const weekIdx = useWeekStore((s) => s.weekIdx);
  const eyebrow = weekIdx === WEEK_IDX_MAX
    ? 'Week 12 · Regular Season'
    : `Week ${weekIdx + 1} snapshot (historical)`;

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
            <p>Matchups that move the field. Lines are illustrative sample data.</p>
          </div>
        </div>
        <div className="games-grid">
          {GAMES.map((g, i) => (
            <div className="game-card" key={i}>
              <div className="game-meta">{g.when}</div>
              <div className="game-teams">
                <div className="game-team"><span className="r">#{g.away.rank}</span>{g.away.name}</div>
                <div className="game-at">at</div>
                <div className="game-team"><span className="r">#{g.home.rank}</span>{g.home.name}</div>
              </div>
              <div className="game-line">
                <span className="spread">{g.spread}</span>
                <span style={{ color: 'var(--muted)' }}>{g.ou}</span>
              </div>
              <div className="game-impl">{g.note}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="card" style={{ marginTop: 22 }}>
        <div className="panel-title">
          <div>
            <h2>What the model expects — Week 12 → 13</h2>
            <p>Notes generated from rankings, resume, and this week's lines.</p>
          </div>
        </div>
        <ul className="pred-list">
          {PREDICTIONS.map((p, i) => (
            <li key={i}><span className="ic">{i + 1}</span><span>{p}</span></li>
          ))}
        </ul>
      </section>

      <div className="section-header">
        <div>
          <h2>Top 25</h2>
          <p>Tap any team for full history, scorecard, and odds.</p>
        </div>
        <span className="odds-hint">Playoff / title odds are illustrative — see note below</span>
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
        Mockup with illustrative sample data — not live rankings, lines, or odds. See odds &amp; data
        sourcing notes below. Records and each team's resume/chart reflect the full season regardless
        of the week snapshot selected above.
      </p>
    </div>
  );
}
