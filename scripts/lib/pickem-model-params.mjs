// Tunable copy of src/utils/projectTop25.js for offline backtesting. Production stays untouched
// until a tuned candidate is agreed; pickem-model-params.test.js pins this copy to production's
// output at PARAMS_V1, so a backtest's baseline is the real model rather than an approximation.

const WINS = { blowoutWin: true, win: true };

export const PARAMS_V1 = Object.freeze({
  oppQualityScale: 60,
  winBase: 0.5,
  winQualitySlope: 2.5,
  blowoutWinMult: 1.5,
  lossBase: 1.25,
  lossWeakOppSlope: 3.25,
  blowoutLossMult: 1.6,
  cushionPerQualityWin: 0.4,
  cushionMax: 1.2,
  compDivisor: 8,
  compMax: 0.75,
  // Candidate settings; these defaults reproduce V1 exactly.
  driftScale: 1,
  unrankedLossPenalty: 0,
  surpriseK: 0,
  surpriseCap: 21,
  lossScale: 1,
  earlyWinScale: 1,
  earlyThroughWeek: 8,
});

// What src/utils/projectTop25.js runs now: V1 with every loss scaled 2.5x (experiment 2). Weeks
// snapshotted before that change still replay to their stored projections with PARAMS_V1.
export const PARAMS_LIVE = Object.freeze({ ...PARAMS_V1, lossScale: 2.5 });

function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

function opponentQuality(P, info) {
  const s = info?.oppPollRank ?? info?.oppSpRank ?? P.oppQualityScale;
  return clamp(1 - s / P.oppQualityScale, 0, 1);
}

function avgComputerRank(team) {
  const vals = [team?.sp, team?.fpi, team?.elo].filter((v) => v != null);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function driftV1(P, outcome, currentRank, team, oppInfo) {
  const q = opponentQuality(P, oppInfo);
  const comp = avgComputerRank(team);
  const compDelta = comp == null ? 0 : currentRank - comp;

  if (WINS[outcome]) {
    let drift = P.winBase + q * P.winQualitySlope;
    if (outcome === 'blowoutWin') drift *= P.blowoutWinMult;
    drift += clamp(compDelta / P.compDivisor, 0, P.compMax);
    return drift;
  }

  let magnitude = P.lossBase + (1 - q) * P.lossWeakOppSlope;
  if (outcome === 'blowoutLoss') magnitude *= P.blowoutLossMult;
  magnitude *= P.lossScale;
  const qualityWins = (team?.games ?? []).filter((g) => g.tag === 'quality').length;
  const cushion = Math.min(qualityWins * P.cushionPerQualityWin, P.cushionMax);
  let drift = Math.min(-magnitude + cushion, 0);
  drift -= clamp(-compDelta / P.compDivisor, 0, P.compMax);
  return drift;
}

// lineInfo: { margin, expectedMargin } from this team's side, or null when there's no line or the
// game isn't final -- the surprise term then contributes nothing. week: the poll week being
// re-sorted, for the early-season win scale (unknown week = no early-season scaling).
export function driftWith(P, outcome, currentRank, team, oppInfo, lineInfo, week = null) {
  const isLoss = !WINS[outcome];
  let drift = P.driftScale * driftV1(P, outcome, currentRank, team, oppInfo);
  if (!isLoss && week != null && week <= P.earlyThroughWeek) drift *= P.earlyWinScale;
  if (isLoss && oppInfo?.oppPollRank == null) drift -= P.unrankedLossPenalty;
  const surprise = lineInfo?.margin != null && lineInfo?.expectedMargin != null
    ? lineInfo.margin - lineInfo.expectedMargin
    : null;
  if (surprise != null) drift += P.surpriseK * clamp(surprise, -P.surpriseCap, P.surpriseCap);
  // V1's rule, kept for every candidate: a loss is never a net positive.
  return isLoss ? Math.min(drift, 0) : drift;
}

export function projectOrderWith(P, currentOrder, picks, teams, opts = {}) {
  const { getOpponentInfo, h2h, getLineInfo, week = null } = opts;

  const scored = currentOrder.map((id, i) => {
    const currentRank = i + 1;
    const outcome = picks[id];
    const drift = outcome
      ? driftWith(P, outcome, currentRank, teams?.[id],
        getOpponentInfo ? getOpponentInfo(id) : null, getLineInfo ? getLineInfo(id) : null, week)
      : 0;
    return { id, currentRank, key: currentRank - drift };
  });

  scored.sort((a, b) => a.key - b.key || a.currentRank - b.currentRank);
  const order = scored.map((s) => s.id);

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
