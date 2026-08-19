import { Link } from 'react-router-dom';
import { useWeekStore } from '../store/useWeekStore.js';
import { WEEK_IDX_MAX, primaryLabel, PRIMARY_SOURCE_BY_WEEK } from '../data/teams.js';
import Top25Table from '../components/Top25Table.jsx';

export default function Top25Poll() {
  const weekIdx = useWeekStore((s) => s.weekIdx);
  const currentWeekNumber = WEEK_IDX_MAX + 1;
  const weekSource = primaryLabel(PRIMARY_SOURCE_BY_WEEK[weekIdx]);
  const eyebrow = weekIdx === WEEK_IDX_MAX
    ? `Week ${currentWeekNumber}`
    : `Week ${weekIdx + 1} snapshot (historical, by ${weekSource})`;

  return (
    <div>
      <div className="page-title">
        <div className="eyebrow">{eyebrow}</div>
        <h1>Top 25</h1>
        <p>Full ranking board, and what it means for the playoff and title race.</p>
      </div>

      <div className="bracket-label">Full season</div>
      <div className="section-header">
        <div>
          <h2>Top 25 — {weekSource}</h2>
          <p>Tap any team for full history, scorecard, and odds.</p>
        </div>
        <span className="odds-hint">Playoff / title odds are a simplified model — see note below</span>
      </div>
      <Top25Table weekIdx={weekIdx} />

      {/* Playoff Watch keeps its own nav tab -- this callout slot belongs to Pick 'em. */}
      <div className="cta-card">
        <div className="txt">
          <b>Top 25 Pick 'em</b>
          <span>Call this week's games and watch the rankings shake out.</span>
        </div>
        <Link className="cta-btn" to="/pickem">Play Pick 'em →</Link>
      </div>

      {/* Only shown here, not sitewide -- this is what the Top 25 table's .odds-hint ("see note
          below") points at, and this is the only page that surfaces the "Make CFP"/"win it all"
          odds columns directly (Team Detail's gauges and Conference standings' Make-CFP column
          derive from the same model, but don't need their own copy of this disclosure). */}
      <p className="footnote warn" style={{ marginTop: 30 }}>
        <b>On odds:</b> spreads/totals are sourced live from{' '}
        <a href="https://collegefootballdata.com/key" style={{ color: 'inherit' }} target="_blank" rel="noopener noreferrer">
          CollegeFootballData.com
        </a>. "Make the playoff" / "win it all" are an in-house estimate blending rank, record,
        and computer ratings (SP+/FPI/Elo).
      </p>
    </div>
  );
}
