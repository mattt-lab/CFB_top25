import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  WEEK_IDX_MAX, WEEKLY_ORDER, teams, teamById, allGames, nextGameParts, deltaLabel, dirFor,
} from '../data/teams.js';
import { projectOrder, MIRROR } from '../utils/projectTop25.js';
import TeamMark from '../components/TeamMark.jsx';

const OUTCOMES = [
  { value: 'blowoutWin', long: 'Blowout W', short: 'Blw W' },
  { value: 'win', long: 'W', short: 'W' },
  { value: 'loss', long: 'L', short: 'L' },
  { value: 'blowoutLoss', long: 'Blowout L', short: 'Blw L' },
];

// Current Top 25 only -- Pick 'em is deliberately a current-week-only page (no week travel; see
// Layout's WEEK_TRAVEL_PATTERNS comment), so it reads WEEK_IDX_MAX directly like Conferences does.
const CURRENT_ORDER = WEEKLY_ORDER[WEEK_IDX_MAX];
const RANKED = {};
CURRENT_ORDER.forEach((id) => { RANKED[id] = true; });

// { teamId: opponentTeamId } for THIS week's slate, from allGames (the full ~90-100 game slate,
// not the marquee 6) -- module-level since the slate is fixed for the session.
const OPP_ID = {};
allGames.forEach((g) => {
  OPP_ID[g.away] = g.home;
  OPP_ID[g.home] = g.away;
});

// Head-to-head map restricted to games where BOTH teams are in the current Top 25 -- these are the
// picks that auto-sync (calling one side calls the other) and get the winner-above-loser hard
// constraint in the model.
const H2H = {};
allGames.forEach((g) => {
  if (RANKED[g.away] && RANKED[g.home]) {
    H2H[g.away] = g.home;
    H2H[g.home] = g.away;
  }
});

// teamId -> that team's allGames entry this week, for the auto-populate/real-result lookups below.
const GAME_BY_TEAM = {};
allGames.forEach((g) => {
  GAME_BY_TEAM[g.away] = g;
  GAME_BY_TEAM[g.home] = g;
});

// Real result -> pick category, once a team's game is final. Margin >= 14 either way counts as a
// blowout (the user's own threshold) -- ties are impossible in football, so margin is never 0 for
// a final game. Returns null for a bye week or a game that hasn't finished yet -- those stay
// user-assignable via the chips, same as today.
function autoResultFor(teamId) {
  const g = GAME_BY_TEAM[teamId];
  if (!g || g.status !== 'final' || g.awayScore == null || g.homeScore == null) return null;
  const isHome = g.home === teamId;
  const mine = isHome ? g.homeScore : g.awayScore;
  const theirs = isHome ? g.awayScore : g.homeScore;
  const margin = mine - theirs;
  if (margin > 0) return margin >= 14 ? 'blowoutWin' : 'win';
  return Math.abs(margin) >= 14 ? 'blowoutLoss' : 'loss';
}

// Half-populated "what-if" baseline: every ranked team whose game has already gone final gets its
// real result pre-filled, so the projection reflects reality as the week plays out. A team whose
// game hasn't finished yet gets no entry here -- unchanged, still freely assignable via chips.
const AUTO_PICKS = {};
CURRENT_ORDER.forEach((id) => {
  const result = autoResultFor(id);
  if (result) AUTO_PICKS[id] = result;
});

// Opponent-quality resolver for the model: poll rank straight off the slate entry, SP+ rank via
// the opponent's own team record (may be absent for a non-Power-4 unranked opponent -- degrades
// to null, which the model treats as a generic unranked team).
function getOpponentInfo(teamId) {
  const oppId = OPP_ID[teamId];
  if (!oppId) return null;
  const idx = CURRENT_ORDER.indexOf(oppId);
  return {
    oppPollRank: idx === -1 ? null : idx + 1,
    oppSpRank: teamById(oppId)?.sp ?? null,
  };
}

