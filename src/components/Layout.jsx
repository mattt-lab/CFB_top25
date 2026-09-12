import { useEffect } from 'react';
import { NavLink, Outlet, useLocation, matchPath } from 'react-router-dom';
import {
  teamById, SEASON, LAST_UPDATED, confByRouteSlug, PLAYOFF_PICTURE_IS_EARLY,
} from '../data/teams.js';
import { trackPageview } from '../utils/analytics.js';
import { version as APP_VERSION } from '../../package.json';

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
  if (pathname === '/') return 'This Week';
  if (pathname === '/up-next') return 'Up Next';
  if (pathname === '/top25') return 'Top 25';
  if (pathname === '/playoff-watch') return 'Playoff Watch';
  if (pathname === '/conferences') return 'Conferences';
  if (pathname === '/pickem') return "Top 25 Pick 'em";
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

  useEffect(() => {
    const pageTitle = `CFB HQ — ${titleFor(location.pathname)}`;
    document.title = pageTitle;
    trackPageview(location.pathname, pageTitle);
    // React Router doesn't scroll on navigation the way a traditional multi-page site does --
    // without this, landing on a new tab/page keeps whatever scroll position the previous page
    // was left at.
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div>
      <div className="site-header">
        <header className="header">
          <NavLink to="/" className="wordmark">
            <span className="dot" />CFB&nbsp;HQ
          </NavLink>
          <div className="week">
            {SEASON} season
            {/* Hidden below .data-as-of's breakpoint -- this line is long enough on its own to
                push the header onto 2 lines on narrow phones; the season label alone doesn't. */}
            {LAST_UPDATED && <span className="data-as-of"> · Data as of {formatLastUpdated(LAST_UPDATED)}</span>}
          </div>
        </header>
        <nav className="nav">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
            This Week
          </NavLink>
          <NavLink to="/up-next" className={({ isActive }) => (isActive ? 'active' : '')}>
            Up Next
          </NavLink>
          <NavLink to="/conferences" className={({ isActive }) => (isActive ? 'active' : '')}>
            Conferences
          </NavLink>
          <NavLink to="/top25" className={({ isActive }) => (isActive ? 'active' : '')}>
            Top 25
          </NavLink>
          {/* Hidden on phones (see .nav-desktop-only, theme.css) -- the Top 25 page already has
              its own "Play Pick 'em →" CTA (Top25Poll.jsx), so this tab is redundant crowding on
              a narrow nav bar, not the only way in. Stays in the desktop nav as a direct shortcut. */}
          <NavLink to="/pickem" className={({ isActive }) => ['nav-desktop-only', isActive ? 'active' : ''].filter(Boolean).join(' ')}>
            Top 25 Pick 'em
          </NavLink>
          {/* Playoff Watch stays LAST in the nav (user rule) -- new tabs go before it. Muted
              (not hidden/disabled) before the CFP committee's first ranking -- see
              PLAYOFF_PICTURE_IS_EARLY's doc comment in teams.js for why. */}
          <NavLink
            to="/playoff-watch"
            className={({ isActive }) => [isActive ? 'active' : '', PLAYOFF_PICTURE_IS_EARLY ? 'nav-muted' : ''].filter(Boolean).join(' ')}
          >
            Playoff Watch
          </NavLink>
        </nav>
      </div>
      <div className="wrap">
        <Outlet />

        {/* Sourced from package.json (not hand-typed) so it can't drift from the real shipped
            version -- same visible-version convention as the Tour de France app's page footers. */}
        <footer style={{ textAlign: 'center', padding: '20px 0 4px', fontSize: 11, color: 'var(--muted)', letterSpacing: '1px' }}>
          <div style={{ marginBottom: 6, letterSpacing: 'normal' }}>
            {/* Kickoff times (formatKickoff() in teams.js) render via the browser's own
                toLocaleString with no explicit timeZone -- i.e. each visitor's own local time,
                by design, not a fixed ET. A per-time zone abbreviation ("PDT", "EDT") already
                rides along on every individual kickoff, but that's easy to skim past; this is
                the explicit, sitewide version of the same fact. */}
            All times shown in your local time zone.
          </div>
          v{APP_VERSION}
        </footer>
      </div>
    </div>
  );
}
