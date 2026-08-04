// Shared ranking/bracket logic for the scoring scripts. Deliberately a standalone reimplementation
// rather than an import from src/data/teams.js -- that module is written against Vite's JSON-import
// and browser runtime, while these scripts run under plain Node. Keep the two in sync by hand if
// the underlying rules change (tierFor, computeField); they're small and stable.

export function rankAt(rankingsByWeek, week, teamId) {
  const wk = rankingsByWeek[String(week)];
  if (!wk || !wk.primary) return null;
  const i = wk.primary.indexOf(teamId);
  return i === -1 ? null : i + 1;
}

export function tierFor(rank) {
  if (rank == null) return { cls: 'long', label: 'Unranked' };
  if (rank <= 4) return { cls: 'lock', label: 'Bye contender' };
  if (rank <= 12) return { cls: 'in', label: 'In the field' };
  if (rank <= 16) return { cls: 'bubble', label: 'On the bubble' };
  return { cls: 'long', label: 'Long shot' };
}

// Distance to the nearest seed-line cutoff (bye/field/bubble) -- smaller means a single result
// this week more plausibly flips this team across a real line, per docs/data-schema.md's bracket
// rules (4 byes, 12-team field, 16-team bubble window).
export function distanceToCutoff(rank) {
  if (rank == null) return Infinity;
  return Math.min(Math.abs(rank - 4), Math.abs(rank - 12), Math.abs(rank - 16));
}

// Auto-bid-aware 12-team field -- top-4 conference champs get byes, 5th champ auto-bids, 7 at-large.
// Mirrors src/data/teams.js's computeField exactly, including the Independent-conference fix
// (real CFBD data uses "FBS Independents", not the mockup's "Independent" -- matched by
// case-insensitive substring so neither string trips the exclusion incorrectly).
export function computeField(rankingsByWeek, week, teams) {
  const order = rankingsByWeek[String(week)]?.primary || [];
  const ranked = order.map((id, i) => ({ id, team: teams[id], rank: i + 1 })).filter((o) => o.team);
  const champsByConf = {};
  ranked.forEach((o) => {
    const conf = o.team.conf;
    if (!conf || conf.toLowerCase().includes('independent')) return;
    if (!champsByConf[conf] || o.rank < champsByConf[conf].rank) champsByConf[conf] = o;
  });
  const champs = Object.values(champsByConf).sort((a, b) => a.rank - b.rank);
  const champIds = new Set(champs.map((c) => c.id));
  const byes = champs.slice(0, 4);
  const fifthChamp = champs.length > 4 ? champs[4] : null;
  const pool = ranked.filter((o) => !champIds.has(o.id));
  const atLarge7 = pool.slice(0, 7);
  const seeds5to12 = (fifthChamp ? [fifthChamp] : []).concat(atLarge7).sort((a, b) => a.rank - b.rank);
  const usedIds = new Set(byes.concat(seeds5to12).map((o) => o.id));
  const bubble = ranked.filter((o) => !usedIds.has(o.id)).slice(0, 4);
  return { byes, seeds5to12, bubble, champsByConf, allTeams: ranked };
}
