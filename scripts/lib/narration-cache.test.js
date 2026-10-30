import { describe, it, expect } from 'vitest';
import { planNarration, buildCache, promptKey, factsHash, countItems, keyOf } from './narration-cache.mjs';

const game = (id, extra = {}) => ({
  id, away: 'Away U', home: 'Home U', spread: 'Home U -7', status: 'scheduled', awayWinPct: 30.2, homeWinPct: 69.8, ...extra,
});
const baseFacts = () => ({
  games: [game('g1')],
  rankedNextGames: [game('g2', { away: 'Other U', home: 'Third U' })],
  predictions: [{ teamId: 'home-u', name: 'Home U', rank: 5, prevRank: 8 }],
  fieldStorylines: [{ id: 's1', type: 'conf-race-gap', leader: 'Home U', chaser: 'Away U', gap: 2 }],
  bubbleNotes: [{ teamId: 'other-u', name: 'Other U', seed: 14 }],
});
const KEY = promptKey('m', 'sys', { name: 't' });
const cacheFor = (facts, blurbText = 'old') => {
  const { hashes } = planNarration(facts, null, KEY);
  return buildCache(KEY, hashes, new Map([...hashes.keys()].map((k) => [k, `${blurbText}:${k}`])));
};

describe('planNarration', () => {
  it('narrates everything when there is no cache', () => {
    const f = baseFacts();
    const { toNarrate, reused } = planNarration(f, null, KEY);
    expect(countItems(toNarrate)).toBe(5);
    expect(reused.size).toBe(0);
  });

  it('reuses every blurb when nothing changed, so no API call is needed', () => {
    const f = baseFacts();
    const { toNarrate, reused } = planNarration(f, cacheFor(f), KEY);
    expect(countItems(toNarrate)).toBe(0);
    expect(reused.get('games:g1')).toBe('old:games:g1');
    expect(reused.size).toBe(5);
  });

  it('renarrates only the item whose facts changed', () => {
    const f = baseFacts();
    const cache = cacheFor(f);
    f.games[0] = game('g1', { status: 'final', awayScore: 10, homeScore: 24 });
    const { toNarrate, reused } = planNarration(f, cache, KEY);
    expect(toNarrate.games.map((g) => g.id)).toEqual(['g1']);
    // plus the two items about the teams in g1 (see the cross-reference test below); the rest are reused
    expect(countItems(toNarrate)).toBe(3);
    expect(reused.has('games:g1')).toBe(false);
    expect(reused.has('rankedNextGames:g2')).toBe(true);
    expect(reused.has('bubbleNotes:other-u')).toBe(true);
  });

  it('picks up a recap article that arrives after the game went final', () => {
    const f = baseFacts();
    f.games[0] = game('g1', { status: 'final', awayScore: 10, homeScore: 24 });
    const cache = cacheFor(f);
    f.games[0] = { ...f.games[0], articleStory: 'a real AP recap' };
    expect(planNarration(f, cache, KEY).toNarrate.games).toHaveLength(1);
  });

  it('ignores tenths-of-a-point drift in ESPN win probability', () => {
    const f = baseFacts();
    const cache = cacheFor(f);
    f.games[0] = game('g1', { awayWinPct: 30.4, homeWinPct: 69.6 });
    expect(countItems(planNarration(f, cache, KEY).toNarrate)).toBe(0);
    f.games[0] = game('g1', { awayWinPct: 25.4, homeWinPct: 74.6 });
    expect(planNarration(f, cache, KEY).toNarrate.games).toHaveLength(1);
  });

  it("regenerates a team's storyline when that team's game changes, since it may cite the spread", () => {
    const f = baseFacts();
    const cache = cacheFor(f);
    f.games[0] = game('g1', { spread: 'Home U -3' });
    const { toNarrate } = planNarration(f, cache, KEY);
    expect(toNarrate.games).toHaveLength(1);
    expect(toNarrate.predictions.map((p) => p.teamId)).toEqual(['home-u']); // Home U plays g1
    expect(toNarrate.fieldStorylines).toHaveLength(1);                       // Home U / Away U
    expect(toNarrate.bubbleNotes).toHaveLength(0);                           // Other U plays g2, unchanged
  });

  it('regenerates everything when the model, prompt or tool schema changes', () => {
    const f = baseFacts();
    const cache = cacheFor(f);
    for (const other of [promptKey('m2', 'sys', { name: 't' }), promptKey('m', 'sys2', { name: 't' }), promptKey('m', 'sys', { name: 't2' })]) {
      expect(countItems(planNarration(f, cache, other).toNarrate)).toBe(5);
    }
  });

  it('treats a missing, empty or malformed cache as no cache', () => {
    const f = baseFacts();
    for (const bad of [undefined, {}, { promptKey: KEY }, { promptKey: KEY, items: 'x' }, 'garbage']) {
      expect(countItems(planNarration(f, bad, KEY).toNarrate)).toBe(5);
    }
  });

  it('does not reuse an empty cached blurb', () => {
    const f = baseFacts();
    const cache = cacheFor(f);
    cache.items['games:g1'].blurb = '  ';
    expect(planNarration(f, cache, KEY).toNarrate.games).toHaveLength(1);
  });
});

describe('buildCache', () => {
  it('keeps LLM blurbs for current items only, dropping stale entries and empty text', () => {
    const f = baseFacts();
    const { hashes } = planNarration(f, null, KEY);
    const blurbs = new Map([['games:g1', 'kept'], ['games:gone', 'stale item'], ['games:g2', ''], ['rankedNextGames:g2', 'x']]);
    const c = buildCache(KEY, hashes, blurbs);
    expect(Object.keys(c.items).sort()).toEqual(['games:g1', 'rankedNextGames:g2']);
    expect(c.promptKey).toBe(KEY);
    expect(c.items['games:g1'].hash).toBe(hashes.get('games:g1'));
  });
});

describe('helpers', () => {
  it('keys predictions and bubble notes by team and the rest by id', () => {
    expect(keyOf('predictions', { teamId: 't' })).toBe('t');
    expect(keyOf('bubbleNotes', { teamId: 'b' })).toBe('b');
    expect(keyOf('games', { id: 'g' })).toBe('g');
  });
  it('factsHash is stable for equal facts and differs for different ones', () => {
    const f = baseFacts();
    expect(factsHash('games', f.games[0], f)).toBe(factsHash('games', { ...f.games[0] }, f));
    expect(factsHash('games', f.games[0], f)).not.toBe(factsHash('games', game('g1', { ou: 50 }), f));
  });
});
