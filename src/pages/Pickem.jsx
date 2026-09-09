import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  WEEK_IDX_MAX, WEEKLY_ORDER, teams, teamById, allGames, nextGameParts, deltaLabel, dirFor,
} from '../data/teams.js';
import { projectOrder, MIRROR } from '../utils/projectTop25.js';
import { useLiveScores } from '../utils/useLiveScores.js';
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

// teamId -> that team's allGames entry this week (the static, build-time snapshot). Used as the
// base for the live-merged version built inside the component -- see liveGameByTeam.
const GAME_BY_TEAM = {};
allGames.forEach((g) => {
  GAME_BY_TEAM[g.away] = g;
  GAME_BY_TEAM[g.home] = g;
});

// Distinct games (deduped by id) for the current Top 25's matchups, so useLiveScores can track
// them for live-final detection -- GAME_BY_TEAM maps both sides of a game to the SAME object, so
// dedupe by id first rather than passing every team's (duplicate) game in twice.
const PICKEM_GAMES = [...new Map(
  CURRENT_ORDER.map((id) => GAME_BY_TEAM[id]).filter(Boolean).map((g) => [g.id, g]),
).values()];

// Real result -> pick category, once a team's game is final. Margin >= 14 either way counts as a
// blowout (the user's own threshold) -- ties are impossible in football, so margin is never 0 for
// a final game. Returns null for a bye week or a game that hasn't finished yet -- those stay
// user-assignable via the chips. Takes the game object directly (not a teamId lookup) so it works
// the same whether `g` is the static snapshot or the live-merged version.
function autoResultFor(g, teamId) {
  if (!g || g.status !== 'final' || g.awayScore == null || g.homeScore == null) return null;
  const isHome = g.home === teamId;
  const mine = isHome ? g.homeScore : g.awayScore;
  const theirs = isHome ? g.awayScore : g.homeScore;
  const margin = mine - theirs;
  if (margin > 0) return margin >= 14 ? 'blowoutWin' : 'win';
  return Math.abs(margin) >= 14 ? 'blowoutLoss' : 'loss';
}

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
  // The static build-time snapshot only ever says 'scheduled' or 'final' (see
  // useLiveScores.js's header comment) -- without this overlay, a game that's ACTUALLY final per
  // ESPN mid-Saturday would still show interactive chips here while the rest of the site (This
  // Week, Full Slate, Up Next) already shows it final, letting a visitor "call" a game that's
  // already been decided.
  const liveOverlay = useLiveScores(PICKEM_GAMES);
  const liveGameByTeam = useMemo(() => {
    const merged = {};
    CURRENT_ORDER.forEach((id) => {
      const g = GAME_BY_TEAM[id];
      if (g) merged[id] = { ...g, ...(liveOverlay[g.id] ?? {}) };
    });
    return merged;
  }, [liveOverlay]);

  // Half-populated "what-if" baseline: every ranked team whose game has gone final (per the live
  // overlay, not just the static snapshot) gets its real result pre-filled. Recomputed whenever
  // the live overlay updates, so a game that goes final while the page is open transitions from
  // chips to a locked real result live, not just on the next full page load.
  const autoPicks = useMemo(() => {
    const next = {};
    CURRENT_ORDER.forEach((id) => {
      const result = autoResultFor(liveGameByTeam[id], id);
      if (result) next[id] = result;
    });
    return next;
  }, [liveGameByTeam]);

  // Manual (user-clicked) picks only -- kept separate from autoPicks so a game newly going final
  // mid-session cleanly overrides whatever the user had guessed, without needing to reconcile two
  // meanings of the same map. `picks` (used for the projection + chip active-state) merges the
  // two, auto taking precedence -- consistent with chips never rendering for an already-final
  // team in the first place (see the render below), so the two should never actually collide.
  const [manualPicks, setManualPicks] = useState({});
  const picks = useMemo(() => ({ ...manualPicks, ...autoPicks }), [manualPicks, autoPicks]);

  const projected = useMemo(
    () => projectOrder(CURRENT_ORDER, picks, teams, { getOpponentInfo, h2h: H2H }),
    [picks],
  );

  const anyManualPicks = Object.keys(manualPicks).some((id) => !autoPicks[id]);

  function handlePick(teamId, outcome) {
    setManualPicks((prev) => {
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

      {projected.length === 0 ? (
        // CURRENT_ORDER (and so `projected`, which just re-sorts it) is empty in the same rare
        // gap UpNext.jsx's empty state already covers -- e.g. a rollover window where the poll
        // for this week hasn't landed yet. Same honest-about-gaps message pattern, not a blank list.
        <p style={{ fontSize: 12.5, color: 'var(--ink-2)', margin: 0 }}>
          No Top 25 to pick yet -- check back once this week's poll is out.
        </p>
      ) : (
        <>
          <div className="pickem-list">
            {projected.map((id, i) => {
              const t = teamById(id);
              const currentRank = CURRENT_ORDER.indexOf(id) + 1;
              const move = currentRank - (i + 1); // positive = projected higher than today
              const { vsAt, opponentTeam, opponentRank, opponentName } = nextGameParts(t.nextGame);
              const liveGame = liveGameByTeam[id];
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
                  ) : liveGame?.status === 'final' ? (
                    // Already decided, not a hypothetical -- a static result instead of chips, same
                    // pattern the bye case above already uses (no click target to toggle a real result).
                    <span className="pick-final" style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
                      Final — {OUTCOMES.find((o) => o.value === picks[id])?.long}{' '}
                      ({liveGame.home === id ? liveGame.homeScore : liveGame.awayScore}
                      –{liveGame.home === id ? liveGame.awayScore : liveGame.homeScore})
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
            onClick={() => setManualPicks({})}
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
        </>
      )}
    </div>
  );
}
