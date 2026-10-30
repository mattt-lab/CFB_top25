// Reuse of already-written blurbs so narrate.mjs only pays for items whose facts changed.
// Pure (no file or network access) so it is unit-testable; narrate.mjs does the IO.
//
// Why: a finished game's recap never changes, yet every pipeline run used to resend its full AP
// article and have the model rewrite the same sentences. Measured on a real weekend, 70-93% of
// items had byte-identical prompt entries from one run to the next.
//
// A cached blurb is reused only when ALL of these match what it was written from:
//   - promptKey: model + system prompt + tool schema (edit the prompt -> everything regenerates)
//   - the item's own facts, exactly as sent (including the ESPN recap/predictor enrichment, so a
//     recap article that lands hours after the final still gets written once)
//   - for storylines/notes, the facts of the games involving the same team(s): the model sees every
//     section at once and may cite a team's spread or opponent in them
// ESPN win percentages are rounded to whole numbers for hashing: they drift by tenths between
// runs and would otherwise invalidate every upcoming game's blurb daily for no visible reason.
// Fallback (non-LLM) blurbs are never cached, so a failed API call is retried next run.

import { createHash } from 'node:crypto';

export const SECTIONS = ['games', 'rankedNextGames', 'predictions', 'fieldStorylines', 'bubbleNotes'];
const GAME_SECTIONS = new Set(['games', 'rankedNextGames']);

const sha = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);

export const keyOf = (section, item) => (section === 'predictions' || section === 'bubbleNotes' ? item.teamId : item.id);

export function promptKey(model, systemPrompt, tool) {
  return sha(`${model}\n${systemPrompt}\n${JSON.stringify(tool)}`);
}

function normalized(item) {
  const out = { ...item };
  for (const k of ['awayWinPct', 'homeWinPct']) if (typeof out[k] === 'number') out[k] = Math.round(out[k]);
  return out;
}

const teamNames = (item) => [item.name, item.leader, item.chaser, item.away, item.home].filter(Boolean);

// Hash of everything a blurb for `item` could legitimately depend on.
export function factsHash(section, item, facts) {
  const own = JSON.stringify(normalized(item));
  if (GAME_SECTIONS.has(section)) return sha(own);
  const names = teamNames(item);
  const related = [...facts.games, ...facts.rankedNextGames]
    .filter((g) => names.includes(g.away) || names.includes(g.home))
    .map((g) => JSON.stringify(normalized(g)))
    .sort();
  return sha(`${own}\n${related.join('\n')}`);
}

// cache: { promptKey, items: { "section:key": { hash, blurb } } } (anything else is treated as empty)
// Returns { toNarrate, reused, hashes }: toNarrate has the same shape as `facts` but only the items
// that need the model; reused maps "section:key" -> blurb for the rest.
export function planNarration(facts, cache, key) {
  const usable = cache && cache.promptKey === key && cache.items && typeof cache.items === 'object';
  const toNarrate = {};
  const reused = new Map();
  const hashes = new Map();
  for (const section of SECTIONS) {
    toNarrate[section] = [];
    for (const item of facts[section] ?? []) {
      const k = `${section}:${keyOf(section, item)}`;
      const hash = factsHash(section, item, facts);
      hashes.set(k, hash);
      const hit = usable ? cache.items[k] : null;
      if (hit && hit.hash === hash && typeof hit.blurb === 'string' && hit.blurb.trim()) reused.set(k, hit.blurb);
      else toNarrate[section].push(item);
    }
  }
  return { toNarrate, reused, hashes };
}

export const countItems = (facts) => SECTIONS.reduce((n, s) => n + (facts[s]?.length ?? 0), 0);

// The cache to write back: one entry per item that has an LLM blurb right now (reused or newly
// written); entries for items no longer in the facts are dropped so the file can't grow forever.
export function buildCache(key, hashes, blurbs) {
  const items = {};
  for (const [k, blurb] of blurbs) {
    if (hashes.has(k) && typeof blurb === 'string' && blurb.trim()) items[k] = { hash: hashes.get(k), blurb };
  }
  return { promptKey: key, items };
}
