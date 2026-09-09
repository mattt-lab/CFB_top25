// Unit tests for computeField's straight-seeding logic (CFP rule since the 2025 season) --
// the two things the pre-2025 implementation got structurally wrong: (1) a non-champion ranked
// in the top 4 overall must get the bye ahead of a lower-ranked champion, and (2) the 5th
// highest-ranked champion is guaranteed a field spot no matter how far outside the top 12 its
// raw rank actually is.
import { describe, it, expect } from 'vitest';
import { computeField } from './ranking.mjs';

// 5 conferences (X, Y, Z, W, V), one champ each. V's only ranked member (teamZ) is deliberately
// ranked #18 -- far outside a naive top-12 -- to test guaranteed-inclusion-regardless-of-rank.
// teamB is a non-champion (no conference) ranked #2, to test that a non-champ can still take a
// bye ahead of a lower-ranked champion under straight seeding.
const primary = [
  'teamA',  // 1  -- champ of X
  'teamB',  // 2  -- no conference (e.g. an Independent), non-champ
  'teamC',  // 3  -- champ of Y
  'teamD',  // 4  -- champ of Z
  'teamE',  // 5  -- champ of W
  'teamF',  // 6  -- conf X, non-champ
  'teamG',  // 7  -- conf Y, non-champ
  'teamH',  // 8  -- conf Z, non-champ
  'teamI',  // 9  -- conf W, non-champ
  'teamJ',  // 10 -- no conference, non-champ
  'teamK',  // 11 -- no conference, non-champ
  'teamL',  // 12 -- no conference, non-champ
  'teamM',  // 13 -- no conference, non-champ
  'teamN',  // 14 -- no conference, non-champ
  'teamO',  // 15 -- no conference, non-champ
  'teamP',  // 16 -- no conference, non-champ
  'teamQ',  // 17 -- no conference, non-champ
  'teamZ',  // 18 -- conf V's ONLY ranked member, so it's V's champ despite the low rank
];
const teams = {
  teamA: { conf: 'X' }, teamB: { conf: null }, teamC: { conf: 'Y' }, teamD: { conf: 'Z' },
  teamE: { conf: 'W' }, teamF: { conf: 'X' }, teamG: { conf: 'Y' }, teamH: { conf: 'Z' },
  teamI: { conf: 'W' }, teamJ: { conf: null }, teamK: { conf: null }, teamL: { conf: null },
  teamM: { conf: null }, teamN: { conf: null }, teamO: { conf: null }, teamP: { conf: null },
  teamQ: { conf: null }, teamZ: { conf: 'V' },
};
const rankingsByWeek = { '1': { primary } };
const field = computeField(rankingsByWeek, 1, teams);

describe('computeField (straight seeding)', () => {
  it('gives the bye to a non-champion ranked in the top 4, not a lower-ranked champion', () => {
    expect(field.byes.map((o) => o.id)).toEqual(['teamA', 'teamB', 'teamC', 'teamD']);
    // teamE (rank 5, champ of W) is NOT a bye -- confirms this isn't the pre-2025
    // "top-4-champs-get-byes" behavior, which would have skipped teamB (a non-champion) entirely.
    expect(field.byes.some((o) => o.id === 'teamE')).toBe(false);
  });

  it("guarantees the 5th-highest-ranked champion a field spot even when its raw rank is far outside the top 12", () => {
    const fieldIds = field.byes.concat(field.seeds5to12).map((o) => o.id);
    expect(fieldIds).toContain('teamZ');
    // teamZ's real rank (18th) is otherwise nowhere near field-worthy -- confirms it's there
    // because it's a guaranteed champ, not by rank alone.
    expect(field.bubble.some((o) => o.id === 'teamZ')).toBe(false);
  });

  it('fills the remaining field spots by rank once the 5 guaranteed champs are seated', () => {
    // 5 guaranteed champs (A, C, D, E, Z) + 7 at-large by rank (B, F, G, H, I, J, K) = 12 total,
    // straight-seeded by rank.
    const fieldIds = field.byes.concat(field.seeds5to12).map((o) => o.id);
    expect(fieldIds.sort()).toEqual(
      ['teamA', 'teamB', 'teamC', 'teamD', 'teamE', 'teamF', 'teamG', 'teamH', 'teamI', 'teamJ', 'teamK', 'teamZ'].sort(),
    );
  });

  it('bubble is the next-best teams left out once guaranteed champs displaced them', () => {
    // teamL (rank 12) would have made a naive top-12-by-rank field, but teamZ's guaranteed spot
    // bumped it out -- exactly the seed-vs-rank divergence score.mjs's bubble-notes comment
    // describes.
    expect(field.bubble.map((o) => o.id)).toEqual(['teamL', 'teamM', 'teamN', 'teamO']);
  });
});
