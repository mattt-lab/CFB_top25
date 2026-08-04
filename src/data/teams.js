// Illustrative mock data — stand-in for data/current.json until the real fetch pipeline exists.
// Shape mirrors what the CollegeFootballData.com API + weekly snapshots will eventually produce.

export const WEEKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
export const WEEK_IDX_MIN = 6; // array index for Week 7 (first committee week)
export const WEEK_IDX_MAX = 11; // array index for Week 12 (latest)

export const DETAILED = [
  {
    id: 'ohio-state', name: 'Ohio State', conf: 'Big Ten', record: '11-1',
    ap: [3, 3, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1],
    coaches: [3, 3, 2, 2, 2, 3, 2, 2, 2, 1, 1, 1],
    cfp: [null, null, null, null, null, null, 2, 2, 2, 1, 1, 1],
    sp: 1, fpi: 2, elo: 1,
    games: [
      { wk: 7, opp: 'Penn State', oppRank: 4, res: 'W', note: 'Quality win', tag: 'quality' },
      { wk: 8, opp: 'Purdue', oppRank: null, res: 'W', note: 'Expected result', tag: '' },
      { wk: 9, opp: 'Michigan', oppRank: 8, res: 'W', note: 'Rivalry, ranked win', tag: 'quality' },
      { wk: 10, opp: 'Indiana', oppRank: 14, res: 'W', note: 'Solid road win', tag: '' },
      { wk: 11, opp: 'Illinois', oppRank: null, res: 'W', note: 'Expected result', tag: '' },
      { wk: 12, opp: 'Rutgers', oppRank: null, res: 'W', note: 'Expected result', tag: '' },
    ],
  },
  {
    id: 'georgia', name: 'Georgia', conf: 'SEC', record: '10-2',
    ap: [2, 2, 3, 3, 4, 4, 4, 3, 3, 3, 2, 2],
    coaches: [2, 2, 3, 4, 4, 4, 4, 3, 3, 3, 3, 2],
    cfp: [null, null, null, null, null, null, 4, 3, 3, 3, 2, 2],
    sp: 2, fpi: 1, elo: 2,
    games: [
      { wk: 7, opp: 'Florida', oppRank: null, res: 'W', note: 'Expected result', tag: '' },
      { wk: 8, opp: 'Texas', oppRank: 5, res: 'L', note: 'Bad loss', tag: 'bad' },
      { wk: 9, opp: 'Ole Miss', oppRank: 11, res: 'W', note: 'Ranked win', tag: 'quality' },
      { wk: 10, opp: 'Tennessee', oppRank: 9, res: 'W', note: 'Quality win', tag: 'quality' },
      { wk: 11, opp: 'UMass', oppRank: null, res: 'W', note: 'Expected result', tag: '' },
      { wk: 12, opp: 'Georgia Tech', oppRank: null, res: 'W', note: 'Rivalry win', tag: '' },
    ],
  },
  {
    id: 'texas', name: 'Texas', conf: 'SEC', record: '10-2',
    ap: [6, 5, 5, 4, 3, 3, 3, 4, 4, 4, 4, 3],
    coaches: [6, 5, 5, 4, 3, 3, 3, 4, 4, 4, 4, 3],
    cfp: [null, null, null, null, null, null, 3, 4, 4, 4, 4, 3],
    sp: 3, fpi: 3, elo: 3,
    games: [
      { wk: 7, opp: 'Oklahoma', oppRank: 12, res: 'W', note: 'Red River win', tag: 'quality' },
      { wk: 8, opp: 'Georgia', oppRank: 2, res: 'W', note: 'Marquee win', tag: 'quality' },
      { wk: 9, opp: 'Vanderbilt', oppRank: 20, res: 'L', note: 'Bad loss', tag: 'bad' },
      { wk: 10, opp: 'Arkansas', oppRank: null, res: 'W', note: 'Expected result', tag: '' },
      { wk: 11, opp: 'Kentucky', oppRank: null, res: 'W', note: 'Expected result', tag: '' },
      { wk: 12, opp: 'Texas A&M', oppRank: 16, res: 'W', note: 'Rivalry, ranked win', tag: 'quality' },
    ],
  },
  {
    id: 'oregon', name: 'Oregon', conf: 'Big Ten', record: '11-1',
    ap: [5, 4, 4, 5, 5, 5, 5, 5, 5, 5, 3, 4],
    coaches: [5, 4, 4, 5, 5, 5, 5, 5, 5, 5, 3, 4],
    cfp: [null, null, null, null, null, null, 5, 5, 5, 5, 3, 4],
    sp: 4, fpi: 4, elo: 4,
    games: [
      { wk: 7, opp: 'USC', oppRank: 19, res: 'W', note: 'Ranked win', tag: 'quality' },
      { wk: 8, opp: 'Michigan State', oppRank: null, res: 'W', note: 'Expected result', tag: '' },
      { wk: 9, opp: 'Iowa', oppRank: null, res: 'W', note: 'Close road win', tag: '' },
      { wk: 10, opp: 'Wisconsin', oppRank: null, res: 'W', note: 'Expected result', tag: '' },
      { wk: 11, opp: 'Washington', oppRank: 22, res: 'W', note: 'Ranked win', tag: 'quality' },
      { wk: 12, opp: 'Minnesota', oppRank: null, res: 'L', note: 'Bad loss', tag: 'bad' },
    ],
  },
  {
    id: 'miami', name: 'Miami', conf: 'ACC', record: '10-1',
    ap: [9, 8, 7, 6, 6, 6, 6, 6, 6, 6, 5, 5],
    coaches: [9, 8, 7, 7, 6, 6, 6, 6, 6, 6, 5, 5],
    cfp: [null, null, null, null, null, null, 6, 6, 6, 6, 5, 5],
    sp: 7, fpi: 8, elo: 7,
    games: [
      { wk: 7, opp: 'Louisville', oppRank: 18, res: 'W', note: 'Ranked win', tag: 'quality' },
      { wk: 8, opp: 'Wake Forest', oppRank: null, res: 'W', note: 'Expected result', tag: '' },
      { wk: 9, opp: 'SMU', oppRank: null, res: 'W', note: 'Expected result', tag: '' },
      { wk: 10, opp: 'Florida State', oppRank: null, res: 'W', note: 'Expected result', tag: '' },
      { wk: 11, opp: 'NC State', oppRank: null, res: 'W', note: 'Expected result', tag: '' },
      { wk: 12, opp: 'Duke', oppRank: null, res: 'W', note: 'Expected result', tag: '' },
    ],
  },
  {
    id: 'alabama', name: 'Alabama', conf: 'SEC', record: '9-3',
    ap: [8, 9, 8, 7, 6, 6, 6, 6, 7, 7, 6, 6],
    coaches: [8, 9, 8, 7, 7, 6, 6, 6, 7, 7, 6, 6],
    cfp: [null, null, null, null, null, null, 6, 6, 7, 7, 6, 6],
    sp: 5, fpi: 5, elo: 6,
    games: [
      { wk: 7, opp: 'Missouri', oppRank: null, res: 'W', note: 'Expected result', tag: '' },
      { wk: 8, opp: 'Tennessee', oppRank: 9, res: 'W', note: 'Quality win', tag: 'quality' },
      { wk: 9, opp: 'LSU', oppRank: 15, res: 'L', note: 'Bad loss', tag: 'bad' },
      { wk: 10, opp: 'Oklahoma', oppRank: 12, res: 'W', note: 'Ranked win', tag: 'quality' },
      { wk: 11, opp: 'Eastern Illinois', oppRank: null, res: 'W', note: 'Expected result', tag: '' },
      { wk: 12, opp: 'Auburn', oppRank: null, res: 'W', note: 'Rivalry win', tag: '' },
    ],
  },
  {
    id: 'penn-state', name: 'Penn State', conf: 'Big Ten', record: '9-3',
    ap: [4, 6, 6, 6, 7, 7, 7, 7, 6, 6, 7, 7],
    coaches: [4, 6, 6, 6, 6, 7, 7, 7, 6, 6, 7, 7],
    cfp: [null, null, null, null, null, null, 7, 7, 6, 6, 7, 7],
    sp: 6, fpi: 6, elo: 5,
    games: [
      { wk: 7, opp: 'Ohio State', oppRank: 1, res: 'L', note: 'Close, ranked loss', tag: '' },
      { wk: 8, opp: 'Northwestern', oppRank: null, res: 'W', note: 'Expected result', tag: '' },
      { wk: 9, opp: 'UCLA', oppRank: null, res: 'W', note: 'Expected result', tag: '' },
      { wk: 10, opp: 'Michigan', oppRank: 8, res: 'W', note: 'Ranked win', tag: 'quality' },
      { wk: 11, opp: 'Nebraska', oppRank: 24, res: 'L', note: 'Bad loss', tag: 'bad' },
      { wk: 12, opp: 'Maryland', oppRank: null, res: 'W', note: 'Expected result', tag: '' },
    ],
  },
];

