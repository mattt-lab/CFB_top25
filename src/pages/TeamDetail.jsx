import { useParams, useNavigate, useLocation, Navigate } from 'react-router-dom';
import {
  teamById, WEEK_IDX_MAX, trendOf, playoffOddsFor, nattyOddsFor, americanOdds,
  deltaAt, primaryLabel, PRIMARY_SOURCE_BY_WEEK, dirFor, arrowGlyph, computerRatingNote, nextGameParts,
  gameStatusBadge, confByRouteSlug, confSlugFor,
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

  // A bare `from: 'conference'` flag wouldn't be enough to build a back link -- resolving through
  // confByRouteSlug() (rather than also stashing a redundant name string in every row's state)
  // means a stale bookmark or manually-crafted URL with a bad/missing confSlug just falls through
  // to the top25 default below, instead of rendering a broken link.
  const stateConf = location.state?.from === 'conference' ? confByRouteSlug(location.state?.confSlug) : null;
  const cameFrom = location.state?.from === 'playoff' ? 'playoff' : stateConf ? 'conference' : 'top25';
  const backLabel = cameFrom === 'playoff' ? '← Back to Playoff Watch'
    : cameFrom === 'conference' ? `← Back to ${stateConf}` : '← Back to Top 25 Tracker';
  const backPath = cameFrom === 'playoff' ? '/playoff-watch'
    : cameFrom === 'conference' ? `/conference/${confSlugFor(stateConf)}` : '/';

  // cfpRank is the resolved PRIMARY rank (CFP once the committee exists, else Coaches, else AP —
  // see docs/data-schema.md) -- never the raw team.cfp[] array, which is null pre-committee.
  const rank = team.cfpRank;
  const sourceLabel = primaryLabel(PRIMARY_SOURCE_BY_WEEK[WEEK_IDX_MAX]);
  const rankDelta = deltaAt(team.id, WEEK_IDX_MAX);
  const rankDeltaDir = dirFor(rankDelta);
  const apTrend = trendOf(team.ap);
  // Unranked teams (fell out of the poll, or never ranked) have rank === null -- the odds
  // formulas assume a real rank, so skip them rather than let `null` silently coerce to 0 and
  // produce a nonsense near-100% "playoff odds" for a team that isn't even ranked.
  const po = rank != null ? playoffOddsFor(rank, team.record, team.sp) : null;
  const no = rank != null ? nattyOddsFor(rank, team.record, team.sp, team.fpi) : null;
  const currentWeekNumber = WEEK_IDX_MAX + 1;
  const {
    opponent: nextOpponent, kickoff: nextKickoff, homeAway: nextHomeAway,
    status: nextStatus, awayScore: nextAwayScore, homeScore: nextHomeScore, period: nextPeriod, clock: nextClock,
  } = nextGameParts(team.nextGame);
  const nextBadge = gameStatusBadge(nextStatus, nextPeriod, nextClock);
  const myScore = nextHomeAway === 'home' ? nextHomeScore : nextAwayScore;
  const theirScore = nextHomeAway === 'home' ? nextAwayScore : nextHomeScore;

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
              <div className={`delta-badge ${rankDeltaDir}`}>
                {rankDeltaDir === 'flat' ? 'No change' : `${arrowGlyph(rankDelta)} ${Math.abs(rankDelta)} this week`}
              </div>
            </div>
            <div className="rank-figure tabnum">{rank ?? '—'}</div>
            <div className="eyebrow-lbl" style={{ marginBottom: 12 }}>{sourceLabel.toUpperCase()}&nbsp;RANK</div>
          </div>
          <div className="stat-grid">
            <div className="stat">
              <div className="lbl">AP Poll</div>
              <div className="val tabnum">{team.ap[WEEK_IDX_MAX] != null ? `#${team.ap[WEEK_IDX_MAX]}` : '—'}</div>
              <div className="sub">
                {apTrend.dir === 'flat' ? 'No change' : `${apTrend.dir === 'up' ? '▲' : '▼'}${apTrend.diff} vs last wk`}
              </div>
            </div>
            <div className="stat">
              <div className="lbl">SP+ Rank</div>
              <div className="val tabnum">{team.sp != null ? `#${team.sp}` : '—'}</div>
              <div className="sub">{computerRatingNote(team.sp, rank, sourceLabel)}</div>
            </div>
            <div className="stat">
              <div className="lbl">FPI Rank</div>
              <div className="val tabnum">{team.fpi != null ? `#${team.fpi}` : '—'}</div>
              <div className="sub">{computerRatingNote(team.fpi, rank, sourceLabel)}</div>
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <div className="eyebrow-lbl">Next Game</div>
            <div style={{ fontSize: 13.5, marginTop: 4 }}>
              {nextOpponent ? (
                <>
                  <b>{nextOpponent}</b>
                  {nextBadge.text ? (
                    <span className={`badge-status${nextBadge.live ? ' badge-live' : ' badge-final'}`} style={{ marginLeft: 8 }}>
                      {nextBadge.live && <span className="pulse-dot" aria-hidden="true" />}
                      {myScore != null && theirScore != null ? `${myScore}–${theirScore} · ` : ''}{nextBadge.text}
                    </span>
                  ) : (
                    nextKickoff && <span style={{ color: 'var(--ink-2)' }}> · {nextKickoff}</span>
                  )}
                </>
              ) : (
                <span style={{ color: 'var(--ink-2)' }}>Bye week</span>
              )}
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
          {rank == null ? (
            <p style={{ fontSize: 13, color: 'var(--ink-2)', textAlign: 'center' }}>
              {team.name} isn't currently ranked — odds need a rank to estimate from.
            </p>
          ) : (
            <>
              <div className="two-gauges">
                <Gauge pct={po} color="var(--accent)" valueLabel={`${po}%`} caption="Make the 12-team field" />
                <Gauge pct={no} color="var(--series-cfp)" valueLabel={`${no.toFixed(1)}%`} caption="Win the national title" />
              </div>
              <div className="gauge-note">
                Title odds ≈ {americanOdds(no)} american, blended from rank + record + SP+/FPI.{' '}
                {po >= 75 ? `Comfortably in the field as of Week ${currentWeekNumber}.` : po >= 40 ? "Control it and they're in." : 'Needs help to sneak in.'}
              </div>
            </>
          )}
        </div>
      </section>

      <RankingChart team={team} />

      <div className="grid2">
        <section className="card">
          <div className="panel-title">
            <div>
              <h2>{sourceLabel} vs. the computers</h2>
              <p>Rank differential — positive means a model rates the team better than the poll does.</p>
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
