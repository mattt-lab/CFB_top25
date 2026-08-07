// Unit tests for the pure Pick 'em projection model. All fixtures are small synthetic 8-team
// orders (NOT the real imported data/current.json) so every case is hand-checkable: with no
// opponent info a generic win drifts +0.5 and a generic close loss drifts -4.5, which makes the
// expected landing spots easy to reason about below.
import { describe, it, expect } from 'vitest';
import { projectOrder, MIRROR } from './projectTop25.js';

const ORDER = ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8'];

// Minimal team entry: no computer ratings, no games logged. Overrides let a single case add
// exactly the field it exercises (sp, games with quality tags, ...).
function mkTeam(overrides = {}) {
  return { sp: null, fpi: null, elo: null, games: [], ...overrides };
}
function mkTeams(overridesById = {}) {
  const teams = {};
  for (const id of ORDER) teams[id] = mkTeam(overridesById[id]);
  return teams;
}

// Opponent-info resolver from a plain map, mirroring how the page injects it.
function resolverFrom(map) {
  return (teamId) => map[teamId] ?? null;
}

describe('MIRROR', () => {
  it('is a self-consistent involution (mirroring twice returns the original outcome)', () => {
    for (const outcome of Object.keys(MIRROR)) {
      expect(MIRROR[MIRROR[outcome]]).toBe(outcome);
    }
  });
});

