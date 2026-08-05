// Real data module — loads data/current.json (written by the fetch/score/narrate pipeline) and
// re-derives the same helpers the mockup-era hand-authored data used to export, so component code
// doesn't need to change shape. See docs/data-schema.md for the authoritative schema this file
// targets.
import raw from '../../data/current.json';

export const WEEKS = Array.from({ length: raw.meta.currentWeek }, (_, i) => i + 1);
export const WEEK_IDX_MIN = Math.min(...raw.meta.weeksAvailable) - 1; // array index for the first week with ANY poll
export const WEEK_IDX_MAX = raw.meta.currentWeek - 1; // array index for the latest week
export const SEASON = raw.meta.season;
export const LAST_UPDATED = raw.meta.lastUpdated;

// "CFP" | "Coaches Poll" | "AP Poll" display label for a resolved primary-poll source code.
export function primaryLabel(source) {
  if (source === 'cfp') return 'CFP Committee';
  if (source === 'coaches') return 'Coaches Poll';
  if (source === 'ap') return 'AP Poll';
  return 'Rankings';
}

// ---- Real weekly ranking order, keyed by week array-index — replaces the mockup's seeded-RNG
// WEEKLY_ORDER generator entirely. rankingsByWeek[week].primary IS the ranking order: CFP once
// the committee exists, else Coaches Poll, else AP (see docs/data-schema.md "Season changeover
// and the pre-committee gap" -- the committee doesn't exist for the first ~6-10 weeks of every
// season, so raw `.cfp` alone would be empty for a real stretch of the calendar). Built before
// `teams` below, since team ranks are derived from this, not from a raw per-team `.cfp` array
// (which can be entirely null pre-committee -- confirmed live, that's the real August case).
export const WEEKLY_ORDER = {};
export const PRIMARY_SOURCE_BY_WEEK = {}; // week array-index -> 'cfp' | 'coaches' | 'ap'
WEEKS.forEach((wk, idx) => {
  const rbw = raw.rankingsByWeek[String(wk)];
  WEEKLY_ORDER[idx] = rbw && rbw.primary ? rbw.primary.slice() : [];
  PRIMARY_SOURCE_BY_WEEK[idx] = rbw ? rbw.primarySource : null;
});

export const CURRENT_PRIMARY_SOURCE = raw.meta.currentPrimarySource;

// ---- teams: every team gets a full entry in the real schema (no DETAILED/SUMMARY split) ----
// Keyed by id already (schema: `teams` is an object keyed by slugify(name)) — just attach `id`
// onto each value and reconstruct the old `"W-L"` display string the components expect.
const byIdMap = {};
Object.keys(raw.teams).forEach((id) => {
  const t = raw.teams[id];
  const i = WEEKLY_ORDER[WEEK_IDX_MAX].indexOf(id);
  byIdMap[id] = {
    ...t,
    id,
    record: `${t.wins}-${t.losses}`,
    // Despite the name (kept for minimal churn across components), this is the resolved PRIMARY
    // rank -- CFP/Coaches/AP, whichever was active -- not necessarily a raw CFP poll position.
    cfpRank: i === -1 ? null : i + 1,
  };
});

export const teams = byIdMap;
export function teamById(id) { return byIdMap[id]; }

// Null-safe ascending-rank comparator factory: unranked items (rank === null, e.g. a team pinned
// from a direct team-page visit, or one that fell out of the poll) sort to the end, not the front
// -- plain `a.rank - b.rank` coerces null to 0 and would put them first instead. `rankOf` extracts
// the rank from whatever shape the list holds: `.sort(byRankAsc((x) => x.cfpRank))`,
// `.sort(byRankAsc((x) => x.rank))`, etc.
export function byRankAsc(rankOf) {
  return (a, b) => (rankOf(a) ?? Infinity) - (rankOf(b) ?? Infinity);
}

// ---- this week's slate + storylines, from current.json's own `games`/`predictions` arrays ----
// (replaces the hand-authored src/data/content.js, which is deleted).
export const games = raw.games.map((g) => ({
  ...g,
  awayTeam: teamById(g.away),
  homeTeam: teamById(g.home),
}));
export const predictions = raw.predictions;

export function rankAt(teamId, wIdx) {
  const order = WEEKLY_ORDER[wIdx] || [];
  const i = order.indexOf(teamId);
  return i === -1 ? null : i + 1;
}
export function deltaAt(teamId, wIdx) {
  return wIdx <= WEEK_IDX_MIN ? 0 : rankAt(teamId, wIdx - 1) - rankAt(teamId, wIdx);
}
export function sparkPoints(teamId, wIdx) {
  const pts = [];
  for (let w = WEEK_IDX_MIN; w <= wIdx; w++) pts.push(rankAt(teamId, w));
  return pts;
}

export function lossesFrom(record) { return +record.split('-')[1]; }
export function playoffOddsFor(rank, record, spRank) {
  const losses = lossesFrom(record);
  const base = 100 - (rank - 1) * 100 / 24 - losses * 3;
  const spAdj = spRank != null ? (rank - spRank) * 1.1 : 0;
  return Math.max(1, Math.min(99, Math.round(base + spAdj)));
}
export function nattyOddsFor(rank, record, spRank, fpiRank) {
  // Title odds = playoff odds x a smoothly-decaying "win it all given you're in" factor.
  // Multiplicative (not subtract-then-clamp) so ranks don't all pancake onto the same floor.
  const po = playoffOddsFor(rank, record, spRank);
  const fpiAdj = fpiRank != null ? (rank - fpiRank) * 0.3 : 0;
  const condWin = Math.max(0.4, 22 - rank * 0.75 + fpiAdj);
  const raw = (po / 100) * condWin;
  return Math.max(0.1, Math.min(45, raw));
}
export function americanOdds(pct) {
  const p = pct / 100;
  if (p >= 0.5) return '-' + Math.round((p / (1 - p)) * 100);
  return '+' + Math.round(((1 - p) / p) * 100);
}
export function arrowGlyph(delta) { return delta > 0 ? '▲' : delta < 0 ? '▼' : '–'; }

