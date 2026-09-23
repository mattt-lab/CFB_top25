// Test fixture: synthetic seasons whose "real" next poll comes from a known voter model, so a
// tuning or holdout rule's right answer is known in advance. Used only by the *.test.js files.

import { replayWeek } from './pickem-backtest.mjs';
import { mulberry32 } from './pickem-tuning.mjs';

export const IDS = Array.from({ length: 12 }, (_, i) => `t${String(i + 1).padStart(2, '0')}`);

// `loser` pins every loss on one team.
export function makeWeek(rand, week, truth, { loser = null } = {}) {
  const currentOrder = [...IDS].sort(() => rand() - 0.5);
  const teams = currentOrder.map((id) => {
    const loses = loser ? id === loser : rand() < 0.25;
    const outcome = loses ? (rand() < 0.5 ? 'loss' : 'blowoutLoss') : (rand() < 0.5 ? 'win' : 'blowoutWin');
    const margin = loses ? -1 - Math.floor(rand() * 20) : 1 + Math.floor(rand() * 30);
    return {
      id, outcome,
      inputs: { sp: null, fpi: null, elo: null, qualityWins: 0, oppPollRank: null, oppSpRank: 20 + Math.floor(rand() * 80) },
      game: { opponent: `opp-${id}`, margin, expectedMargin: Math.floor(rand() * 30) - 5 + 0.5 },
    };
  });
  const record = { season: 2025, week, currentOrder, teams };
  return { ...record, actualOrder: replayWeek(record, truth) };
}

export function syntheticSeason(seed, truthFor, opts = {}) {
  const rand = mulberry32(seed);
  return Array.from({ length: 14 }, (_, i) => makeWeek(rand, i + 1, truthFor(i + 1), opts));
}
