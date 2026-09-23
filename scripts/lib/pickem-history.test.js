import { describe, it, expect } from 'vitest';
import { PARAMS_V1 } from './pickem-model-params.mjs';
import { replayWeek } from './pickem-backtest.mjs';
import { buildHistoryWeeks } from './pickem-history.mjs';

// Tiny CFBD-shaped season. Teams by CFBD id: 1 Alpha, 2 Bravo, 3 Charlie, 4 Delta (ranked);
// 11 Xray, 12 Yankee (unranked FBS); 91 Zulu State (FCS).
const NAMES = { 1: 'Alpha', 2: 'Bravo', 3: 'Charlie', 4: 'Delta', 11: 'Xray', 12: 'Yankee', 91: 'Zulu State' };
const FCS = new Set([91]);

const poll = (week, ids) => ({
  week, seasonType: 'regular', poll: 'ap', name: 'AP Top 25',
  ranks: ids.map((id, i) => ({ rank: i + 1, teamId: id, school: NAMES[id], points: 100 - i, firstPlaceVotes: 0 })),
});

let gid = 100;
function game(week, awayId, homeId, awayPoints, homePoints, { awayElo = 1500, homeElo = 1500, startDate } = {}) {
  gid += 1;
  return {
    id: gid, week, seasonType: 'regular', startDate: startDate ?? `2025-09-0${week}T19:00:00Z`, completed: true,
    neutralSite: false,
    awayId, awayTeam: NAMES[awayId], awayClassification: FCS.has(awayId) ? 'fcs' : 'fbs', awayPoints,
    awayPregameElo: FCS.has(awayId) ? null : awayElo, awayPostgameElo: FCS.has(awayId) ? null : awayElo + 10,
    homeId, homeTeam: NAMES[homeId], homeClassification: FCS.has(homeId) ? 'fcs' : 'fbs', homePoints,
    homePregameElo: FCS.has(homeId) ? null : homeElo, homePostgameElo: FCS.has(homeId) ? null : homeElo + 10,
  };
}
const line = (g, formattedSpread) => ({
  id: g.id, week: g.week, homeTeamId: g.homeId, homeTeam: g.homeTeam, awayTeamId: g.awayId, awayTeam: g.awayTeam,
  provider: 'consensus', formattedSpread, spread: null, overUnder: 50,
});

function season({ week2Poll = [1, 3, 4, 2] } = {}) {
  gid = 100;
  // Week 1: Alpha routs Xray and beats the line by 10; Bravo loses to Yankee as a 7-point favorite;
  // Charlie beats ranked Delta. Elo: Yankee 1600 (2nd best FBS team that week), Xray 1400.
  const g1 = game(1, 11, 1, 0, 30, { awayElo: 1400, homeElo: 1700 });
  const g2 = game(1, 2, 12, 20, 23, { awayElo: 1650, homeElo: 1600 });
  const g3 = game(1, 3, 4, 24, 21, { awayElo: 1550, homeElo: 1580 });
  // Week 2: Alpha beats FCS Zulu State; Charlie beats Xray; Delta and Yankee idle; Bravo beats Xray?
  // (no -- Bravo idle too).
  const g4 = game(2, 91, 1, 3, 56, { homeElo: 1710 });
  const g5 = game(2, 11, 3, 10, 35, { awayElo: 1390, homeElo: 1560 });
  return {
    season: 2025, fetchedAt: '2026-09-23T12:00:00Z',
    polls: [poll(1, [1, 2, 3, 4]), poll(2, week2Poll), poll(3, [1, 3, 4, 2])],
    games: [g1, g2, g3, g4, g5],
    lines: [line(g1, 'Alpha -20'), line(g2, 'Bravo -7'), line(g3, 'Delta -3'), line(g4, 'Alpha -50'), line(g5, 'Charlie -21')],
  };
}

describe('buildHistoryWeeks', () => {
  const { records } = buildHistoryWeeks(season());
  const [wk1, wk2] = records;
  const team = (rec, id) => rec.teams.find((t) => t.id === String(id));

  it('makes one record per consecutive pair of regular-season AP polls', () => {
    expect(records.map((r) => [r.week, r.actualOrder])).toEqual([
      [1, ['1', '3', '4', '2']],
      [2, ['1', '3', '4', '2']],
    ]);
    expect(wk1.currentOrder).toEqual(['1', '2', '3', '4']);
  });

  it('records each ranked result against its line', () => {
    expect(team(wk1, 1)).toMatchObject({ outcome: 'blowoutWin', game: { margin: 30, expectedMargin: 20, surprise: 10 } });
    expect(team(wk1, 2)).toMatchObject({ outcome: 'loss', game: { margin: -3, expectedMargin: 7, surprise: -10, upsetLoss: true } });
    expect(team(wk1, 3)).toMatchObject({ outcome: 'win', game: { opponent: '4', margin: 3, surprise: 6 } });
  });

  it('stands in the week-of Elo rank for SP+, and leaves FCS opponents unrated', () => {
    // Week 1 FBS pre-game Elo: Alpha 1700, Bravo 1650, Yankee 1600, Delta 1580, Charlie 1550, Xray 1400.
    expect(team(wk1, 2).inputs).toMatchObject({ sp: null, fpi: null, elo: 2, oppPollRank: null, oppSpRank: null, oppEloRank: 3 });
    expect(team(wk1, 3).inputs).toMatchObject({ oppPollRank: 4, oppEloRank: 4 });
    expect(team(wk2, 1).inputs).toMatchObject({ oppPollRank: null, oppEloRank: null });
  });

  it('carries an idle team forward on its latest postgame Elo', () => {
    // Week 2: Alpha 1710 (pregame), Bravo idle -> 1660, Yankee idle -> 1610, Delta idle -> 1590,
    // Charlie 1560, Xray 1390.
    expect(team(wk2, 2).inputs.elo).toBe(2);
    expect(team(wk2, 4).inputs.elo).toBe(4);
  });

  it('counts quality wins through the record week using the poll in force for each game', () => {
    expect(team(wk1, 3).inputs.qualityWins).toBe(1);
    expect(team(wk2, 3).inputs.qualityWins).toBe(1);
    expect(team(wk2, 1).inputs.qualityWins).toBe(0);
  });

  it('replays to its own projection at PARAMS_V1', () => {
    for (const r of records) expect(replayWeek(r, PARAMS_V1)).toEqual(r.projectedOrder);
  });

  it('stops when ranked losers did not fall on average (misaligned weeks)', () => {
    expect(() => buildHistoryWeeks(season({ week2Poll: [2, 1, 3, 4] }))).toThrow(/alignment/i);
  });

  it('uses the later game when a team plays twice in one CFBD week', () => {
    const raw = season();
    const early = game(1, 12, 4, 7, 10, { startDate: '2025-08-23T19:00:00Z' });
    raw.games.push(early);
    const { records: recs, stats } = buildHistoryWeeks(raw);
    expect(stats.doubleGames).toBe(1);
    expect(recs[0].teams.find((t) => t.id === '4').game.opponent).toBe('3');
  });
});