// ---- Rank-delta helpers -- shared "which way did the rank move, and how should it look" logic.
// Convention throughout this module: positive delta = rank improved (moved toward #1); negative =
// got worse; 0 = unchanged (see deltaAt() above). Used for week-over-week movement, poll-vs-poll
// trend, and poll-vs-computer-rating differentials alike, so the direction/color/label always
// mean the same thing no matter which of those a given delta came from.
export function dirFor(delta) { return delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'; }
export function trendColor(delta) {
  return delta > 0 ? 'var(--good)' : delta < 0 ? 'var(--critical)' : 'var(--muted)';
}
// Ready-to-render "▲3" / "▼2" / "–" -- arrowGlyph's flat glyph already reads fine on its own, so
// only a nonzero delta gets a trailing number.
export function deltaLabel(delta) { return `${arrowGlyph(delta)}${delta !== 0 ? Math.abs(delta) : ''}`; }

// "Model likes them more" / "ranks them lower" / "matches" -- comparing a computer rating's rank
// (SP+, FPI, Elo) against the resolved primary poll rank. Both inputs can be null (a rating not
// published yet, or the team itself unranked) -- degrades to "Not yet available" rather than
// computing a comparison against a missing number.
export function computerRatingNote(computerRank, primaryRank, sourceLabel) {
  if (computerRank == null || primaryRank == null) return 'Not yet available';
  if (computerRank < primaryRank) return 'Model likes them more';
  if (computerRank > primaryRank) return 'Model ranks them lower';
  return `Matches ${sourceLabel}`;
}

// `when` is ISO 8601 in the real schema (e.g. "2026-09-05T23:30:00Z") -- format it for display
// rather than rendering the raw string. Shared by the "biggest games" panel and "Your Teams".
// A bare weekday ("Sat, 4:30 PM PDT") is only unambiguous if the game is actually within the next
// few days -- add the month/day once it's more than a week out (a bye pushing a team's next game
// further than usual, viewing the site mid-week, etc.), so "Sat" can't be read as the wrong Saturday.
export function formatKickoff(iso) {
  if (!iso) return null;
  try {
    const date = new Date(iso);
    const daysOut = (date - new Date()) / 86400000;
    const opts = { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' };
    if (daysOut < 0 || daysOut > 6) Object.assign(opts, { month: 'short', day: 'numeric' });
    return date.toLocaleString('en-US', opts);
  } catch {
    return iso;
  }
}

// Last-two-non-null-values trend for a team's own authored poll array (AP/Coaches/CFP).
export function trendOf(series) {
  let last = null, prev = null;
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i] != null) {
      if (last == null) last = series[i];
      else { prev = series[i]; break; }
    }
  }
  if (last == null || prev == null) return { dir: 'flat', diff: 0 };
  const diff = prev - last;
  return { dir: dirFor(diff), diff: Math.abs(diff) };
}

export function confSlug(conf) { return conf.toLowerCase().replace(/[^a-z0-9]+/g, ''); }

// ---- Auto-bid-aware 12-team field: top-4 conference champs get byes, 5th champ auto-bids, 7 at-large ----
export function computeField(wIdx) {
  const order = WEEKLY_ORDER[wIdx];
  const teams = order.map((id, i) => ({ id, team: teamById(id), rank: i + 1 }));
  const champsByConf = {};
  teams.forEach((o) => {
    const conf = o.team.conf;
    // Independents have no conference championship to win, so no auto-bid -- matched
    // case-insensitively/by substring rather than an exact string, since real CFBD data uses
    // "FBS Independents" (confirmed live for Notre Dame), not the mockup's "Independent". An
    // exact-match check let Notre Dame slip through as a fake "FBS Independents champ" bye seed.
    if (!conf || conf.toLowerCase().includes('independent')) return;
    if (!champsByConf[conf] || o.rank < champsByConf[conf].rank) champsByConf[conf] = o;
  });
  const champs = Object.keys(champsByConf).map((c) => champsByConf[c]).sort((a, b) => a.rank - b.rank);
  const champIds = {}; champs.forEach((c) => { champIds[c.id] = true; });
  const byes = champs.slice(0, 4);
  const fifthChamp = champs.length > 4 ? champs[4] : null;
  const pool = teams.filter((o) => !champIds[o.id]); // already rank-sorted
  const atLarge7 = pool.slice(0, 7);
  const seeds5to12 = (fifthChamp ? [fifthChamp] : []).concat(atLarge7).sort((a, b) => a.rank - b.rank);
  const usedIds = {}; byes.concat(seeds5to12).forEach((o) => { usedIds[o.id] = true; });
  const bubble = teams.filter((o) => !usedIds[o.id]).slice(0, 4);
  return { byes, seeds5to12, bubble, champsByConf, allTeams: teams };
}
