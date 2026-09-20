import { describe, it, expect } from 'vitest';
import { projectOrder } from '../../src/utils/projectTop25.js';
import { buildSnapshot, overlayEspnFinals } from './pickem-snapshot.mjs';

const team = (name, sp) => ({ name, sp, fpi: sp, elo: sp, games: [] });
const TEAMS = {
  a: team('A Team', 1), b: team('B Team', 2), c: team('C Team', 3), d: team('D Team', 4), e: team('E Team', 5),
  x: team('X Tech', 60), z: team('Z State', 70), w: team('W U', 80), x2: team('X2 U', 90), z2: team('Z2', 91),
};
const ORDER = ['a', 'b', 'c', 'd', 'e'];
const TEAM_MAP = { d: '4', z: '26', e: '5', w: '23' };

const game = (id, away, home, extra = {}) => ({
  id, away, home, when: '2026-09-19T19:00:00Z', status: 'scheduled', awayScore: null, homeScore: null,
  awayRank: ORDER.includes(away) ? ORDER.indexOf(away) + 1 : null,
  homeRank: ORDER.includes(home) ? ORDER.indexOf(home) + 1 : null,
  spread: null, ou: null, ...extra,
});

const CURRENT = {
  meta: { season: 2026, currentWeek: 3, lastUpdated: '2026-09-20T03:21:00Z' },
  rankingsByWeek: { 3: { primary: ORDER, primarySource: 'ap' } },
  teams: TEAMS,
  allGames: [
    // a: -10 favorite, wins by 20 -> beat the line by 10
    game('g1', 'a', 'x', { status: 'final', awayScore: 30, homeScore: 10, spread: 'A Team -10', ou: 48.5 }),
    // ranked vs ranked: c (home) favored by 3, b (away) wins -> upset
    game('g2', 'b', 'c', { status: 'final', awayScore: 24, homeScore: 21, spread: 'C Team -3', ou: 51 }),
    // d: committed data still says scheduled; ESPN says final
    game('g3', 'd', 'z', { spread: 'D Team -7' }),
    // e: ESPN says still in progress
    game('g4', 'e', 'w', { spread: 'E Team -14' }),
    // unranked vs unranked, lines and result still worth keeping
    game('g5', 'x2', 'z2', { status: 'final', awayScore: 10, homeScore: 13, spread: 'Z2 -1.5' }),
  ],
};

const espnEvent = (id, awayId, awayScore, homeId, homeScore, state) => ({
  id,
  competitions: [{
    status: { type: { state } },
    competitors: [
      { homeAway: 'away', team: { id: awayId }, score: String(awayScore) },
      { homeAway: 'home', team: { id: homeId }, score: String(homeScore) },
    ],
  }],
});
const ESPN = [
  espnEvent('e3', '4', 17, '26', 14, 'post'),
  espnEvent('e4', '5', 7, '23', 0, 'in'),
];

describe('overlayEspnFinals', () => {
  it('returns only games ESPN reports finished that our data still has as not final', () => {
    const o = overlayEspnFinals(CURRENT.allGames, ESPN, TEAM_MAP);
    expect(o).toEqual({ g3: { status: 'final', awayScore: 17, homeScore: 14 } });
  });

  it('never snapshots a game that is still in progress', () => {
    expect(overlayEspnFinals(CURRENT.allGames, [espnEvent('e4', '5', 7, '23', 0, 'in')], TEAM_MAP)).toEqual({});
  });

  it('does not touch a game our data already has final', () => {
    const events = [espnEvent('eX', '4', 99, '26', 0, 'post')];
    const games = [game('g3', 'd', 'z', { status: 'final', awayScore: 3, homeScore: 0 })];
    expect(overlayEspnFinals(games, events, TEAM_MAP)).toEqual({});
  });
});

describe('buildSnapshot', () => {
  const snap = buildSnapshot({
    current: CURRENT, espnEvents: ESPN, teamMap: TEAM_MAP, appVersion: '9.9.9', now: new Date('2026-09-20T05:00:00Z'),
  });
  const byId = Object.fromEntries(snap.teams.map((t) => [t.id, t]));

  it('projects exactly what the page would: real results as picks, everyone else holds', () => {
    const picks = { a: 'blowoutWin', b: 'win', c: 'loss', d: 'win' };
    const expected = projectOrder(ORDER, picks, TEAMS, {
      getOpponentInfo: (id) => ({
        a: { oppPollRank: null, oppSpRank: 60 }, b: { oppPollRank: 3, oppSpRank: 3 },
        c: { oppPollRank: 2, oppSpRank: 2 }, d: { oppPollRank: null, oppSpRank: 70 },
        e: { oppPollRank: null, oppSpRank: 80 },
      }[id]),
      h2h: { b: 'c', c: 'b' },
    });
    expect(snap.projectedOrder).toEqual(expected);
    expect(snap.currentOrder).toEqual(ORDER);
    expect(snap.teams.map((t) => t.id)).toEqual(ORDER);
    for (const t of snap.teams) expect(t.move).toBe(t.currentRank - t.projectedRank);
  });

  it('records how each team did against its pre-game line', () => {
    expect(byId.a.outcome).toBe('blowoutWin');
    expect(byId.a.game).toMatchObject({
      margin: 20, expectedMargin: 10, surprise: 10, coveredSpread: true, wasFavorite: true,
      upsetWin: false, upsetLoss: false, score: { mine: 30, theirs: 10 }, resultSource: 'cfbd',
    });
    expect(byId.b.game).toMatchObject({ margin: 3, expectedMargin: -3, surprise: 6, upsetWin: true, wasFavorite: false });
    expect(byId.c.game).toMatchObject({ margin: -3, expectedMargin: 3, surprise: -6, upsetLoss: true, coveredSpread: false });
    expect(byId.c.game.opponentRank).toBe(2);
  });

  it('uses ESPN for a game our data lags on, and says so', () => {
    expect(byId.d.outcome).toBe('win');
    expect(byId.d.game).toMatchObject({ status: 'final', score: { mine: 17, theirs: 14 }, resultSource: 'espn', margin: 3, expectedMargin: 7, surprise: -4, coveredSpread: false });
  });

  it('flags an incomplete slate instead of pretending it is done', () => {
    expect(snap.complete).toBe(false);
    expect(snap.notFinal).toEqual(['e']);
    expect(byId.e.outcome).toBeNull();
    expect(byId.e.game.score).toBeNull();
    expect(byId.e.game.surprise).toBeNull();
  });

  it('keeps the whole slate with lines and results, unranked games included', () => {
    expect(snap.games).toHaveLength(5);
    const g5 = snap.games.find((g) => g.id === 'g5');
    expect(g5).toMatchObject({
      favorite: 'z2', favoriteMargin: 1.5, homeMargin: 3, expectedHomeMargin: 1.5, homeSurprise: 1.5,
      upset: false, totalPoints: 23,
    });
  });

  it('stamps provenance', () => {
    expect(snap).toMatchObject({
      schemaVersion: 1, season: 2026, week: 3, pollSource: 'ap', generatedAt: '2026-09-20T05:00:00.000Z',
      dataLastUpdated: '2026-09-20T03:21:00Z', model: { appVersion: '9.9.9' },
    });
  });
});
