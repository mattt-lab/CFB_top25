// Unit tests for the pure date-grouping/sorting helpers behind the "Up Next" page. All fixture
// dates use the local Date(y, m, d, h) constructor (never a 'Z'-suffixed UTC literal) so the
// relative day-boundary comparisons stay internally consistent regardless of the runtime's own
// timezone -- see upNextSchedule.js's header comment.
import { describe, it, expect } from 'vitest';
import { pickDayGames, sortDayGames } from './upNextSchedule.js';

const SAT_NOON = new Date(2026, 8, 5, 12, 0); // Sat Sep 5, 2026, 12:00 local

describe('pickDayGames', () => {
  it("returns today's games when any exist, with a null dateLabel", () => {
    const games = [
      { id: 'a', when: new Date(2026, 8, 5, 9, 0).toISOString() },
      { id: 'b', when: new Date(2026, 8, 5, 16, 0).toISOString() },
      { id: 'c', when: new Date(2026, 8, 6, 9, 0).toISOString() }, // tomorrow -- excluded
    ];
    const result = pickDayGames(games, SAT_NOON);
    expect(result.games.map((g) => g.id)).toEqual(['a', 'b']);
    expect(result.dateLabel).toBeNull();
  });

  it('rolls forward to the earliest future date with games when today has none', () => {
    const games = [
      { id: 'past', when: new Date(2026, 8, 4, 9, 0).toISOString() }, // yesterday -- excluded
      { id: 'sun1', when: new Date(2026, 8, 6, 13, 0).toISOString() },
      { id: 'sun2', when: new Date(2026, 8, 6, 16, 0).toISOString() },
      { id: 'mon', when: new Date(2026, 8, 7, 16, 0).toISOString() }, // later date -- excluded
    ];
    const result = pickDayGames(games, SAT_NOON);
    expect(result.games.map((g) => g.id)).toEqual(['sun1', 'sun2']);
    expect(result.dateLabel).toBe('Sunday, Sep 6');
  });

  it('returns an empty result when there are no games today or in the future', () => {
    const games = [{ id: 'past', when: new Date(2026, 8, 4, 9, 0).toISOString() }];
    const result = pickDayGames(games, SAT_NOON);
    expect(result.games).toEqual([]);
    expect(result.dateLabel).toBeNull();
  });

  it('ignores games with no kickoff time at all', () => {
    const games = [{ id: 'tbd', when: null }];
    const result = pickDayGames(games, SAT_NOON);
    expect(result.games).toEqual([]);
  });
});

describe('sortDayGames', () => {
  it('sinks final games to the bottom, keeping everyone else in kickoff order', () => {
    const games = [
      { id: 'final-early', status: 'final', when: new Date(2026, 8, 5, 9, 0).toISOString() },
      { id: 'live', status: 'in_progress', when: new Date(2026, 8, 5, 12, 30).toISOString() },
      { id: 'scheduled', status: 'scheduled', when: new Date(2026, 8, 5, 16, 0).toISOString() },
      { id: 'final-late', status: 'final', when: new Date(2026, 8, 5, 13, 0).toISOString() },
    ];
    const result = sortDayGames(games);
    expect(result.map((g) => g.id)).toEqual(['live', 'scheduled', 'final-early', 'final-late']);
  });

  it('does not mutate the input array', () => {
    const games = [
      { id: 'b', status: 'scheduled', when: new Date(2026, 8, 5, 16, 0).toISOString() },
      { id: 'a', status: 'scheduled', when: new Date(2026, 8, 5, 9, 0).toISOString() },
    ];
    sortDayGames(games);
    expect(games.map((g) => g.id)).toEqual(['b', 'a']);
  });
});
