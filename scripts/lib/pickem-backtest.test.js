import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectOrder } from '../../src/utils/projectTop25.js';
import { PARAMS_V1 } from './pickem-model-params.mjs';
import { buildHistoryWeeks } from './pickem-history.mjs';
import {
  weekWeight, replayInputs, replayWeek, pairwiseScore, rootMovers, rootMoverMae, evaluate,
} from './pickem-backtest.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const WK3 = readJson('data/pickem-snapshots/2026-wk03.json');
const WK4_AP = readJson('data/rankings/2026-wk04.json').polls.ap;

describe('weekWeight', () => {
  it('half-weights transitions out of poll weeks 1 and 2, full weight from week 3 on', () => {
    expect([1, 2, 3, 4, 12].map(weekWeight)).toEqual([0.5, 0.5, 1, 1, 1]);
  });
});

describe('replayWeek', () => {
  it('reproduces the frozen 2026 week 3 projection from its stored inputs', () => {
    expect(replayWeek(WK3, PARAMS_V1)).toEqual(WK3.projectedOrder);
  });

  it('feeds production projectOrder the same inputs (V1 copy and production agree)', () => {
    const { currentOrder, picks, teams, opts } = replayInputs(WK3);
    expect(projectOrder(currentOrder, picks, teams, opts)).toEqual(WK3.projectedOrder);
  });

  it('uses the Elo rank as the opponent-quality stand-in when a record has no SP+ rank', () => {
    const record = {
      currentOrder: ['a', 'b'],
      teams: [
        { id: 'a', outcome: 'loss', inputs: { sp: null, fpi: null, elo: null, qualityWins: 0, oppPollRank: null, oppSpRank: null, oppEloRank: 5 }, game: { opponent: 'x', margin: -3, expectedMargin: 7 } },
        { id: 'b', outcome: null, inputs: { sp: null, fpi: null, elo: null, qualityWins: 0, oppPollRank: null, oppSpRank: null }, game: null },
      ],
    };
    expect(replayInputs(record).opts.getOpponentInfo('a')).toEqual({ oppPollRank: null, oppSpRank: 5 });
    expect(replayInputs(record).opts.getLineInfo('a')).toEqual({ margin: -3, expectedMargin: 7 });
    expect(replayInputs(record).opts.getLineInfo('b')).toBeNull();
  });
});

describe('every recorded week', () => {
  const recorded = [
    readJson('data/pickem-backtest/2026-wk01.json'),
    readJson('data/pickem-backtest/2026-wk02.json'),
    WK3,
    ...buildHistoryWeeks(readJson('data/pickem-history/2025-raw.json')).records,
  ];

  it('replays through production projectOrder and the V1 copy to the stored projection', () => {
    expect(recorded.length).toBe(18);
    for (const rec of recorded) {
      const { currentOrder, picks, teams, opts } = replayInputs(rec);
      expect(projectOrder(currentOrder, picks, teams, opts)).toEqual(rec.projectedOrder);
      expect(replayWeek(rec, PARAMS_V1)).toEqual(rec.projectedOrder);
    }
  });
});

describe('pairwiseScore', () => {
  it('counts real swaps (baseline) and projection errors, with exits tied at #26 and entrants ignored', () => {
    // c drops out, e enters. Real swaps: (a,b) and (c,d). Projection keeps a above b (wrong) and
    // flips d above c (right).
    const s = pairwiseScore(['a', 'b', 'c', 'd'], ['a', 'b', 'd', 'c'], ['b', 'a', 'd', 'e']);
    expect(s).toMatchObject({ dBase: 2, dModel: 1, flipsMade: 1, flipsRight: 1, exits: ['c'], entrants: ['e'] });
    expect(s.perTeam.a).toEqual({ base: 0.5, model: 0.5 });
    expect(s.perTeam.c).toEqual({ base: 0.5, model: 0 });
  });

  it('never scores a pair of two teams that both dropped out', () => {
    const s = pairwiseScore(['a', 'b', 'c'], ['c', 'b', 'a'], ['a']);
    expect(s).toMatchObject({ dBase: 0, dModel: 2 });
  });

  it('matches the hand count for 2026 week 3 -> week 4', () => {
    // 23 teams in both polls: 31 real swaps, 16 wrong, 15/15 flips right (checked 2026-09-23).
    // Oklahoma and Virginia fell out: the projection kept Oklahoma above Houston -> one more error
    // and one more (wrong) flip.
    expect(pairwiseScore(WK3.currentOrder, WK3.projectedOrder, WK4_AP))
      .toMatchObject({ dBase: 31, dModel: 17, flipsMade: 16, flipsRight: 15 });
  });
});

describe('rootMovers', () => {
  it('finds the six root movers the week 3 doc found, with USC passive by the unchanged-rank rule', () => {
    const { movers } = rootMovers(WK3.currentOrder, WK4_AP);
    expect([...movers].sort()).toEqual(['louisville', 'lsu', 'ole-miss', 'smu', 'texas-a-m', 'texas-tech']);
  });

  it('counts both teams in a symmetric swap as movers', () => {
    expect([...rootMovers(['a', 'b', 'c', 'd'], ['b', 'a', 'c', 'd']).movers].sort()).toEqual(['a', 'b']);
  });

  it('reproduces the week 3 doc root-mover error: 3.0 model vs 6.0 baseline', () => {
    expect(rootMoverMae(WK3.currentOrder, WK3.projectedOrder, WK4_AP)).toEqual({ n: 6, model: 3, baseline: 6 });
  });
});

describe('evaluate', () => {
  it('weights each week and reports skill = 1 - weighted model errors / weighted real swaps', () => {
    const wk = (week, currentOrder, actualOrder) => ({
      season: 2025, week, currentOrder, actualOrder,
      teams: currentOrder.map((id) => ({ id, outcome: null, inputs: { sp: null, fpi: null, elo: null, qualityWins: 0, oppPollRank: null, oppSpRank: null }, game: null })),
    });
    // No picks -> projection = no change, so model errors = real swaps and skill = 0.
    const r = evaluate([wk(1, ['a', 'b'], ['b', 'a']), wk(5, ['a', 'b', 'c'], ['c', 'a', 'b'])], PARAMS_V1);
    expect(r.weeks.map((w) => [w.week, w.w, w.dBase, w.dModel])).toEqual([[1, 0.5, 1, 1], [5, 1, 2, 2]]);
    expect(r.wBase).toBe(2.5);
    expect(r.wModel).toBe(2.5);
    expect(r.skill).toBe(0);
  });
});
