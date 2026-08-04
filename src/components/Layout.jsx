import { useEffect } from 'react';
import { NavLink, Outlet, useLocation, matchPath } from 'react-router-dom';
import {
  teamById, WEEK_IDX_MAX, SEASON, LAST_UPDATED, primaryLabel, PRIMARY_SOURCE_BY_WEEK,
} from '../data/teams.js';
import { trackPageview } from '../utils/analytics.js';

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
        <Outlet />

        <p className="footnote warn" style={{ marginTop: 30 }}>
          <b>On odds:</b> upcoming-game spreads/totals are realistic to source live — CFBD's own{' '}
          <code>/lines</code> endpoint aggregates them from multiple books. "Make the playoff" /
          "win it all" futures are the hard part: The Odds API explicitly does not carry NCAAF
          outrights, and CFBD doesn't offer futures either — so a real build would either
          (a) point-in-time scrape a couple of sportsbook futures pages on a schedule (fragile, ToS
          risk, needs disclosure), or (b) compute an in-house estimate blending rank, record, and
          computer ratings (SP+/FPI) like the gauges above — still a stand-in for a proper
          Monte-Carlo simulation over the remaining schedule, and labeled as a model estimate rather
          than a market price. Mixing the two without a loud label is the one thing to avoid.
        </p>
        <p className="footnote">
          A real build would source polls, lines, and SP+/FPI/Elo from the{' '}
          <a href="https://collegefootballdata.com/key" style={{ color: 'inherit' }} target="_blank" rel="noopener noreferrer">
            CollegeFootballData.com API
          </a>.
        </p>
      </div>
    </div>
  );
}
