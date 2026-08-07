import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  WEEK_IDX_MAX, WEEKLY_ORDER, teams, teamById, allGames, nextGameParts, deltaLabel, dirFor,
} from '../data/teams.js';
import { projectOrder, MIRROR } from '../utils/projectTop25.js';

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
  const [picks, setPicks] = useState({});

  const projected = useMemo(
    () => projectOrder(CURRENT_ORDER, picks, teams, { getOpponentInfo, h2h: H2H }),
    [picks],
  );

  const anyPicks = Object.keys(picks).length > 0;

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
        <p>Call this week's games and watch the Top 25 re-sort itself into a projected order.</p>
      </div>

      <div className="pickem-list">
        {projected.map((id, i) => {
          const t = teamById(id);
          const currentRank = CURRENT_ORDER.indexOf(id) + 1;
          const move = currentRank - (i + 1); // positive = projected higher than today
          const { opponent } = nextGameParts(t.nextGame);
          return (
            <div key={id} className="pickem-row">
              <span className="rk tabnum">{i + 1}</span>
              <span className={`delta-badge ${dirFor(move)}`}>{deltaLabel(move)}</span>
              <span className="info">
                {/* No logo yet -- TeamMark slots in right before this Link in a follow-up. */}
                <Link className="nm" to={`/team/${id}`} state={{ from: 'top25' }}>{t.name}</Link>
                {opponent && <span className="opp">{opponent}</span>}
              </span>
              {t.nextGame ? (
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
              ) : (
                <span className="bye">Bye</span>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        className="toggle-btn"
        onClick={() => setPicks({})}
        disabled={!anyPicks}
        style={anyPicks ? undefined : { opacity: 0.5, cursor: 'default' }}
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
