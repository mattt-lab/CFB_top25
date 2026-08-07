// Pure "what-if" re-ranking model for the Top 25 Pick 'em page. Takes the current poll order and
// the user's called outcomes, returns a projected order. Deliberately simple and fully
// deterministic -- a drift-per-team heuristic plus one hard constraint -- NOT a committee
// simulation (the page's footnote says as much). Kept pure (no imports from data/teams.js, all
// data arrives via arguments) so it can be unit-tested against small synthetic fixtures.

// Outcome mirror for head-to-head auto-sync: when two ranked teams play each other, picking one
// side implies the other. Exported so the page's click handler and the tests share one source of
// truth instead of hand-writing the pairs twice.
export const MIRROR = {
  blowoutWin: 'blowoutLoss',
  win: 'loss',
  loss: 'win',
  blowoutLoss: 'blowoutWin',
};

const WINS = { blowoutWin: true, win: true };

function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

// How good is the opponent, on a 0..1 scale? Poll rank if ranked, else SP+ rank, else assume a
// generic unranked opponent (rank ~60). q=1 means "beat/lost to the #1-ish team", q=0 means
// "a team outside the top 60".
function opponentQuality(info) {
  const s = info?.oppPollRank ?? info?.oppSpRank ?? 60;
  return clamp(1 - s / 60, 0, 1);
}

// Average of the non-null computer ratings (SP+/FPI/Elo ranks); null when none exist.
function avgComputerRank(team) {
  const vals = [team?.sp, team?.fpi, team?.elo].filter((v) => v != null);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

// Signed drift in "rank slots" for one team's picked outcome. Positive = should rise.
function driftFor(outcome, currentRank, team, oppInfo) {
  const q = opponentQuality(oppInfo);
  const comp = avgComputerRank(team);
  // Positive compDelta = the computers rate this team BETTER than its poll rank.
  const compDelta = comp == null ? 0 : currentRank - comp;

  if (WINS[outcome]) {
    let drift = 0.5 + q * 2.5;
    if (outcome === 'blowoutWin') drift *= 1.5;
    // Computer nudge: a computer-favored team gets extra credit for winning.
    drift += clamp(compDelta / 8, 0, 0.75);
    return drift;
  }

  // Losses: worse opponents hurt more; blowouts hurt more still.
  let magnitude = 1.25 + (1 - q) * 3.25;
  if (outcome === 'blowoutLoss') magnitude *= 1.6;
  // Resume cushion: quality wins already banked soften the fall -- but a loss can never be a
  // net positive, no matter how strong the resume (clamped at 0 before the computer nudge,
  // which is itself <= 0 on losses).
  const qualityWins = (team?.games ?? []).filter((g) => g.tag === 'quality').length;
  const cushion = Math.min(qualityWins * 0.4, 1.2);
  let drift = Math.min(-magnitude + cushion, 0);
  // Computer nudge: only when the computers rate them WORSE than the poll does a loss get the
  // extra shove (the poll was "wrong" about them and the loss confirms it).
  drift -= clamp(-compDelta / 8, 0, 0.75);
  return drift;
}

/**
 * Project a new Top 25 order from picked outcomes.
 *
 * @param {string[]} currentOrder - team ids, best first (the real current Top 25)
 * @param {Object} picks - { teamId: 'blowoutWin'|'win'|'loss'|'blowoutLoss' }; unpicked/bye
 *   teams simply hold position passively (drift 0)
 * @param {Object} teams - team entries keyed by id; each may carry sp/fpi/elo (integer ranks or
 *   null) and games[] with tag fields. Missing entries degrade to drift-neutral defaults.
 * @param {Object} [opts]
 * @param {(teamId: string) => {oppPollRank, oppSpRank}|null} [opts.getOpponentInfo] - resolver
 *   for this week's opponent quality (built by the page from allGames; injected so this function
 *   stays pure). Absent/null => generic unranked opponent.
 * @param {Object} [opts.h2h] - { teamId: opponentTeamId } for games where BOTH teams are ranked;
 *   symmetric. Used for the hard constraint that a picked winner always ends above its picked
 *   loser, whatever the drift arithmetic said.
 * @returns {string[]} the projected order (new array; input not mutated)
 */
export function projectOrder(currentOrder, picks, teams, opts = {}) {
  const { getOpponentInfo, h2h } = opts;

  const scored = currentOrder.map((id, i) => {
    const currentRank = i + 1;
    const outcome = picks[id];
    const drift = outcome
      ? driftFor(outcome, currentRank, teams?.[id], getOpponentInfo ? getOpponentInfo(id) : null)
      : 0;
    return { id, currentRank, key: currentRank - drift };
  });

  // Ascending by projected key, with a STABLE tiebreak on current rank (so drift-0 teams never
  // reorder among themselves).
  scored.sort((a, b) => a.key - b.key || a.currentRank - b.currentRank);
  const order = scored.map((s) => s.id);

  // Hard constraint: in a picked head-to-head between two ranked teams, the winner ends above the
  // loser -- beating a fellow ranked team always puts you ahead of them, even when the drift
  // arithmetic (a big current-rank gap, cushions, computer nudges) says otherwise. Splice the
  // winner to directly above the loser. Each pair visited once (id < oppId dedupes the symmetric
  // map); pairs processed in loser-rank order for determinism.
  if (h2h) {
    const pairs = [];
    for (const id of Object.keys(h2h)) {
      const opp = h2h[id];
      if (id < opp && WINS[picks[id]] && picks[opp] && !WINS[picks[opp]]) {
        pairs.push({ winner: id, loser: opp });
      } else if (id < opp && WINS[picks[opp]] && picks[id] && !WINS[picks[id]]) {
        pairs.push({ winner: opp, loser: id });
      }
    }
    pairs.sort((a, b) => order.indexOf(a.loser) - order.indexOf(b.loser));
    for (const { winner, loser } of pairs) {
      const wi = order.indexOf(winner);
      const li = order.indexOf(loser);
      if (wi > li && wi !== -1 && li !== -1) {
        order.splice(wi, 1);
        order.splice(li, 0, winner);
      }
    }
  }

  return order;
}