export const SUMMARY = [
  { name: 'Michigan', conf: 'Big Ten', record: '9-3', cfpRank: 8, delta: 1, sp: 9, fpi: 9 },
  { name: 'Tennessee', conf: 'SEC', record: '9-3', cfpRank: 9, delta: -2, sp: 8, fpi: 7 },
  { name: 'Ole Miss', conf: 'SEC', record: '9-3', cfpRank: 10, delta: 0, sp: 10, fpi: 11 },
  { name: 'Notre Dame', conf: 'Independent', record: '9-3', cfpRank: 11, delta: 2, sp: 11, fpi: 10 },
  { name: 'BYU', conf: 'Big 12', record: '10-2', cfpRank: 12, delta: -1, sp: 14, fpi: 13 },
  { name: 'Iowa State', conf: 'Big 12', record: '9-3', cfpRank: 13, delta: 1, sp: 15, fpi: 14 },
  { name: 'Indiana', conf: 'Big Ten', record: '9-3', cfpRank: 14, delta: -1, sp: 12, fpi: 12 },
  { name: 'Vanderbilt', conf: 'SEC', record: '9-3', cfpRank: 15, delta: 3, sp: 16, fpi: 17 },
  { name: 'Texas A&M', conf: 'SEC', record: '8-4', cfpRank: 16, delta: -2, sp: 13, fpi: 15 },
  { name: 'Missouri', conf: 'SEC', record: '8-4', cfpRank: 17, delta: 0, sp: 17, fpi: 16 },
  { name: 'Louisville', conf: 'ACC', record: '9-3', cfpRank: 18, delta: 1, sp: 18, fpi: 19 },
  { name: 'USC', conf: 'Big Ten', record: '8-4', cfpRank: 19, delta: -1, sp: 19, fpi: 18 },
  { name: 'Nebraska', conf: 'Big Ten', record: '8-4', cfpRank: 20, delta: 2, sp: 21, fpi: 20 },
  { name: 'Washington', conf: 'Big Ten', record: '8-4', cfpRank: 21, delta: -3, sp: 20, fpi: 22 },
  { name: 'South Carolina', conf: 'SEC', record: '8-4', cfpRank: 22, delta: 1, sp: 22, fpi: 21 },
  { name: 'Illinois', conf: 'Big Ten', record: '8-4', cfpRank: 23, delta: 0, sp: 23, fpi: 23 },
  { name: 'Utah', conf: 'Big 12', record: '8-4', cfpRank: 24, delta: -1, sp: 24, fpi: 24 },
  { name: 'Memphis', conf: 'American', record: '11-1', cfpRank: 25, delta: 4, sp: 25, fpi: 25 },
];

