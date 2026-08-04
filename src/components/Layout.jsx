import { useEffect } from 'react';
import { NavLink, Outlet, useLocation, matchPath } from 'react-router-dom';
import {
  teamById, WEEK_IDX_MIN, WEEK_IDX_MAX, SEASON, LAST_UPDATED, primaryLabel, PRIMARY_SOURCE_BY_WEEK,
} from '../data/teams.js';
import { useWeekStore } from '../store/useWeekStore.js';
import { trackPageview } from '../utils/analytics.js';

const WEEK_OPTIONS = [];
for (let w = WEEK_IDX_MIN; w <= WEEK_IDX_MAX; w++) WEEK_OPTIONS.push(w);

// The week-travel control only affects the Top 25 table and the Playoff Watch bracket -- team
// pages always show the full season regardless -- so it's only shown (and only meaningful) on
// those two routes.
const WEEK_TRAVEL_ROUTES = ['/', '/playoff-watch'];

function formatLastUpdated(iso) {
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function titleFor(pathname) {
  if (pathname === '/') return 'Top 25 Tracker';
  if (pathname === '/playoff-watch') return 'Playoff Watch';
  const teamMatch = matchPath('/team/:teamId', pathname);
  if (teamMatch) {
    const team = teamById(teamMatch.params.teamId);
    return team ? team.name : 'Team';
  }
  return pathname;
}

export default function Layout() {
  const location = useLocation();
  const weekIdx = useWeekStore((s) => s.weekIdx);
  const setWeekIdx = useWeekStore((s) => s.setWeekIdx);
  const jumpToCurrent = useWeekStore((s) => s.jumpToCurrent);
  const showWeekTravel = WEEK_TRAVEL_ROUTES.includes(location.pathname);

  useEffect(() => {
    const pageTitle = `CFB HQ — ${titleFor(location.pathname)}`;
    document.title = pageTitle;
    trackPageview(location.pathname, pageTitle);
  }, [location.pathname]);

  return (
    <div>
      <header className="header">
        <NavLink to="/" className="wordmark">
          <span className="dot" />CFB&nbsp;HQ
        </NavLink>
        <div className="week">
          {SEASON} season · Week <b>{WEEK_IDX_MAX + 1}</b> ·{' '}
          <span>Ranked by {primaryLabel(PRIMARY_SOURCE_BY_WEEK[WEEK_IDX_MAX])}</span>
          {LAST_UPDATED && <span> · Data as of {formatLastUpdated(LAST_UPDATED)}</span>}
        </div>
        {showWeekTravel && (
          <select
            className="week-select"
            value={weekIdx}
            onChange={(e) => setWeekIdx(+e.target.value)}
            aria-label="Time travel: view a past week's Top 25 & bracket snapshot"
            title="Time travel: view a past week's Top 25 & bracket snapshot (team pages always show the full season)"
          >
            {WEEK_OPTIONS.map((w) => (
              <option key={w} value={w}>
                Week {w + 1}{w === WEEK_IDX_MAX ? ' (latest)' : ''}
              </option>
            ))}
          </select>
        )}
      </header>
      <nav className="nav">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
          Top 25 Tracker
        </NavLink>
        <NavLink to="/playoff-watch" className={({ isActive }) => (isActive ? 'active' : '')}>
          Playoff Watch
        </NavLink>
      </nav>
      <div className="wrap">
        {showWeekTravel && weekIdx !== WEEK_IDX_MAX && (
          <div className="hist-banner">
            <span>You're viewing a past snapshot — not the latest rankings.</span>
            <button type="button" onClick={jumpToCurrent}>Jump to current week</button>
          </div>
        )}
        <Outlet />

        <p className="footnote warn" style={{ marginTop: 30 }}>
          <b>On odds:</b> upcoming-game spreads/totals are sourced live from{' '}
          <a href="https://collegefootballdata.com/key" style={{ color: 'inherit' }} target="_blank" rel="noopener noreferrer">
            CollegeFootballData.com
          </a>'s <code>/lines</code> endpoint, which aggregates them from multiple books. "Make the
          playoff" / "win it all" percentages are different: no free API carries NCAAF
          championship-futures odds, so those are an in-house estimate blending rank, record, and
          computer ratings (SP+/FPI/Elo) — a stand-in for a proper Monte-Carlo simulation over the
          remaining schedule, not a market price.
        </p>
      </div>
    </div>
  );
}