describe('projectOrder', () => {
  it('returns the input order unchanged when there are no picks', () => {
    expect(projectOrder(ORDER, {}, mkTeams())).toEqual(ORDER);
  });

  it('does not mutate the input order array', () => {
    const input = ORDER.slice();
    projectOrder(input, { t8: 'blowoutWin' }, mkTeams());
    expect(input).toEqual(ORDER);
  });

  it('holds bye/unpicked teams in their relative order (stable, drift-0)', () => {
    // Only t8 is picked; every other team must keep its relative order exactly.
    const projected = projectOrder(
      ORDER,
      { t8: 'win' },
      mkTeams(),
      { getOpponentInfo: resolverFrom({ t8: { oppPollRank: 1, oppSpRank: null } }) },
    );
    const others = projected.filter((id) => id !== 't8');
    expect(others).toEqual(['t1', 't2', 't3', 't4', 't5', 't6', 't7']);
  });

  it('rises more for an upset win over a top team than for an expected win over a nobody', () => {
    const teams = mkTeams();
    const upset = projectOrder(ORDER, { t5: 'win' }, teams, {
      getOpponentInfo: resolverFrom({ t5: { oppPollRank: 1, oppSpRank: null } }),
    });
    const expected = projectOrder(ORDER, { t5: 'win' }, teams, {
      getOpponentInfo: resolverFrom({ t5: { oppPollRank: null, oppSpRank: null } }),
    });
    expect(upset.indexOf('t5')).toBeLessThan(expected.indexOf('t5'));
    // And the upset win is a genuine climb, not just "less flat".
    expect(upset.indexOf('t5')).toBeLessThan(ORDER.indexOf('t5'));
  });

  it('falls further on a blowout loss than on a close loss to the same opponent', () => {
    const teams = mkTeams();
    const oppInfo = { getOpponentInfo: resolverFrom({ t2: { oppPollRank: null, oppSpRank: null } }) };
    const close = projectOrder(ORDER, { t2: 'loss' }, teams, oppInfo);
    const blowout = projectOrder(ORDER, { t2: 'blowoutLoss' }, teams, oppInfo);
    expect(blowout.indexOf('t2')).toBeGreaterThan(close.indexOf('t2'));
    expect(close.indexOf('t2')).toBeGreaterThan(ORDER.indexOf('t2'));
  });

  it('falls less on a close loss to #1 than on a close loss to an unranked team', () => {
    const teams = mkTeams();
    const toNumberOne = projectOrder(ORDER, { t2: 'loss' }, teams, {
      getOpponentInfo: resolverFrom({ t2: { oppPollRank: 1, oppSpRank: null } }),
    });
    const toUnranked = projectOrder(ORDER, { t2: 'loss' }, teams, {
      getOpponentInfo: resolverFrom({ t2: { oppPollRank: null, oppSpRank: null } }),
    });
    expect(toNumberOne.indexOf('t2')).toBeLessThan(toUnranked.indexOf('t2'));
  });

  it('cushions a loss for a team with quality wins on its resume', () => {
    const qualityGames = [
      { tag: 'quality' }, { tag: 'quality' }, { tag: 'quality' }, { tag: '' },
    ];
    const withResume = projectOrder(ORDER, { t2: 'loss' }, mkTeams({ t2: { games: qualityGames } }));
    const withoutResume = projectOrder(ORDER, { t2: 'loss' }, mkTeams());
    expect(withResume.indexOf('t2')).toBeLessThan(withoutResume.indexOf('t2'));
  });

  it('rises further on the same win when the computers rate the team better than the poll', () => {
    const oppInfo = { getOpponentInfo: resolverFrom({ t5: { oppPollRank: 10, oppSpRank: null } }) };
    // Computers say t5 is really the #1 team (compDelta = 5 - 1 = +4 -> capped-ish nudge)...
    const favored = projectOrder(ORDER, { t5: 'win' }, mkTeams({ t5: { sp: 1, fpi: 1, elo: 1 } }), oppInfo);
    // ...vs computers say t5 is overranked (compDelta negative -> no win nudge at all).
    const doubted = projectOrder(ORDER, { t5: 'win' }, mkTeams({ t5: { sp: 20, fpi: 20, elo: 20 } }), oppInfo);
    expect(favored.indexOf('t5')).toBeLessThan(doubted.indexOf('t5'));
  });

  it('always puts a picked head-to-head winner above the picked loser, whatever drift says', () => {
    // #8 close-beats #1. Drift alone lands t8 around 5th and t1 around 3rd -- the hard
    // constraint must still splice the winner directly above the loser. Pile a max resume
    // cushion AND computer love onto the loser to make the arithmetic as adversarial as possible.
    const teams = mkTeams({
      t1: { sp: 1, fpi: 1, elo: 1, games: [{ tag: 'quality' }, { tag: 'quality' }, { tag: 'quality' }] },
    });
    const picks = { t8: 'win', t1: MIRROR.win };
    const projected = projectOrder(ORDER, picks, teams, {
      getOpponentInfo: resolverFrom({
        t8: { oppPollRank: 1, oppSpRank: null },
        t1: { oppPollRank: 8, oppSpRank: null },
      }),
      h2h: { t8: 't1', t1: 't8' },
    });
    const wi = projected.indexOf('t8');
    const li = projected.indexOf('t1');
    expect(wi).toBeLessThan(li);
    // Spliced to DIRECTLY above the loser, not launched arbitrarily high.
    expect(li - wi).toBe(1);
  });

  it('never turns a loss into a rise, even with a max cushion and computer backing', () => {
    // Best possible loss: close, to the #1 team, with a maxed-out quality-win cushion (capped at
    // 1.2, below the 1.25 minimum loss magnitude) and computers that love the team (loss nudge 0).
    const manyQuality = Array.from({ length: 10 }, () => ({ tag: 'quality' }));
    const projected = projectOrder(
      ORDER,
      { t5: 'loss' },
      mkTeams({ t5: { sp: 1, fpi: 1, elo: 1, games: manyQuality } }),
      { getOpponentInfo: resolverFrom({ t5: { oppPollRank: 1, oppSpRank: null } }) },
    );
    expect(projected.indexOf('t5')).toBeGreaterThanOrEqual(ORDER.indexOf('t5'));
  });

  it('falls back to opponent SP+ rank when the opponent is unranked in the poll', () => {
    const teams = mkTeams();
    // Unranked-but-elite opponent (SP+ #5) should be worth nearly as much as a ranked scalp...
    const eliteSp = projectOrder(ORDER, { t5: 'win' }, teams, {
      getOpponentInfo: resolverFrom({ t5: { oppPollRank: null, oppSpRank: 5 } }),
    });
    // ...while no info at all means a generic unranked opponent.
    const generic = projectOrder(ORDER, { t5: 'win' }, teams, {
      getOpponentInfo: resolverFrom({}),
    });
    expect(eliteSp.indexOf('t5')).toBeLessThan(generic.indexOf('t5'));
  });
});