export default function Pickem() {
  const [picks, setPicks] = useState(AUTO_PICKS);

  const projected = useMemo(
    () => projectOrder(CURRENT_ORDER, picks, teams, { getOpponentInfo, h2h: H2H }),
    [picks],
  );

  // No chip ever exists for an AUTO_PICKS team (see the render below), so `picks` can only ever
  // gain keys beyond that baseline -- never lose or overwrite one -- making a length comparison a
  // reliable "any manual calls on top of the real results" check.
  const anyManualPicks = Object.keys(picks).length > Object.keys(AUTO_PICKS).length;

  function handlePick(teamId, outcome) {
    setPicks((prev) => {
      const next = { ...prev };
      const opp = H2H[teamId];
      if (prev[teamId] === outcome) {
        // Re-click deselects -- and un-calls the mirrored side of a ranked-vs-ranked game too.
        delete next[teamId];
        if (opp) delete next[opp];
      } else {
        next[teamId] = outcome;
        if (opp) next[opp] = MIRROR[outcome];
      }
      return next;
    });
  }

  return (
    <div>
      <div className="page-title">
        <div className="eyebrow">Week {WEEK_IDX_MAX + 1} · what-if</div>
        <h1>Top 25 Pick 'em</h1>
        <p>Call this week's games and watch the AP Top 25 re-sort itself into a projected order.</p>
      </div>

      <div className="pickem-list">
        {projected.map((id, i) => {
          const t = teamById(id);
          const currentRank = CURRENT_ORDER.indexOf(id) + 1;
          const move = currentRank - (i + 1); // positive = projected higher than today
          const { vsAt, opponentTeam, opponentRank, opponentName } = nextGameParts(t.nextGame);
          return (
            <div key={id} className="pickem-row">
              <span className="pickem-head">
                <span className="rk tabnum">{i + 1}</span>
                <span className={`delta-badge ${dirFor(move)}`}>{deltaLabel(move)}</span>
                <span className="info">
                  <TeamMark team={t} />
                  <Link className="nm" to={`/team/${id}`} state={{ from: 'top25' }}>{t.name}</Link>
                  {opponentName && (
                    <span className="opp">
                      {vsAt} {opponentRank != null && `#${opponentRank} `}
                      {opponentTeam && <TeamMark team={opponentTeam} />}
                      {opponentName}
                    </span>
                  )}
                </span>
              </span>
              {!t.nextGame ? (
                <span className="bye">Bye</span>
              ) : GAME_BY_TEAM[id]?.status === 'final' ? (
                // Already decided, not a hypothetical -- a static result instead of chips, same
                // pattern the bye case above already uses (no click target to toggle a real result).
                <span className="pick-final" style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
                  Final — {OUTCOMES.find((o) => o.value === picks[id])?.long}{' '}
                  ({GAME_BY_TEAM[id].home === id ? GAME_BY_TEAM[id].homeScore : GAME_BY_TEAM[id].awayScore}
                  –{GAME_BY_TEAM[id].home === id ? GAME_BY_TEAM[id].awayScore : GAME_BY_TEAM[id].homeScore})
                </span>
              ) : (
                <span className="pick-chips" role="group" aria-label={`Call ${t.name}'s game`}>
                  {OUTCOMES.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      className={`pick-chip${picks[id] === o.value ? ' active' : ''}`}
                      aria-pressed={picks[id] === o.value}
                      onClick={() => handlePick(id, o.value)}
                    >
                      <span className="long">{o.long}</span>
                      <span className="short">{o.short}</span>
                    </button>
                  ))}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        className="toggle-btn"
        onClick={() => setPicks(AUTO_PICKS)}
        disabled={!anyManualPicks}
        style={anyManualPicks ? undefined : { opacity: 0.5, cursor: 'default' }}
      >
        Reset picks
      </button>

      <p className="footnote">
        Movement scales with opponent quality (poll rank, else SP+) and the margin you call —
        upsets move mountains, expected wins barely register, a strong resume cushions a bad week,
        and beating a fellow ranked team always puts you ahead of them. A simplified model, not a
        committee simulation.
      </p>
    </div>
  );
}
