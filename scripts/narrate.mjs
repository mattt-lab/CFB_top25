// Stage 2 of the two-stage games/predictions pipeline: LLM NARRATION, never selection.
// Reads data/current.json (already reduced to the top games/predictions by scripts/score.mjs),
// asks Claude for a short blurb for each survivor, and writes `blurb`/`blurbSource` back in place.
// Stage 2 never adds, drops, or reorders games/predictions -- it only phrases the ones Stage 1
// already picked, which is the whole point of keeping these two stages separate.
//
// Run with: node scripts/narrate.mjs   (after scripts/score.mjs has already run)
//
// Requires ANTHROPIC_API_KEY in the environment (loaded from .env via --env-file, or already
// exported). On any API failure or malformed response, every game/prediction falls back to a
// deterministic one-line blurb rather than blocking the run or shipping empty text.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CURRENT_PATH = join(ROOT, 'data', 'current.json');

const MODEL = 'claude-opus-5';

function teamName(current, teamId) {
  return current.teams[teamId]?.name ?? teamId;
}

// Deterministic one-line fallback -- used when the API call fails outright or returns a
// malformed/missing blurb for a given id, so a bad API day never ships blank text.
function fallbackGameBlurb(g, current) {
  const away = teamName(current, g.away);
  const home = teamName(current, g.home);
  const awayLabel = g.awayRank ? `#${g.awayRank} ${away}` : away;
  const homeLabel = g.homeRank ? `#${g.homeRank} ${home}` : home;
  return g.spread ? `${awayLabel} at ${homeLabel} — ${g.spread}.` : `${awayLabel} at ${homeLabel}.`;
}

function fallbackPredictionBlurb(p, current) {
  const t = current.teams[p.teamId];
  const name = t?.name ?? p.teamId;
  const rank = current.meta.currentWeek
    ? (current.rankingsByWeek[String(current.meta.currentWeek)]?.primary?.indexOf(p.teamId) ?? -1) + 1 || null
    : null;
  return rank ? `#${rank} ${name} is one of this week's notable storylines.` : `${name} is one of this week's notable storylines.`;
}

function fallbackFieldStorylineBlurb(s, current) {
  if (s.type === 'conf-race-gap') {
    const leader = teamName(current, s.leaderId);
    const chaser = teamName(current, s.chaserId);
    return `${s.conf}: #${s.leaderRank} ${leader} leads #${s.chaserRank} ${chaser} by ${s.gap} spot${s.gap === 1 ? '' : 's'} for the auto-bid.`;
  }
  const away = teamName(current, s.awayId);
  const home = teamName(current, s.homeId);
  const stakes = s.type === 'bye-line-matchup' ? 'bye-line' : 'bubble-line';
  return `#${s.awayRank} ${away} at #${s.homeRank} ${home} is a ${stakes} matchup — the loser takes a real hit in the field picture.`;
}

function fallbackBubbleNoteBlurb(note, current) {
  const name = current.teams[note.teamId]?.name ?? note.teamId;
  return `#${note.seed} ${name} sits ${note.spotsFromField} spot${note.spotsFromField === 1 ? '' : 's'} outside the field.`;
}

function buildFacts(current) {
  const games = current.games.map((g) => ({
    id: g.id,
    away: teamName(current, g.away),
    awayRank: g.awayRank,
    home: teamName(current, g.home),
    homeRank: g.homeRank,
    when: g.when,
    spread: g.spread,
    ou: g.ou,
    rivalry: g.rivalry,
  }));

  const predictions = current.predictions.map((p) => {
    const t = current.teams[p.teamId] ?? {};
    const wk = current.meta.currentWeek;
    const order = current.rankingsByWeek[String(wk)]?.primary ?? [];
    const rank = order.indexOf(p.teamId) === -1 ? null : order.indexOf(p.teamId) + 1;
    const prevOrder = wk > 1 ? current.rankingsByWeek[String(wk - 1)]?.primary ?? [] : [];
    const prevRank = prevOrder.indexOf(p.teamId) === -1 ? null : prevOrder.indexOf(p.teamId) + 1;
    return {
      teamId: p.teamId,
      name: t.name ?? p.teamId,
      conf: t.conf ?? null,
      rank,
      prevRank,
      sp: t.sp ?? null,
      fpi: t.fpi ?? null,
    };
  });

  const fieldStorylines = (current.fieldStorylines ?? []).map((s) => {
    if (s.type === 'conf-race-gap') {
      return {
        id: s.id, type: s.type, conf: s.conf,
        leader: teamName(current, s.leaderId), leaderRank: s.leaderRank,
        chaser: teamName(current, s.chaserId), chaserRank: s.chaserRank,
        gap: s.gap,
      };
    }
    return {
      id: s.id, type: s.type,
      away: teamName(current, s.awayId), awayRank: s.awayRank,
      home: teamName(current, s.homeId), homeRank: s.homeRank,
    };
  });

  const bubbleNotes = Object.entries(current.teams)
    .filter(([, t]) => t.bubbleNote)
    .map(([teamId, t]) => ({
      teamId,
      name: t.name,
      seed: t.bubbleNote.seed,
      spotsFromField: t.bubbleNote.spotsFromField,
      movedUp: t.bubbleNote.movedUp,
      nextOpponentRank: t.bubbleNote.nextOpponentRank,
    }));

  return { games, predictions, fieldStorylines, bubbleNotes };
}

