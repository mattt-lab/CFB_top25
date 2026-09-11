// Unit tests for selectRankedNextGames -- the "Your Teams" next-game-blurb candidate selection.
import { describe, it, expect } from 'vitest';
import { selectRankedNextGames } from './ranked-next-games.mjs';

function game(id, { awayRank = null, homeRank = null } = {}) {
  return { id, awayRank, homeRank };
}

describe('selectRankedNextGames', () => {
  it('includes a non-marquee game where the away team is ranked', () => {
    const scored = [game('g1', { awayRank: 12 })];
    expect(selectRankedNextGames(scored, [])).toEqual([game('g1', { awayRank: 12 })]);
  });

  it('includes a non-marquee game where the home team is ranked', () => {
    const scored = [game('g1', { homeRank: 24 })];
    expect(selectRankedNextGames(scored, [])).toEqual([game('g1', { homeRank: 24 })]);
  });

  it('excludes a game where neither team is ranked', () => {
    const scored = [game('g1'), game('g2', { awayRank: 5 })];
    expect(selectRankedNextGames(scored, [])).toEqual([game('g2', { awayRank: 5 })]);
  });

  it('excludes a ranked game that is already one of the marquee "biggest games" -- no double narration', () => {
    const scored = [game('g1', { awayRank: 1, homeRank: 4 }), game('g2', { awayRank: 15 })];
    const kept = [game('g1', { awayRank: 1, homeRank: 4 })];
    expect(selectRankedNextGames(scored, kept)).toEqual([game('g2', { awayRank: 15 })]);
  });

  it('returns an empty array when every ranked game is already in the marquee set', () => {
    const scored = [game('g1', { awayRank: 1, homeRank: 4 })];
    expect(selectRankedNextGames(scored, scored)).toEqual([]);
  });
});
