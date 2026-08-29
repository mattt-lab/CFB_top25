// Unit tests for matchLiveGames -- the pure join between our marquee games[] and a raw ESPN
// scoreboard response, keyed through a team-id -> ESPN-id map (see espnTeamMap.json). The fetch/
// polling side of useLiveScores is exercised manually in the browser, not here (see its header
// comment) -- this only covers the join logic, which is where a wrong match would actually hurt.
import { describe, it, expect } from 'vitest';
import { matchLiveGames, toPseudoGame } from './useLiveScores.js';

const TEAM_MAP = { 'ohio-state': '194', michigan: '130', clemson: '228', lsu: '99' };

function espnEvent({ awayId, awayScore, homeId, homeScore, state, period, clock }) {
  return {
    competitions: [
      {
        status: { type: { state }, period, displayClock: clock },
        competitors: [
          { homeAway: 'away', team: { id: awayId }, score: String(awayScore) },
          { homeAway: 'home', team: { id: homeId }, score: String(homeScore) },
        ],
      },
    ],
  };
}

describe('matchLiveGames', () => {
  it('patches status/period/clock/scores for a live, matched game', () => {
    const games = [{ id: 'g1', away: 'ohio-state', home: 'michigan' }];
    const espn = { events: [espnEvent({ awayId: '194', awayScore: 17, homeId: '130', homeScore: 14, state: 'in', period: 3, clock: '8:42' })] };
    expect(matchLiveGames(games, espn, TEAM_MAP)).toEqual({
      g1: { status: 'in_progress', period: 3, clock: '8:42', awayScore: 17, homeScore: 14 },
    });
  });

  it('maps a finished ESPN event to our "final" status with null period/clock', () => {
    const games = [{ id: 'g1', away: 'ohio-state', home: 'michigan' }];
    const espn = { events: [espnEvent({ awayId: '194', awayScore: 24, homeId: '130', homeScore: 20, state: 'post', period: 4, clock: '0:00' })] };
    expect(matchLiveGames(games, espn, TEAM_MAP)).toEqual({
      g1: { status: 'final', period: null, clock: null, awayScore: 24, homeScore: 20 },
    });
  });

  it('skips a game where one team has no entry in the team map', () => {
    const games = [{ id: 'g1', away: 'ohio-state', home: 'some-fcs-school' }];
    const espn = { events: [espnEvent({ awayId: '194', awayScore: 10, homeId: '999', homeScore: 0, state: 'in' })] };
    expect(matchLiveGames(games, espn, TEAM_MAP)).toEqual({});
  });

  it('skips a game when no ESPN event contains both mapped teams', () => {
    const games = [{ id: 'g1', away: 'ohio-state', home: 'michigan' }];
    const espn = { events: [espnEvent({ awayId: '194', awayScore: 10, homeId: '228', homeScore: 3, state: 'in' })] }; // ohio-state vs clemson, not michigan
    expect(matchLiveGames(games, espn, TEAM_MAP)).toEqual({});
  });

  it('returns an empty overlay for an empty or missing events list', () => {
    const games = [{ id: 'g1', away: 'ohio-state', home: 'michigan' }];
    expect(matchLiveGames(games, { events: [] }, TEAM_MAP)).toEqual({});
    expect(matchLiveGames(games, {}, TEAM_MAP)).toEqual({});
  });

  it('reports null scores for a scheduled (not-yet-started) matched game', () => {
    const games = [{ id: 'g1', away: 'ohio-state', home: 'michigan' }];
    const espn = { events: [espnEvent({ awayId: '194', awayScore: 0, homeId: '130', homeScore: 0, state: 'pre' })] };
    expect(matchLiveGames(games, espn, TEAM_MAP)).toEqual({
      g1: { status: 'scheduled', period: null, clock: null, awayScore: null, homeScore: null },
    });
  });
});

describe('toPseudoGame', () => {
  it('puts the owning team on the away side when nextGame.homeAway is "away"', () => {
    expect(toPseudoGame('michigan', { opponentId: 'ohio-state', homeAway: 'away' }))
      .toEqual({ id: 'michigan', away: 'michigan', home: 'ohio-state' });
  });

  it('puts the owning team on the home side when nextGame.homeAway is "home"', () => {
    expect(toPseudoGame('michigan', { opponentId: 'ohio-state', homeAway: 'home' }))
      .toEqual({ id: 'michigan', away: 'ohio-state', home: 'michigan' });
  });

  it('returns null for a bye week (no nextGame)', () => {
    expect(toPseudoGame('michigan', null)).toBeNull();
  });

  it('returns null for a pre-opponentId snapshot', () => {
    expect(toPseudoGame('michigan', { homeAway: 'home' })).toBeNull();
  });
});