const SYSTEM_PROMPT = `You write short, punchy blurbs for a college football Top 25 tracking site.
You are given facts about games, team storylines, playoff-field storylines, and bubble-team notes
that have already been selected by a separate process -- your only job is to phrase them, not to
judge which ones matter. Use ONLY the facts provided. Do not invent stats, injuries, records, or
history not given to you. Each blurb should be 1-2 sentences, written for a knowledgeable college
football fan, no hashtags or emoji.

Field storylines come in two flavors: "conf-race-gap" (how tight a conference's race for the
automatic playoff bid is between the leader and the chaser right behind them) and
"bye-line-matchup"/"bubble-line-matchup" (an upcoming game between two teams in the same
playoff-contention band, where the loser takes a real hit in the field picture). Bubble notes are
a short read on one of the four teams currently on the playoff bubble (seed 13-16) -- their trend
and, if known, who they play next.

Return your answer via the write_blurbs tool.`;

const TOOL = {
  name: 'write_blurbs',
  description: 'Submit the written blurbs for every game and prediction provided.',
  input_schema: {
    type: 'object',
    properties: {
      games: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            blurb: { type: 'string' },
          },
          required: ['id', 'blurb'],
        },
      },
      predictions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            teamId: { type: 'string' },
            blurb: { type: 'string' },
          },
          required: ['teamId', 'blurb'],
        },
      },
      fieldStorylines: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            blurb: { type: 'string' },
          },
          required: ['id', 'blurb'],
        },
      },
      bubbleNotes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            teamId: { type: 'string' },
            blurb: { type: 'string' },
          },
          required: ['teamId', 'blurb'],
        },
      },
    },
    required: ['games', 'predictions', 'fieldStorylines', 'bubbleNotes'],
  },
};

async function fetchBlurbs(facts) {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: [TOOL],
    tool_choice: { type: 'tool', name: 'write_blurbs' },
    messages: [
      {
        role: 'user',
        content: `Write blurbs for these games, predictions, field storylines, and bubble notes:\n\n${JSON.stringify(facts, null, 2)}`,
      },
    ],
  });

  const toolUse = response.content.find((b) => b.type === 'tool_use' && b.name === 'write_blurbs');
  if (!toolUse) throw new Error('No write_blurbs tool call in response');
  return toolUse.input;
}

async function main() {
  const current = JSON.parse(readFileSync(CURRENT_PATH, 'utf8'));
  const facts = buildFacts(current);

  let result = null;
  if (!facts.games.length && !facts.predictions.length && !facts.fieldStorylines.length && !facts.bubbleNotes.length) {
    console.log('Nothing to narrate.');
  } else {
    try {
      result = await fetchBlurbs(facts);
    } catch (err) {
      console.error(`Narration API call failed, falling back to deterministic blurbs: ${err.message}`);
    }
  }

  const gameBlurbs = new Map((result?.games ?? []).map((g) => [g.id, g.blurb]));
  const predictionBlurbs = new Map((result?.predictions ?? []).map((p) => [p.teamId, p.blurb]));
  const storylineBlurbs = new Map((result?.fieldStorylines ?? []).map((s) => [s.id, s.blurb]));
  const bubbleNoteBlurbs = new Map((result?.bubbleNotes ?? []).map((b) => [b.teamId, b.blurb]));

  let llmGames = 0;
  current.games = current.games.map((g) => {
    const blurb = gameBlurbs.get(g.id);
    if (typeof blurb === 'string' && blurb.trim()) {
      llmGames += 1;
      return { ...g, blurb, blurbSource: 'llm' };
    }
    return { ...g, blurb: fallbackGameBlurb(g, current), blurbSource: 'fallback' };
  });

  let llmPredictions = 0;
  current.predictions = current.predictions.map((p) => {
    const blurb = predictionBlurbs.get(p.teamId);
    if (typeof blurb === 'string' && blurb.trim()) {
      llmPredictions += 1;
      return { ...p, blurb, blurbSource: 'llm' };
    }
    return { ...p, blurb: fallbackPredictionBlurb(p, current), blurbSource: 'fallback' };
  });

  let llmStorylines = 0;
  current.fieldStorylines = (current.fieldStorylines ?? []).map((s) => {
    const blurb = storylineBlurbs.get(s.id);
    if (typeof blurb === 'string' && blurb.trim()) {
      llmStorylines += 1;
      return { ...s, blurb, blurbSource: 'llm' };
    }
    return { ...s, blurb: fallbackFieldStorylineBlurb(s, current), blurbSource: 'fallback' };
  });

  let llmBubbleNotes = 0;
  const bubbleTeamIds = Object.keys(current.teams).filter((id) => current.teams[id].bubbleNote);
  for (const teamId of bubbleTeamIds) {
    const note = current.teams[teamId].bubbleNote;
    const blurb = bubbleNoteBlurbs.get(teamId);
    if (typeof blurb === 'string' && blurb.trim()) {
      llmBubbleNotes += 1;
      note.blurb = blurb;
      note.blurbSource = 'llm';
    } else {
      note.blurb = fallbackBubbleNoteBlurb({ teamId, ...note }, current);
      note.blurbSource = 'fallback';
    }
  }

  console.log(`Games: ${llmGames}/${current.games.length} narrated by LLM, ${current.games.length - llmGames} fell back.`);
  console.log(`Predictions: ${llmPredictions}/${current.predictions.length} narrated by LLM, ${current.predictions.length - llmPredictions} fell back.`);
  console.log(`Field storylines: ${llmStorylines}/${current.fieldStorylines.length} narrated by LLM, ${current.fieldStorylines.length - llmStorylines} fell back.`);
  console.log(`Bubble notes: ${llmBubbleNotes}/${bubbleTeamIds.length} narrated by LLM, ${bubbleTeamIds.length - llmBubbleNotes} fell back.`);

  writeFileSync(CURRENT_PATH, JSON.stringify(current, null, 2) + '\n');
  console.log(`Wrote ${CURRENT_PATH}.`);
}

main();
