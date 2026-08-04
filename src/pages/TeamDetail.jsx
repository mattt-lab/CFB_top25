import { useParams, useNavigate, useLocation, Navigate } from 'react-router-dom';
import {
  teamById, WEEK_IDX_MAX, trendOf, playoffOddsFor, nattyOddsFor, americanOdds,
} from '../data/teams.js';
import { usePinnedStore } from '../store/usePinnedStore.js';
import { downloadShareCard } from '../utils/shareCard.js';
import TeamLadder from '../components/TeamLadder.jsx';
import Gauge from '../components/Gauge.jsx';
import RankingChart from '../components/RankingChart.jsx';
import DeltaRows from '../components/DeltaRows.jsx';
import ResumeTable from '../components/ResumeTable.jsx';
import ComparePanel from '../components/ComparePanel.jsx';

export default function TeamDetail() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isPinned = usePinnedStore((s) => s.isPinned(teamId));
  const togglePin = usePinnedStore((s) => s.togglePin);

  const team = teamById(teamId);
  if (!team) return <Navigate to="/" replace />;

  const cameFrom = location.state?.from === 'playoff' ? 'playoff' : 'top25';
  const backLabel = cameFrom === 'playoff' ? '← Back to Playoff Watch' : '← Back to Top 25 Tracker';
  const backPath = cameFrom === 'playoff' ? '/playoff-watch' : '/';

  const rank = team.cfp[WEEK_IDX_MAX];
  const rankTrend = trendOf(team.cfp);
  const apTrend = trendOf(team.ap);
  const po = playoffOddsFor(rank, team.record, team.sp);
  const no = nattyOddsFor(rank, team.record, team.sp, team.fpi);

  return (
    <div>
      <button type="button" className="back-link" onClick={() => navigate(backPath)}>{backLabel}</button>

      <TeamLadder currentId={team.id} />

      <section className="hero-grid">
        <div className="card">
          <div className="team-row">
            <div>
              <div className="team-name">{team.name}</div>
              <div className="team-conf">{team.conf}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="eyebrow-lbl">Record</div>
              <div className="tabnum" style={{ fontSize: 20, fontWeight: 800 }}>{team.record}</div>
            </div>
          </div>
          <div className="rank-block">
            <div>
              <div className={`delta-badge ${rankTrend.dir}`}>
                {rankTrend.dir === 'flat' ? 'No change' : `${rankTrend.dir === 'up' ? '▲' : '▼'} ${rankTrend.diff} this week`}
              </div>
            </div>
            <div className="rank-figure tabnum">{rank}</div>
            <div className="eyebrow-lbl" style={{ marginBottom: 12 }}>CFP&nbsp;RANK</div>
          </div>
          <div className="stat-grid">
            <div className="stat">
              <div className="lbl">AP Poll</div>
              <div className="val tabnum">#{team.ap[WEEK_IDX_MAX]}</div>
              <div className="sub">
                {apTrend.dir === 'flat' ? 'No change' : `${apTrend.dir === 'up' ? '▲' : '▼'}${apTrend.diff} vs last wk`}
              </div>
            </div>
            <div className="stat">
              <div className="lbl">SP+ Rank</div>
              <div className="val tabnum">#{team.sp}</div>
              <div className="sub">
                {team.sp < rank ? 'Model likes them more' : team.sp > rank ? 'Model ranks them lower' : 'Matches committee'}
              </div>
            </div>
            <div className="stat">
              <div className="lbl">FPI Rank</div>
              <div className="val tabnum">#{team.fpi}</div>
              <div className="sub">
                {team.fpi < rank ? 'Model likes them more' : team.fpi > rank ? 'Model ranks them lower' : 'Matches committee'}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="toggle-btn" onClick={() => togglePin(team.id)}>
              {isPinned ? '★ Pinned' : '☆ Pin team'}
            </button>
            <button type="button" className="toggle-btn" onClick={() => downloadShareCard(team)}>
              ⬇ Download share card
            </button>
          </div>
        </div>

        <div className="card gauge-card">
          <div className="two-gauges">
            <Gauge pct={po} color="var(--accent)" valueLabel={`${po}%`} caption="Make the 12-team field" />
            <Gauge pct={no} color="var(--series-cfp)" valueLabel={`${no.toFixed(1)}%`} caption="Win the national title" />
          </div>
          <div className="gauge-note">
            Title odds ≈ {americanOdds(no)} american, blended from rank + record + SP+/FPI.{' '}
            {po >= 75 ? 'Comfortably in the field as of Week 12.' : po >= 40 ? "Control it and they're in." : 'Needs help to sneak in.'}
          </div>
        </div>
      </section>

      <RankingChart team={team} />

      <div className="grid2">
        <section className="card">
          <div className="panel-title">
            <div>
              <h2>Committee vs. the computers</h2>
              <p>Rank differential — positive means a model rates the team better than the committee does.</p>
            </div>
          </div>
          <DeltaRows team={team} />
        </section>

        <section className="card">
          <div className="panel-title">
            <div>
              <h2>Resume — last 6 games</h2>
              <p>Result and how much it moved the case.</p>
            </div>
          </div>
          <ResumeTable team={team} />
        </section>
      </div>

      <ComparePanel team={team} />
    </div>
  );
}