function slugify(n) {
  return n.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}
SUMMARY.forEach((s) => { s.id = slugify(s.name); });
DETAILED.forEach((t) => { t.cfpRank = t.cfp[WEEK_IDX_MAX]; });

const byIdMap = {};
DETAILED.forEach((t) => { byIdMap[t.id] = t; });
const summaryByIdMap = {};
SUMMARY.forEach((s) => { summaryByIdMap[s.id] = s; });

export function isDetailed(id) { return !!byIdMap[id]; }
export function getDetailedTeam(id) { return byIdMap[id]; }
export function teamById(id) { return byIdMap[id] || summaryByIdMap[id]; }

export const FULL25 = DETAILED.concat(SUMMARY).sort((a, b) => a.cfpRank - b.cfpRank);

// ---- Deterministic seeded RNG so historical weeks are stable across reloads ----
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- Build a full 1-25 permutation for every week 7-12, anchored so week 12 matches the authored order ----
function buildWeeklyOrder(finalOrderIds) {
  const orders = {};
  orders[WEEK_IDX_MAX] = finalOrderIds.slice();
  for (let w = WEEK_IDX_MAX - 1; w >= WEEK_IDX_MIN; w--) {
    const arr = orders[w + 1].slice();
    const rand = mulberry32(900 + w * 13);
    const swaps = 3 + Math.floor(rand() * 3);
    for (let k = 0; k < swaps; k++) {
      const i = Math.floor(rand() * arr.length);
      const dir = rand() < 0.5 ? -1 : 1;
      const j = Math.max(0, Math.min(arr.length - 1, i + dir * (1 + Math.floor(rand() * 2))));
      const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    orders[w] = arr;
  }
  return orders;
}

export const WEEKLY_ORDER = buildWeeklyOrder(FULL25.map((t) => t.id));

export function rankAt(teamId, wIdx) { return 1 + WEEKLY_ORDER[wIdx].indexOf(teamId); }
export function deltaAt(teamId, wIdx) {
  return wIdx <= WEEK_IDX_MIN ? 0 : rankAt(teamId, wIdx - 1) - rankAt(teamId, wIdx);
}
export function sparkPoints(teamId, wIdx) {
  const pts = [];
  for (let w = WEEK_IDX_MIN; w <= wIdx; w++) pts.push(rankAt(teamId, w));
  return pts;
}

export function tierFor(rank) {
  if (rank <= 4) return { cls: 'lock', label: 'Bye contender' };
  if (rank <= 12) return { cls: 'in', label: 'In the field' };
  if (rank <= 16) return { cls: 'bubble', label: 'On the bubble' };
  return { cls: 'long', label: 'Long shot' };
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
  return { dir: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat', diff: Math.abs(diff) };
}

export function confSlug(conf) { return conf.toLowerCase().replace(/[^a-z0-9]+/g, ''); }

// ---- Auto-bid-aware 12-team field: top-4 conference champs get byes, 5th champ auto-bids, 7 at-large ----
export function computeField(wIdx) {
  const order = WEEKLY_ORDER[wIdx];
  const teams = order.map((id, i) => ({ id, team: teamById(id), rank: i + 1 }));
  const champsByConf = {};
  teams.forEach((o) => {
    const conf = o.team.conf;
    if (conf === 'Independent') return;
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
