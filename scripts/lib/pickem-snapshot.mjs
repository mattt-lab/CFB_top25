// Builds a frozen record of what the Top 25 Pick 'em page projected for a week, plus every game's
// pre-game betting line next to its final score -- so a later review can ask both "how close was
// the projected poll to the real one?" and "did the poll move the way the outcome-vs-line said it
// should?". Pure (data in, snapshot object out) so it is unit-testable; scripts/snapshot-pickem.mjs
// is the thin IO wrapper.
//
// The projection is computed with the SAME modules the page uses (src/utils/pickemModel.js +
// projectTop25.js): every ranked team whose game is final gets its real result as its "pick", the
// rest hold position -- exactly the page's default state once a slate is decided.
//
// Why lines are captured here and not left to the review: data/current.json is overwritten by the
// pipeline every run and rolls to next week's slate, so the pre-game spread/over-under and this
// week's final scores would be gone by the time anyone reviews them.

import { projectOrder } from '../../src/utils/projectTop25.js';
import { buildPickemContext, autoPicksFor, autoResultFor } from '../../src/utils/pickemModel.js';
import { parseSpread } from '../../src/utils/spread.js';
import { buildEventsByEspnTeamId, findEspnEventId } from './espn-match.mjs';

export const SNAPSHOT_SCHEMA_VERSION = 1;

// { [gameId]: { status: 'final', awayScore, homeScore } } for every game NOT already final in our
// committed data that ESPN reports as finished. The committed data lags a finished game by hours
// (the pipeline runs a few times a day), so without this a snapshot taken right after the last
// whistle would treat those teams as "hold position". Only 'post' games count -- a game still in
// progress is left alone (and shows up in `notFinal`) rather than snapshotted mid-game.
export function overlayEspnFinals(games, espnEvents, teamMap) {
  const byTeam = buildEventsByEspnTeamId({ events: espnEvents });
  const eventsById = new Map(espnEvents.map((e) => [String(e.id), e]));
  const out = {};
  for (const g of games) {
    if (g.status === 'final') continue;
    const eventId = findEspnEventId(g, byTeam, teamMap);
    if (!eventId) continue;
    const comp = eventsById.get(String(eventId))?.competitions?.[0];
    if (comp?.status?.type?.state !== 'post') continue;
    const away = comp.competitors?.find((c) => c.homeAway === 'away');
    const home = comp.competitors?.find((c) => c.homeAway === 'home');
    const awayScore = Number(away?.score);
    const homeScore = Number(home?.score);
    if (!Number.isFinite(awayScore) || !Number.isFinite(homeScore)) continue;
    out[g.id] = { status: 'final', awayScore, homeScore };
  }
  return out;
}

// Line + result for one game, from the home team's perspective (expectedHomeMargin > 0 means the
// home team was favored by that many). Null fields mean "unknown", never a guess: no line, a line
// matching neither team name, or a game that isn't final.
function lineFor(g, nameOf) {
  const { side, points } = parseSpread(g.spread, nameOf(g.away), nameOf(g.home));
  const favorite = side === 'away' ? g.away : side === 'home' ? g.home : null;
  const expectedHomeMargin = side == null || points == null ? null : side === 'home' ? points : -points;
  const isFinal = g.status === 'final' && g.awayScore != null && g.homeScore != null;
  const homeMargin = isFinal ? g.homeScore - g.awayScore : null;
  const homeSurprise = homeMargin != null && expectedHomeMargin != null ? homeMargin - expectedHomeMargin : null;
  return {
    favorite,
    favoriteMargin: side == null ? null : points,
    expectedHomeMargin,
    homeMargin,
    homeSurprise, // actual margin minus the line's expected margin; > 0 = home beat the line
    upset: isFinal && favorite != null ? (favorite === g.home ? homeMargin < 0 : homeMargin > 0) : null,
  };
}

