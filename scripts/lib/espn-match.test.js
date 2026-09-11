// Unit tests for the server-side ESPN event matcher -- same join logic as
// src/utils/useLiveScores.test.js's matchLiveGames tests, adapted for the simpler
// (id-only, no live status) server-side lookup.
import { describe, it, expect } from 'vitest';
import { buildEventsByEspnTeamId, findEspnEventId } from './espn-match.mjs';

const TEAM_MAP = { 'ohio-state': '194', michigan: '130', clemson: '228' };

function espnEvent({ id, awayId, homeId, date }) {
  return {
    id,
    date,
    competitions: [{
      competitors: [
        { homeAway: 'away', team: { id: awayId } },
        { homeAway: 'home', team: { id: homeId } },
      ],
    }],
  };
}

describe('findEspnEventId', () => {
  it('finds the event id for a game where both teams share exactly one event', () => {
    const scoreboard = { events: [espnEvent({ id: 'e1', awayId: '194', homeId: '130' })] };
    const map = buildEventsByEspnTeamId(scoreboard);
    const game = { away: 'ohio-state', home: 'michigan', when: null };
    expect(findEspnEventId(game, map, TEAM_MAP)).toBe('e1');
  });

  it('returns null when either team has no espnTeamMap entry', () => {
    const scoreboard = { events: [espnEvent({ id: 'e1', awayId: '194', homeId: '999' })] };
    const map = buildEventsByEspnTeamId(scoreboard);
    const game = { away: 'ohio-state', home: 'some-fcs-school', when: null };
    expect(findEspnEventId(game, map, TEAM_MAP)).toBeNull();
  });

  it('returns null when no shared event exists for the pair', () => {
    const scoreboard = { events: [espnEvent({ id: 'e1', awayId: '194', homeId: '228' })] };
    const map = buildEventsByEspnTeamId(scoreboard);
    const game = { away: 'ohio-state', home: 'michigan', when: null };
    expect(findEspnEventId(game, map, TEAM_MAP)).toBeNull();
  });

  it('picks the event closest to our own tracked kickoff time for a rematch (two shared events)', () => {
    const scoreboard = {
      events: [
        espnEvent({ id: 'earlier', awayId: '194', homeId: '130', date: '2026-11-01T17:00:00Z' }),
        espnEvent({ id: 'later', awayId: '194', homeId: '130', date: '2026-12-06T20:00:00Z' }),
      ],
    };
    const map = buildEventsByEspnTeamId(scoreboard);
    const game = { away: 'ohio-state', home: 'michigan', when: '2026-12-06T19:30:00Z' };
    expect(findEspnEventId(game, map, TEAM_MAP)).toBe('later');
  });

  it('falls back to the first candidate when the game has no `when` to disambiguate multiple matches', () => {
    const scoreboard = {
      events: [
        espnEvent({ id: 'first', awayId: '194', homeId: '130', date: '2026-11-01T17:00:00Z' }),
        espnEvent({ id: 'second', awayId: '194', homeId: '130', date: '2026-12-06T20:00:00Z' }),
      ],
    };
    const map = buildEventsByEspnTeamId(scoreboard);
    const game = { away: 'ohio-state', home: 'michigan', when: null };
    expect(findEspnEventId(game, map, TEAM_MAP)).toBe('first');
  });
});
