// Unit tests for buildGameStory/buildPregameContext -- fixtures shaped to match real ESPN
// summary?event= responses confirmed live 2026-09-11 (both a completed game with a real AP recap
// article + scoring plays, and a scheduled game with a real "Matchup Predictor" win probability).
import { describe, it, expect } from 'vitest';
import { buildGameStory, hasGameStory, buildPregameContext } from './espn-game-story.mjs';

describe('buildGameStory', () => {
  it('extracts the article, strips HTML from the story body, and truncates to 1500 chars', () => {
    const summary = {
      article: {
        headline: 'No. 7 Miami rolls past Florida A&M 77-7',
        description: 'Miami set a school record for yards...',
        story: `<p>Miami's offense was ${'x'.repeat(1600)} dominant.</p> &amp; special teams too.`,
      },
      drives: { previous: [] },
      scoringPlays: [],
    };
    const story = buildGameStory(summary);
    expect(story.articleHeadline).toBe('No. 7 Miami rolls past Florida A&M 77-7');
    expect(story.articleDescription).toBe('Miami set a school record for yards...');
    expect(story.articleStory.length).toBe(1500);
    expect(story.articleStory).not.toMatch(/<p>|&amp;/);
  });

  it('counts INT/FUM drive results as turnovers, keyed by the team that fumbled/threw the pick', () => {
    const summary = {
      article: null,
      drives: {
        previous: [
          { result: 'PUNT', team: { abbreviation: 'FAMU' } },
          { result: 'Interception', team: { abbreviation: 'FAMU' } },
          { result: 'TD', team: { abbreviation: 'MIA' } },
          { result: 'Fumble', team: { abbreviation: 'FAMU' } },
        ],
      },
      scoringPlays: [],
    };
    const story = buildGameStory(summary);
    expect(story.turnoversByTeam).toEqual({ FAMU: 2 });
  });

  it('maps scoring plays to a compact {team, text, period} shape', () => {
    const summary = {
      article: null,
      drives: { previous: [] },
      scoringPlays: [
        { team: { abbreviation: 'MIA' }, text: 'Mark Fletcher Jr. 46 Yd Run (Jake Weinberg Kick)', period: { number: 1 } },
      ],
    };
    const story = buildGameStory(summary);
    expect(story.scoringPlays).toEqual([
      { team: 'MIA', text: 'Mark Fletcher Jr. 46 Yd Run (Jake Weinberg Kick)', period: 1 },
    ]);
  });

  it('returns nulls/empties rather than throwing when ESPN omits everything', () => {
    const story = buildGameStory({});
    expect(story).toEqual({
      turnoversByTeam: {}, scoringPlays: [],
      articleHeadline: null, articleDescription: null, articleStory: null,
    });
  });
});

describe('hasGameStory', () => {
  it('is true when there is a real article or scoring plays to narrate from', () => {
    expect(hasGameStory({ articleStory: 'text', scoringPlays: [] })).toBe(true);
    expect(hasGameStory({ articleStory: null, scoringPlays: [{ text: 'TD' }] })).toBe(true);
  });

  it('is false when ESPN has not published anything for this game yet', () => {
    expect(hasGameStory({ articleStory: null, articleDescription: null, scoringPlays: [] })).toBe(false);
  });
});

describe('buildPregameContext', () => {
  it('extracts both win percentages when ESPN home/away ids match our own', () => {
    const summary = {
      predictor: {
        homeTeam: { id: '97', gameProjection: '98.3' },
        awayTeam: { id: '222', gameProjection: '1.7' },
      },
    };
    expect(buildPregameContext(summary, '222', '97')).toEqual({ homeWinPct: 98.3, awayWinPct: 1.7 });
  });

  it('returns null rather than guessing when ESPN\'s home/away ids do not match ours (e.g. neutral site)', () => {
    const summary = {
      predictor: {
        homeTeam: { id: '97', gameProjection: '98.3' },
        awayTeam: { id: '222', gameProjection: '1.7' },
      },
    };
    // Swapped away/home ids relative to the fixture above.
    expect(buildPregameContext(summary, '97', '222')).toBeNull();
  });

  it('returns null when there is no predictor block at all', () => {
    expect(buildPregameContext({}, '222', '97')).toBeNull();
  });
});
