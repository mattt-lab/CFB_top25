// Turns a past season's cached CFBD data (scripts/fetch-pickem-history.mjs) into Pick 'em week
// records: one per consecutive pair of regular-season AP polls, in the same format as a live
// snapshot plus `actualOrder` (the next poll). Each week goes through the live buildSnapshot, so
// outcomes, lines, and head-to-head handling are exactly what the page would have computed.
//
// Two stand-ins, because CFBD can't serve SP+/FPI as of a given week: an opponent's quality uses
// its rank by pre-game Elo among FBS teams that week (recorded as inputs.oppEloRank), and a team's
// own computer rank is that Elo rank alone (inputs.elo; sp/fpi stay null).

import { buildSnapshot } from './pickem-snapshot.mjs';
import { QUALITY_WIN_MAX_RANK } from './game-log.mjs';

const LOSSES = { loss: true, blowoutLoss: true };

export function buildHistoryWeeks(raw) {
  const regular = (x) => x.seasonType === 'regular';
  const orderOf = (p) => [...p.ranks].sort((a, b) => a.rank - b.rank).map((r) => String(r.teamId));
  const ap = raw.polls.filter((p) => regular(p) && p.poll === 'ap').sort((a, b) => a.week - b.week);
  const pollOrder = new Map(ap.map((p) => [p.week, orderOf(p)]));
  const otherPoll = (week, kind) => {
    const p = raw.polls.find((x) => regular(x) && x.poll === kind && x.week === week);
    return p ? orderOf(p) : [];
  };
  const rankIn = (week, id) => {
    const i = pollOrder.get(week)?.indexOf(id) ?? -1;
    return i === -1 ? null : i + 1;
  };
  const firstWeek = ap[0]?.week ?? 1;
  // CFBD can label the late-August kickoff games before the first poll week; they belong to the
  // first transition.
  const weekOf = (g) => Math.max(g.week, firstWeek);

  const names = {};
  const fbs = new Set();
  for (const p of ap) for (const r of p.ranks) names[String(r.teamId)] = r.school;
  const games = raw.games.filter(regular)
    .map((g) => ({ ...g, home: String(g.homeId), away: String(g.awayId), wk: 0 }))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  for (const g of games) {
    g.wk = weekOf(g);
    names[g.home] = g.homeTeam;
    names[g.away] = g.awayTeam;
    if (g.homeClassification === 'fbs') fbs.add(g.home);
    if (g.awayClassification === 'fbs') fbs.add(g.away);
  }
  const gamesOf = {};
  for (const g of games) {
    (gamesOf[g.home] ??= []).push(g);
    (gamesOf[g.away] ??= []).push(g);
  }
  const lineById = new Map(raw.lines.map((l) => [l.id, l]));
  const final = (g) => g.completed && g.homePoints != null && g.awayPoints != null;
  const side = (g, id) => (g.home === id ? 'home' : 'away');

  function eloRanks(week) {
    const vals = [];
    for (const id of fbs) {
      const mine = gamesOf[id] ?? [];
      const now = mine.filter((g) => g.wk === week).at(-1);
      let v = now ? now[`${side(now, id)}PregameElo`] : null;
      if (v == null) {
        const before = mine.filter((g) => g.wk < week && g[`${side(g, id)}PostgameElo`] != null).at(-1);
        v = before ? before[`${side(before, id)}PostgameElo`] : null;
      }
      if (v != null) vals.push([id, v]);
    }
    vals.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return new Map(vals.map(([id], i) => [id, i + 1]));
  }

  function qualityWins(id, week) {
    return (gamesOf[id] ?? []).filter((g) => {
      if (g.wk > week || !final(g)) return false;
      const home = g.home === id;
      const won = home ? g.homePoints > g.awayPoints : g.awayPoints > g.homePoints;
      const oppRank = rankIn(g.wk, home ? g.away : g.home);
      return won && oppRank != null && oppRank <= QUALITY_WIN_MAX_RANK;
    }).length;
  }

  const records = [];
  let doubleGames = 0;
  for (const p of ap) {
    const N = p.week;
    const next = pollOrder.get(N + 1);
    if (!next) continue;
    const order = pollOrder.get(N);
    // Sorted by start date, so a team playing twice in one CFBD week maps to its later game.
    const slate = games.filter((g) => g.wk === N);
    for (const id of order) if (slate.filter((g) => g.home === id || g.away === id).length > 1) doubleGames++;
    const elo = eloRanks(N);
    const teams = {};
    for (const id of Object.keys(names)) {
      const e = elo.get(id) ?? null;
      teams[id] = {
        name: names[id], sp: e, fpi: null, elo: e,
        games: Array.from({ length: qualityWins(id, N) }, () => ({ tag: 'quality' })),
      };
    }
    const allGames = slate.map((g) => {
      const l = lineById.get(g.id);
      return {
        id: String(g.id), when: g.startDate, away: g.away, home: g.home,
        status: final(g) ? 'final' : 'scheduled',
        awayScore: final(g) ? g.awayPoints : null, homeScore: final(g) ? g.homePoints : null,
        spread: l?.formattedSpread ?? null, ou: l?.overUnder ?? null,
        awayRank: rankIn(N, g.away), homeRank: rankIn(N, g.home),
      };
    });
    const snapshot = buildSnapshot({
      current: {
        meta: { season: raw.season, currentWeek: N, lastUpdated: raw.fetchedAt },
        rankingsByWeek: { [N]: { primary: order, primarySource: 'ap' } },
        teams,
        allGames,
      },
      pollsFile: { fetchedAt: raw.fetchedAt, polls: { ap: order, coaches: otherPoll(N, 'coaches'), cfp: otherPoll(N, 'cfp') } },
      now: new Date(raw.fetchedAt),
    });
    // buildSnapshot read the Elo rank through the SP+ slots; label it for what it is.
    for (const t of snapshot.teams) {
      t.inputs = { ...t.inputs, sp: null, oppSpRank: null, oppEloRank: t.inputs.oppSpRank };
    }

    const moves = snapshot.teams.filter((t) => LOSSES[t.outcome])
      .map((t) => t.currentRank - (next.includes(t.id) ? next.indexOf(t.id) + 1 : 26));
    if (moves.length && moves.reduce((a, b) => a + b, 0) / moves.length >= 0) {
      throw new Error(`Week alignment check failed for ${raw.season} poll week ${N}: ranked losers did not fall on `
        + `average in poll week ${N + 1} (moves ${moves.join(', ')}). Games and polls may be off by a week.`);
    }
    records.push({ ...snapshot, source: `cfbd-${raw.season}`, actualOrder: next });
  }

  const ranked = records.flatMap((r) => r.teams.filter((t) => t.game));
  return {
    records,
    stats: {
      transitions: records.length,
      rankedTeamWeeks: records.reduce((s, r) => s + r.teams.length, 0),
      rankedGames: ranked.length,
      rankedFinal: ranked.filter((t) => t.outcome).length,
      rankedWithLine: ranked.filter((t) => t.game.surprise != null).length,
      rankedOpponentsWithElo: ranked.filter((t) => t.inputs.oppEloRank != null).length,
      doubleGames,
    },
  };
}
