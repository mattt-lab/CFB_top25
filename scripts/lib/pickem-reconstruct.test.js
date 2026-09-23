import { describe, it, expect } from 'vitest';
import { selectReconstructSource } from './pickem-reconstruct.mjs';

const team = (name) => ({ name, sp: null, fpi: null, elo: null, games: [] });
const current = (currentWeek, { final = true } = {}) => ({
  meta: { season: 2026, currentWeek, lastUpdated: '2026-09-13T00:00:00Z' },
  rankingsByWeek: { [currentWeek]: { primary: ['a', 'b'], primarySource: 'ap' } },
  teams: { a: team('A'), b: team('B'), x: team('X'), y: team('Y') },
  allGames: [
    { id: 'g1', away: 'a', home: 'x', status: 'final', awayScore: 30, homeScore: 10, spread: 'A -7' },
    final
      ? { id: 'g2', away: 'y', home: 'b', status: 'final', awayScore: 3, homeScore: 24, spread: 'B -10' }
      : { id: 'g2', away: 'y', home: 'b', status: 'scheduled', awayScore: null, homeScore: null, spread: 'B -10' },
  ],
});

describe('selectReconstructSource', () => {
  it('takes the newest commit that is still on the wanted week with every ranked game final', () => {
    const candidates = [
      { sha: 'c4', current: current(3, { final: false }) },
      { sha: 'c3', current: current(2) },
      { sha: 'c2', current: current(2) },
      { sha: 'c1', current: current(2, { final: false }) },
    ];
    expect(selectReconstructSource(candidates, 2)?.sha).toBe('c3');
  });

  it('skips a newer commit on the right week whose ranked games are not all final', () => {
    const candidates = [
      { sha: 'c3', current: current(2, { final: false }) },
      { sha: 'c2', current: current(2) },
    ];
    expect(selectReconstructSource(candidates, 2)?.sha).toBe('c2');
  });

  it('returns null when no commit qualifies', () => {
    expect(selectReconstructSource([{ sha: 'c1', current: current(2, { final: false }) }], 2)).toBeNull();
    expect(selectReconstructSource([{ sha: 'c1', current: current(4) }], 2)).toBeNull();
  });
});
