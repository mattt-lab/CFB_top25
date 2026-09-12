import { Link } from 'react-router-dom';
import { usePinnedStore } from '../store/usePinnedStore.js';
import {
  teamById, rankAt, byRankAsc, nextGameParts, gameStatusBadge, formatKickoff, allGames, WEEK_IDX_MAX,
} from '../data/teams.js';
import { useLiveScores, toPseudoGame } from '../utils/useLiveScores.js';
import TeamMark from './TeamMark.jsx';
import PinButton from './PinButton.jsx';

// allGames (the full current-week slate) carries spread/ou -- nextGame (teams[id].nextGame) does
// not, so a pinned team's own game is looked up here by cfbdId, the same join key narrate.mjs
// already uses to attach nextGame.blurb. Built once per render, not once per row.
function gameByCfbdId() {
  const map = new Map();
  for (const g of allGames) map.set(g.cfbdId, g);
  return map;
}

export default function MyTeamsSection() {
  const pinned = usePinnedStore((s) => s.pinned);

  const visible = pinned
    // A pinned id can outlive the team it pointed to (a rename, or a schema change) — drop
    // anything that no longer resolves rather than crashing the whole section.
    .filter((id) => teamById(id))
    .map((id) => ({ id, rank: rankAt(id, WEEK_IDX_MAX), team: teamById(id) }))
    // Unranked (rank === null -- e.g. pinned from a direct team-page visit rather than the Top
    // 25 table) sorts to the end, not the front.
    .sort(byRankAsc((x) => x.rank));

  // One shared fetch covers every pinned team's next game, not one per row -- must be called
  // unconditionally (rules of hooks), before the empty-list early return below.
  const pseudoGames = visible.map(({ id, team }) => toPseudoGame(id, team.nextGame)).filter(Boolean);
  const liveOverlay = useLiveScores(pseudoGames);
  const gamesByCfbdId = gameByCfbdId();

  // Nothing to show -- drop the whole card rather than an always-there empty-state message,
  // which was permanent clutter on the very first thing every visitor saw on the homepage.
  if (!visible.length) return null;

  return (
    // Plain section, not .card -- the title lives OUTSIDE any card here, same as "This week's
    // biggest games" below it and PlayoffWatch's own bubble-list usage.
    <section style={{ marginBottom: 22 }}>
      <div className="panel-title" style={{ marginBottom: 10 }}>
        <div>
          <h2 style={{ fontSize: 17 }}>Your Teams</h2>
          <p>Pinned teams — click the ☆ on any team below to add it here.</p>
        </div>
      </div>
      <div className="pinned-list">
        {visible.map(({ id, rank, team: t }) => {
          const {
            vsAt, opponentTeam, opponentRank, opponentName,
            homeAway, status, awayScore, homeScore, period, clock,
          } = nextGameParts(t.nextGame ? { ...t.nextGame, ...(liveOverlay[id] ?? {}) } : null);
          const badge = gameStatusBadge(status, period, clock);
          const decided = status === 'in_progress' || status === 'final';
          const mine = homeAway === 'home' ? homeScore : awayScore;
          const theirs = homeAway === 'home' ? awayScore : homeScore;
          const matchedGame = t.nextGame ? gamesByCfbdId.get(t.nextGame.cfbdId) : null;
          return (
            // Same three-part shape as "This week's biggest games" below it, reusing its
            // .game-card/.game-meta/.game-teams/.game-line/.game-impl classes directly: kickoff +
            // network + pin star on top, the matchup in the middle, spread/O-U (or the live/final
            // score) on the dashed line, narrative last. .game-card gets position:relative (see
            // theme.css) so .row-link::after below can stretch a click target across the whole
            // card, same trick the old .bubble-row used -- PinButton stays a plain sibling with
            // its own z-index (theme.css) so tapping the star doesn't also trigger that navigation.
            <div key={id} className="game-card">
              <div className="game-meta game-meta-pinned">
                <span>
                  {badge.text ? (
                    <span className={`badge-status${badge.live ? ' badge-live' : ' badge-final'}`}>
                      {badge.live && <span className="pulse-dot" aria-hidden="true" />}
                      {/* Live: just the quarter/clock, no "LIVE" text -- same as the marquee cards
                          and GameSlateTable's kickoff column (Up Next / Full Slate). */}
                      {badge.live ? badge.detail : badge.text}
                    </span>
                  ) : (
                    t.nextGame && formatKickoff(t.nextGame.when, true)
                  )}
                  {/* Space-separated once live ("Q4 4:00 FOX", no middot) matching GameSlateTable;
                      the dot stays for the scheduled case ("SAT 2:30 PM · BTN"). */}
                  {(!badge.text || badge.live) && t.nextGame?.network && (
                    <span>{badge.live ? ' ' : ' · '}{t.nextGame.network}</span>
                  )}
                </span>
                <PinButton teamId={id} />
              </div>
              <div className="game-teams">
                <Link className="game-team row-link" to={`/team/${id}`} state={{ from: 'top25' }}>
                  <span className="team-inline">
                    {rank != null && <span className="r">#{rank}</span>}
                    <TeamMark team={t} />
                    {t.name}
                  </span>
                  {/* 0-0 just means the season hasn't started for this team yet -- not a stat
                      worth a permanent slot on the card before it means anything. */}
                  {(t.wins > 0 || t.losses > 0) && (
                    <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 12 }}> ({t.record})</span>
                  )}
                </Link>
                {opponentName ? (
                  <>
                    <div className="game-at">{vsAt}</div>
                    <span className="game-team">
                      <span className="team-inline">
                        {opponentRank != null && <span className="r">#{opponentRank}</span>}
                        {opponentTeam && <TeamMark team={opponentTeam} />}
                        {opponentName}
                      </span>
                      {opponentTeam?.record && (
                        <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 12 }}> ({opponentTeam.record})</span>
                      )}
                    </span>
                  </>
                ) : (
                  <span style={{ color: 'var(--muted)' }}>Bye week</span>
                )}
              </div>
              {t.nextGame && (
                <div className={`game-line${decided ? ' game-line-score' : ''}`}>
                  {decided ? (
                    // mine/theirs (not away/home) -- this card is "my" team's perspective, so my
                    // score always sits on the same side as my team's name above it.
                    <span className={`score${badge.live ? ' score-live' : ''}`}>
                      <span className="score-num">{mine}</span>
                      <span className="score-sep">–</span>
                      <span className="score-num">{theirs}</span>
                    </span>
                  ) : (
                    <>
                      {matchedGame?.spread && <span className="spread">{matchedGame.spread}</span>}
                      {matchedGame?.ou != null && <span style={{ color: 'var(--muted)' }}>O/U {matchedGame.ou}</span>}
                    </>
                  )}
                </div>
              )}
              {/* Only ever set (see score.mjs/narrate.mjs) when this team's next game involves at
                  least one currently-ranked Top 25 team -- an unranked pin playing an unranked
                  opponent just renders no blurb line at all, not an empty one. */}
              {t.nextGame?.blurb && <div className="game-impl">{t.nextGame.blurb}</div>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
