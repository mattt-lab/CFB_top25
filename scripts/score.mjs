// Stage 1 of the two-stage games/predictions pipeline: deterministic SELECTION, never narration.
// Reads data/current.json (written by fetch-cfb-data.mjs), scores every upcoming game and every
// ranked team, and reduces `games` down to the top handful worth surfacing on the "biggest games"
// panel and populates `predictions` with the top team storylines. Stage 2 (scripts/narrate.mjs)
// turns the survivors into prose -- it never gets to pick which ones matter, only how to phrase
// them, which is the whole point of keeping these two stages separate.
//
// Run with: node scripts/score.mjs   (after scripts/fetch-cfb-data.mjs has already run)

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { rankAt, distanceToCutoff } from './lib/ranking.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CURRENT_PATH = join(ROOT, 'data', 'current.json');

// How many games/predictions survive Stage 1, out of however many were fetched (often 50-100+ for
// a full FBS slate). Tunable -- these weights and this count are a starting point, not a
// calibrated model; expect to adjust once real weekly output has been eyeballed a few times.
const GAMES_KEPT = 6;
const PREDICTIONS_KEPT = 5;

function spreadMagnitude(spreadStr) {
  if (!spreadStr) return null;
  const m = spreadStr.match(/-?\d+(\.\d+)?\s*$/);
  return m ? Math.abs(parseFloat(m[0])) : null;
}

// How much a team's own trajectory + the gap between the poll and the computer ratings (SP+/FPI)
// makes them a live storyline this week -- used by both the game scorer (summed across both
// teams in a matchup) and the team-trend scorer (predictions panel).
function trajectoryScore(teamId, current) {
  const t = current.teams[teamId];
  if (!t) return 0;
  const rankNow = rankAt(current.rankingsByWeek, current.meta.currentWeek, teamId);
  if (rankNow == null) return 0;
  const rankPrev = current.meta.currentWeek > 1
    ? rankAt(current.rankingsByWeek, current.meta.currentWeek - 1, teamId)
    : null;
  const slope = rankPrev != null ? Math.abs(rankPrev - rankNow) : 0;
  const spGap = t.sp != null ? Math.abs(rankNow - t.sp) : 0;
  const fpiGap = t.fpi != null ? Math.abs(rankNow - t.fpi) : 0;
  return slope * 0.5 + (spGap + fpiGap) * 0.15;
}

function scoreGame(g, current) {
  const rankA = g.awayRank, rankB = g.homeRank;

  // 1. Rank magnitude -- both-ranked games weighted toward the top of the poll (1 vs 2 matters
  // far more than 24 vs 25). Requires BOTH teams ranked, not just either: an additive
  // `1/rankA + 1/rankB` let one elite team alone dominate the score regardless of opponent --
  // confirmed live, "Ball State at Ohio State" (a 49.5-point season-opening mismatch) outscored
  // a genuine ranked-vs-ranked game (#23 Clemson at #13 LSU) under that version. "Biggest games"
  // means two good teams playing each other, not one good team playing anyone.
  const rankMagnitude = (rankA != null && rankB != null) ? (1 / rankA + 1 / rankB) : 0;

  // 2. Seed-line stakes -- does either team sit close enough to a bye/field/bubble cutoff that
  // this result plausibly moves them across it.
  const stakes = (rankA != null ? Math.max(0, 5 - distanceToCutoff(rankA)) : 0)
    + (rankB != null ? Math.max(0, 5 - distanceToCutoff(rankB)) : 0);

  // 3. Trajectory -- teams the polls and the computers disagree about, or that are moving fast,
  // make for a more interesting game regardless of raw rank.
  const trajectory = trajectoryScore(g.away, current) + trajectoryScore(g.home, current);

  // 4. Rivalry flag -- already resolved by the fetch script against data/rivalries.json. Kept
  // outside the competitiveness discount below: a rivalry game is notable on the calendar even
  // when one side is favored (Army-Navy doesn't stop being a rivalry game because of a spread).
  const rivalryBonus = g.rivalry ? 3 : 0;

  // 5. Competitiveness -- a blowout doesn't really carry "stakes" no matter how close either
  // team sits to a cutoff, because the outcome isn't meaningfully in doubt. This is a discount
  // FACTOR applied to rank magnitude + stakes + trajectory together, not a small additive term --
  // confirmed live that an additive version wasn't enough: several 25+ point mismatches (a team
  // sitting right at the bubble cutoff vs. an overmatched, likely-FCS opponent) still outscored
  // a genuine ranked-vs-ranked game, because "stakes" alone stayed high regardless of how lopsided
  // the actual matchup was.
  const bothRanked = rankA != null && rankB != null;
  const spread = spreadMagnitude(g.spread);
  let competitivenessFactor;
  if (spread != null) {
    competitivenessFactor = Math.max(0.15, 1 - spread / 40);
  } else if (bothRanked) {
    competitivenessFactor = 0.85; // both ranked, line just not posted yet -- assume genuinely competitive
  } else {
    // One side unranked with no line posted at all is the FBS-vs-FCS "buy game" pattern (real
    // sportsbooks mostly don't bother lining these) -- don't let stakes alone carry a mismatch.
    competitivenessFactor = 0.3;
  }

  const core = rankMagnitude * 10 + stakes * 1.5 + trajectory;
  return core * competitivenessFactor + rivalryBonus;
}

function scoreTeamTrend(teamId, current) {
  const rank = rankAt(current.rankingsByWeek, current.meta.currentWeek, teamId);
  if (rank == null) return 0; // only surface teams that are actually ranked as storylines
  const cutoffProximity = Math.max(0, 5 - distanceToCutoff(rank));
  return trajectoryScore(teamId, current) * 1.5 + cutoffProximity;
}

function main() {
  const current = JSON.parse(readFileSync(CURRENT_PATH, 'utf8'));

  const totalGames = current.games.length;
  const scoredGames = current.games
    .map((g) => ({ ...g, stakesScore: Math.round(scoreGame(g, current) * 100) / 100 }))
    .sort((a, b) => b.stakesScore - a.stakesScore);
  const keptGames = scoredGames.slice(0, GAMES_KEPT);
  if (totalGames > GAMES_KEPT) {
    console.log(`Games: kept top ${GAMES_KEPT} of ${totalGames} by stakesScore (dropped ${totalGames - GAMES_KEPT}).`);
  } else {
    console.log(`Games: ${totalGames} available, all kept (below the ${GAMES_KEPT}-game cap).`);
  }

  const teamIds = Object.keys(current.teams);
  const scoredTeams = teamIds
    .map((id) => ({ teamId: id, score: Math.round(scoreTeamTrend(id, current) * 100) / 100 }))
    .filter((t) => t.score > 0)
    .sort((a, b) => b.score - a.score);
  const keptPredictions = scoredTeams.slice(0, PREDICTIONS_KEPT).map((t) => ({
    teamId: t.teamId,
    score: t.score,
    // populated by Stage 2 (scripts/narrate.mjs), which doesn't exist yet in this commit
    blurb: null,
    blurbSource: null,
  }));
  console.log(`Predictions: ${scoredTeams.length} teams had a nonzero trend score, kept top ${keptPredictions.length}.`);

  current.games = keptGames;
  current.predictions = keptPredictions;

  writeFileSync(CURRENT_PATH, JSON.stringify(current, null, 2) + '\n');
  console.log(`Wrote ${CURRENT_PATH}.`);
}

main();
