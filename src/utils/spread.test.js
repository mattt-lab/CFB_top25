import { describe, it, expect } from 'vitest';
import { parseSpread } from './spread.js';

describe('parseSpread', () => {
  it('finds the favorite and the size of the line', () => {
    expect(parseSpread('Texas A&M -16.5', 'Kentucky', 'Texas A&M')).toEqual({ side: 'home', points: 16.5 });
    expect(parseSpread('Ohio State -6', 'Ohio State', 'Texas')).toEqual({ side: 'away', points: 6 });
  });

  it('resolves a Texas / Texas A&M name-prefix collision to the longer name', () => {
    expect(parseSpread('Texas A&M -3.5', 'Texas', 'Texas A&M')).toEqual({ side: 'home', points: 3.5 });
    expect(parseSpread('Texas -3.5', 'Texas', 'Texas A&M')).toEqual({ side: 'away', points: 3.5 });
  });

  it('is null (not a guess) when there is no line or it matches neither team', () => {
    expect(parseSpread(null, 'A', 'B')).toEqual({ side: null, points: null });
    expect(parseSpread("Pick 'em", 'A', 'B')).toEqual({ side: null, points: null });
    expect(parseSpread('Somebody Else -7', 'A', 'B')).toEqual({ side: null, points: null });
  });

  it('keeps the favorite but has no number when the line has none', () => {
    expect(parseSpread('Team A', 'Team A', 'Team B')).toEqual({ side: 'away', points: null });
  });
});
