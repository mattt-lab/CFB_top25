import { useEffect } from 'react';
import { NavLink, Outlet, useLocation, matchPath } from 'react-router-dom';
import {
  teamById, WEEK_IDX_MIN, WEEK_IDX_MAX, SEASON, LAST_UPDATED, confByRouteSlug,
} from '../data/teams.js';
import { useWeekStore } from '../store/useWeekStore.js';
import { trackPageview } from '../utils/analytics.js';
import { version as APP_VERSION } from '../../package.json';

const WEEK_OPTIONS = [];
for (let w = WEEK_IDX_MIN; w <= WEEK_IDX_MAX; w++) WEEK_OPTIONS.push(w);

// The week-travel control only affects the Top 25 table, the Playoff Watch bracket, and a
// conference's standings table -- team pages always show the full season regardless, and the
// Conferences hub is a "right now" directory, not a data view -- so it's only shown (and only
// meaningful) on these routes. Patterns, not exact paths, since /conference/:confSlug is dynamic --
// a plain array-includes check (which worked fine for the two static routes) can't match it.
const WEEK_TRAVEL_PATTERNS = ['/', '/playoff-watch', '/conference/:confSlug'];

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
  if (pathname === '/conferences') return 'Conferences';
  const teamMatch = matchPath('/team/:teamId', pathname);
  if (teamMatch) {
    const team = teamById(teamMatch.params.teamId);
    return team ? team.name : 'Team';
  }
  const confMatch = matchPath('/conference/:confSlug', pathname);
  if (confMatch) {
    const conf = confByRouteSlug(confMatch.params.confSlug);
    return conf ?? 'Conference';
  }
  return pathname;
}

export default function Layout() {
  const location = useLocation();
  const weekIdx = useWeekStore((s) => s.weekIdx);
  const setWeekIdx = useWeekStore((s) => s.setWeekIdx);
  const jumpToCurrent = useWeekStore((s) => s.jumpToCurrent);
  const showWeekTravel = WEEK_TRAVEL_PATTERNS.some((p) => matchPath(p, location.pathname));

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
          {SEASON} season
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
        <NavLink to="/conferences" className={({ isActive }) => (isActive ? 'active' : '')}>
          Conferences
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
          <b>On odds:</b> spreads/totals are sourced live from{' '}
          <a href="https://collegefootballdata.com/key" style={{ color: 'inherit' }} target="_blank" rel="noopener noreferrer">
            CollegeFootballData.com
          </a>. "Make the playoff" / "win it all" are an in-house estimate blending rank, record,
          and computer ratings (SP+/FPI/Elo).
        </p>

        {/* Sourced from package.json (not hand-typed) so it can't drift from the real shipped
            version -- same visible-version convention as the Tour de France app's page footers. */}
        <footer style={{ textAlign: 'center', padding: '20px 0 4px', fontSize: 11, color: 'var(--muted)', letterSpacing: '1px' }}>
          v{APP_VERSION}
        </footer>
      </div>
    </div>
  );
}