export function buildSnapshot({
  current, pollsFile = null, espnEvents = [], teamMap = {}, appVersion = null, now = new Date(),
}) {
  const week = current.meta.currentWeek;
  const rbw = current.rankingsByWeek[String(week)];
  const currentOrder = rbw.primary.slice();
  const teamById = (id) => current.teams[id];
  const nameOf = (id) => current.teams[id]?.name ?? id;

  const overlay = overlayEspnFinals(current.allGames, espnEvents, teamMap);
  const slate = current.allGames.map((g) => (overlay[g.id] ? { ...g, ...overlay[g.id] } : g));
  const resultSource = (g) => {
    if (overlay[g.id]) return 'espn';
    return g.status === 'final' ? 'cfbd' : null;
  };

  const ctx = buildPickemContext(currentOrder, slate, teamById);
  const picks = autoPicksFor(currentOrder, ctx.gameByTeam);
  const projectedOrder = projectOrder(currentOrder, picks, current.teams, {
    getOpponentInfo: ctx.getOpponentInfo, h2h: ctx.h2h,
  });

  const teams = currentOrder.map((id) => {
    const g = ctx.gameByTeam[id] ?? null;
    const currentRank = currentOrder.indexOf(id) + 1;
    const projectedRank = projectedOrder.indexOf(id) + 1;
    const t = current.teams[id];
    const base = {
      id, name: nameOf(id), currentRank, projectedRank, move: currentRank - projectedRank,
      outcome: picks[id] ?? null,
      inputs: {
        sp: t?.sp ?? null, fpi: t?.fpi ?? null, elo: t?.elo ?? null,
        qualityWins: (t?.games ?? []).filter((x) => x.tag === 'quality').length,
        ...(ctx.getOpponentInfo(id) ?? { oppPollRank: null, oppSpRank: null }),
      },
      game: null,
    };
    if (!g) return { ...base, bye: true };
    const isHome = g.home === id;
    const line = lineFor(g, nameOf);
    const mine = g.awayScore == null ? null : (isHome ? g.homeScore : g.awayScore);
    const theirs = g.awayScore == null ? null : (isHome ? g.awayScore : g.homeScore);
    const isFinal = autoResultFor(g, id) != null;
    // Signed from THIS team's side: +N = favored by N / won by N.
    const expectedMargin = line.expectedHomeMargin == null ? null : (isHome ? line.expectedHomeMargin : -line.expectedHomeMargin);
    const margin = isFinal ? mine - theirs : null;
    const surprise = margin != null && expectedMargin != null ? margin - expectedMargin : null;
    return {
      ...base,
      game: {
        id: g.id,
        opponent: isHome ? g.away : g.home,
        opponentRank: (isHome ? g.awayRank : g.homeRank) ?? null,
        homeAway: isHome ? 'home' : 'away',
        status: isFinal ? 'final' : g.status,
        score: isFinal ? { mine, theirs } : null,
        margin,
        spread: g.spread ?? null,
        overUnder: g.ou ?? null,
        expectedMargin,           // > 0: this team was favored by that many
        surprise,                 // margin - expectedMargin; > 0: beat the line
        coveredSpread: surprise == null || surprise === 0 ? null : surprise > 0,
        wasFavorite: expectedMargin == null ? null : expectedMargin > 0,
        upsetWin: isFinal && expectedMargin != null ? margin > 0 && expectedMargin < 0 : null,
        upsetLoss: isFinal && expectedMargin != null ? margin < 0 && expectedMargin > 0 : null,
        resultSource: resultSource(g),
      },
    };
  });

  // The whole slate, not just the ranked teams: an unranked team's big win is exactly how a new
  // team crashes the poll, and a review needs its line and result too.
  const games = slate.map((g) => {
    const line = lineFor(g, nameOf);
    const isFinal = g.status === 'final' && g.awayScore != null && g.homeScore != null;
    return {
      id: g.id, when: g.when ?? null,
      away: g.away, awayRank: g.awayRank ?? null, home: g.home, homeRank: g.homeRank ?? null,
      status: g.status, awayScore: g.awayScore ?? null, homeScore: g.homeScore ?? null,
      spread: g.spread ?? null, overUnder: g.ou ?? null,
      totalPoints: isFinal ? g.awayScore + g.homeScore : null,
      ...line,
      resultSource: resultSource(g),
    };
  });

  const notFinal = teams.filter((t) => !t.bye && t.game.status !== 'final').map((t) => t.id);

  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    generatedAt: now.toISOString(),
    season: current.meta.season,
    week,
    pollSource: rbw.primarySource,
    pollFetchedAt: pollsFile?.fetchedAt ?? null,
    dataLastUpdated: current.meta.lastUpdated,
    model: { name: 'projectOrder with real results as picks', appVersion },
    complete: notFinal.length === 0,
    notFinal,
    currentOrder,
    projectedOrder,
    polls: pollsFile?.polls ?? null,
    teams,
    games,
  };
}
