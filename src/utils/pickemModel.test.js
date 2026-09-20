import { describe, it, expect } from 'vitest';
import { autoResultFor, buildPickemContext, autoPicksFor } from './pickemModel.js';

const final = (away, awayScore, home, homeScore) => ({
  id: `${away}-${home}`, away, home, status: 'final', awayScore, homeScore,
});

describe('autoResultFor', () => {
  it('categorises a final by margin, with 14+ as a blowout either way', () => {
    const g = final('a', 20, 'b', 30);
    expect(autoResultFor(g, 'b')).toBe('win');           // won by 10
    expect(autoResultFor(g, 'a')).toBe('loss');          // lost by 10
    expect(autoResultFor(final('a', 3, 'b', 45), 'b')).toBe('blowoutWin');
    expect(autoResultFor(final('a', 3, 'b', 45), 'a')).toBe('blowoutLoss');
    expect(autoResultFor(final('a', 0, 'b', 14), 'b')).toBe('blowoutWin'); // exactly 14
    expect(autoResultFor(final('a', 1, 'b', 14), 'b')).toBe('win');        // 13
  });

  it('is null for a bye, an unfinished game, or a final with no scores', () => {
    expect(autoResultFor(undefined, 'a')).toBeNull();
    expect(autoResultFor({ ...final('a', 1, 'b', 2), status: 'in_progress' }, 'a')).toBeNull();
    expect(autoResultFor({ ...final('a', null, 'b', null) }, 'a')).toBeNull();
  });
});

describe('buildPickemContext', () => {
  const order = ['a', 'b', 'c'];
  const slate = [
    { id: 'g1', away: 'a', home: 'b' },   // ranked vs ranked
    { id: 'g2', away: 'x', home: 'c' },   // ranked host, unranked visitor
  ];
  const sp = { a: { sp: 5 }, b: { sp: 9 }, c: { sp: 20 }, x: { sp: 41 } };
  const ctx = buildPickemContext(order, slate, (id) => sp[id]);

  it('maps opponents and ranked-vs-ranked games', () => {
    expect(ctx.oppId).toMatchObject({ a: 'b', b: 'a', c: 'x', x: 'c' });
    expect(ctx.h2h).toEqual({ a: 'b', b: 'a' });
    expect(ctx.gameByTeam.a).toBe(ctx.gameByTeam.b);
  });

  it('resolves opponent quality: poll rank if ranked, SP+ rank otherwise, null with no game', () => {
    expect(ctx.getOpponentInfo('a')).toEqual({ oppPollRank: 2, oppSpRank: 9 });
    expect(ctx.getOpponentInfo('c')).toEqual({ oppPollRank: null, oppSpRank: 41 });
    expect(ctx.getOpponentInfo('nobody')).toBeNull();
  });
});

describe('autoPicksFor', () => {
  it('includes only ranked teams whose game is final', () => {
    const gameByTeam = {
      a: final('a', 10, 'b', 40),
      b: final('a', 10, 'b', 40),
      c: { ...final('c', 1, 'x', 0), status: 'in_progress' },
    };
    expect(autoPicksFor(['a', 'b', 'c', 'd'], gameByTeam)).toEqual({ a: 'blowoutLoss', b: 'blowoutWin' });
  });
});
