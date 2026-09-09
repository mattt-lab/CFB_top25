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

// Straight-seeded 12-team field, per the CFP's 2025-26 seeding change (confirmed against the
// CFP's own 2025-26 seeding announcement -- collegefootballplayoff.com/news/2025/5/22/2526-seeding-rev.aspx):
// the 5 highest-ranked conference champions are GUARANTEED A FIELD SPOT (auto-bid), but the 4
// byes go to the top-4 teams by overall rank regardless of champion status -- a highly-ranked
// non-champion (an at-large team, or an Independent, which has no championship to win) can
// out-seed a lower-ranked champion for the bye. This replaces the pre-2025 rule (byes reserved
// for the top-4 champs specifically), which is what this function used to encode.
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
  // Field selection: the 5 highest-ranked champs are guaranteed in, then fill to 12 with the
  // best-ranked non-champs (at-large). Seeding: the resulting 12-team field is sorted straight by
  // overall rank -- the top 4 of THAT sort get byes, whatever mix of champ/at-large they are.
  const guaranteedChamps = champs.slice(0, 5);
  const guaranteedIds = new Set(guaranteedChamps.map((c) => c.id));
  const pool = ranked.filter((o) => !guaranteedIds.has(o.id)); // already rank-sorted
  const atLargeNeeded = 12 - guaranteedChamps.length;
  const atLarge = pool.slice(0, atLargeNeeded);
  const field = guaranteedChamps.concat(atLarge).sort((a, b) => a.rank - b.rank);
  const byes = field.slice(0, 4);
  const seeds5to12 = field.slice(4, 12);
  const usedIds = new Set(field.map((o) => o.id));
  const bubble = ranked.filter((o) => !usedIds.has(o.id)).slice(0, 4);
  return { byes, seeds5to12, bubble, champsByConf, allTeams: ranked };
}
