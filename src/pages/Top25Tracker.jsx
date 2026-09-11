import { Link } from 'react-router-dom';
import {
  WEEK_IDX_MAX, games, predictions, formatKickoff,
  gameStatusBadge, rankedGamesThisWeek,
} from '../data/teams.js';
import { useLiveScores } from '../utils/useLiveScores.js';
import MyTeamsSection from '../components/MyTeamsSection.jsx';
import TeamMark from '../components/TeamMark.jsx';
import RankedMatchupsTable from '../components/RankedMatchupsTable.jsx';

export default function Top25Tracker() {
  const currentWeekNumber = WEEK_IDX_MAX + 1;
  // rankedGamesThisWeek() is unsorted (same convention as gamesInConf()) -- sort here, not in
  // the data layer. Duplicates with the "biggest games" cards above are intentional, not deduped.
  // A game with no kickoff time yet (TBD, common before a week's broadcast schedule firms up)
  // sorts to the END, not the top -- `new Date(null)` coerces to the Unix epoch (1970), which
  // would otherwise float a TBD ranked matchup above every real kickoff time in the table.
  const rankedGames = rankedGamesThisWeek().slice().sort((a, b) => {
    if (!a.when && !b.when) return 0;
    if (!a.when) return 1;
    if (!b.when) return -1;
    return new Date(a.when) - new Date(b.when);
  });
  // ONE shared ESPN fetch covers both the marquee panel and the full-slate table below -- `games`
  // (the marquee) is a subset of the ranked slate more often than not, so deduping by id here
  // avoids two near-simultaneous fetches of the same ESPN scoreboard for the same games.
  const trackedGamesById = new Map();
  for (const g of games) trackedGamesById.set(g.id, g);
  for (const g of rankedGames) trackedGamesById.set(g.id, g);
  const liveOverlay = useLiveScores([...trackedGamesById.values()]);
  const liveRankedGames = rankedGames.map((g) => ({ ...g, ...(liveOverlay[g.id] ?? {}) }));

  return (
    <div>
      <div className="page-title">
        <div className="eyebrow">Week {currentWeekNumber}</div>
        <h1>CFB This Week</h1>
        <p>This week's biggest games and what the model expects next.</p>
      </div>

      <MyTeamsSection />

      <section>
        <div className="panel-title" style={{ marginBottom: 10 }}>
          <div>
            <h2 style={{ fontSize: 17 }}>This week's biggest games</h2>
          </div>
        </div>
        <div className="games-grid">
          {games.map((base) => {
            const g = { ...base, ...(liveOverlay[base.id] ?? {}) };
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
                    <span className="team-inline">
                      {g.awayRank != null && <span className="r">#{g.awayRank}</span>}
                      {g.awayTeam && <TeamMark team={g.awayTeam} />}
                      {g.awayTeam?.name ?? g.away}
                    </span>
                    {g.awayTeam?.record && (
                      <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 12 }}> ({g.awayTeam.record})</span>
                    )}
                  </Link>
                  <div className="game-at">at</div>
                  <Link className="game-team" to={`/team/${g.home}`}>
                    <span className="team-inline">
                      {g.homeRank != null && <span className="r">#{g.homeRank}</span>}
                      {g.homeTeam && <TeamMark team={g.homeTeam} />}
                      {g.homeTeam?.name ?? g.home}
                    </span>
                    {g.homeTeam?.record && (
                      <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 12 }}> ({g.homeTeam.record})</span>
                    )}
                  </Link>
                </div>
                <div className={`game-line${decided ? ' game-line-score' : ''}`}>
                  {decided ? (
                    // Team names are already shown above (with rank + logo) -- repeating them here
                    // just to label two numbers was what kept this line stuck at 12px body-text
                    // size. Same away-left/home-right order as .game-teams above it, so position
                    // alone still says which score is which.
                    <span className={`score${badge.live ? ' score-live' : ''}`}>
                      <span className="score-num">{g.awayScore}</span>
                      <span className="score-sep">–</span>
                      <span className="score-num">{g.homeScore}</span>
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
            <h2>Current trends and insights — Week {currentWeekNumber}</h2>
            {/* "expects"/N -> N+1 implied a forecast this panel never made -- the underlying
                facts (rank vs last week's rank, SP+/FPI gap) are about where a team stands RIGHT
                NOW, not a prediction of next week. Renamed to match what it actually says. */}
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

      <RankedMatchupsTable games={liveRankedGames} />
    </div>
  );
}
