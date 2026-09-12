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

// True until the CFP committee releases its first ranking of the season (~week 8-10) -- the real-
// world moment a playoff picture stops being pure early-season guesswork (every "champion"/seed
// before then is just whichever team the AP/Coaches poll happens to rank highest, with no
// committee input at all). Drives Playoff Watch's early-season banner and its muted nav tab
// (Layout.jsx) -- deliberately NOT hidden/disabled, matching this site's existing "honest about
// gaps" pattern elsewhere (see PlayoffWatch.jsx's own pre-committee footnote) rather than blocking
// the page outright.
export const PLAYOFF_PICTURE_IS_EARLY = CURRENT_PRIMARY_SOURCE !== 'cfp';

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

// ---- Data-availability flags -- early in a season (or just after the Aug 1 changeover), several
// columns/panels have nothing real to show yet. Used to render an explanatory note instead of a
// silent wall of dashes/empty visuals (Top25Table's caption, RankingChart, DeltaRows).
export const HAS_TREND_HISTORY = WEEK_IDX_MAX > WEEK_IDX_MIN; // need 2+ weeks for a week-over-week delta
export const HAS_SP_RATINGS = Object.values(byIdMap).some((t) => t.sp != null);
export const HAS_FPI_RATINGS = Object.values(byIdMap).some((t) => t.fpi != null);
export const HAS_ELO_RATINGS = Object.values(byIdMap).some((t) => t.elo != null);

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
// The FULL current-week slate (~90-100 games) games[] above is a top-6-by-stakesScore subset of --
// Conference Tracker pages read this instead, so a conference's own schedule section shows every
// one of its games this week, not just whichever made the sitewide marquee panel.
export const allGames = (raw.allGames ?? []).map((g) => ({
  ...g,
  awayTeam: teamById(g.away),
  homeTeam: teamById(g.home),
}));
export const predictions = raw.predictions;
export const fieldStorylines = raw.fieldStorylines ?? [];

export function rankAt(teamId, wIdx) {
  const order = WEEKLY_ORDER[wIdx] || [];
  const i = order.indexOf(teamId);
  return i === -1 ? null : i + 1;
}
// Returns null (not a number) when either week's rank is unresolved -- a team debuting in the poll
// this week has no real "previous rank" to diff against, and null - N / N - null would otherwise
// silently coerce to 0, rendering a false "improved N" or "dropped N" for exactly the teams a
// visitor is most curious about (poll entrants/exits). Callers must check for null and render
// "NEW"/an equivalent instead of feeding it to arrowGlyph/deltaLabel/trendColor, which would
// themselves misrender null as a flat "-0" rather than refusing to guess.
export function deltaAt(teamId, wIdx) {
  if (wIdx <= WEEK_IDX_MIN) return 0;
  const prev = rankAt(teamId, wIdx - 1);
  const curr = rankAt(teamId, wIdx);
  if (prev == null || curr == null) return null;
  return prev - curr;
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
// Display cap on longshot odds -- the raw formula can spiral into an absurd number like "+99900"
// for the bottom of the poll (correct arithmetic, but it reads as a display bug); real sportsbooks
// cap displayed longshot prices well below that range too.
const MAX_DISPLAYED_ODDS = 9900;
export function americanOdds(pct) {
  const p = pct / 100;
  if (p >= 0.5) return '-' + Math.round((p / (1 - p)) * 100);
  return '+' + Math.min(MAX_DISPLAYED_ODDS, Math.round(((1 - p) / p) * 100));
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
//
// `alwaysThisWeek` skips that date-adding check entirely, for callers whose games are ALWAYS
// within the current tracked week by construction (the marquee panel, Up Next, Full Slate,
// conference schedules, a team's own nextGame) -- confirmed live this was a real bug, not just a
// theoretical one: `daysOut < 0` also fires for a game that simply already kicked off but hasn't
// been marked "final" yet (this pipeline runs once daily, so a Friday-night game can sit
// "scheduled" in the committed data into Saturday morning) -- for a genuinely far-future/past game
// that's the right call (SeasonSchedule.jsx spans a whole season, where "Sat" alone IS ambiguous),
// but for a same-week list, the extra "Sep 11" is just noise -- the weekday alone is already
// unambiguous within one week, whether the game is upcoming or just hasn't caught up to final yet.
export function formatKickoff(iso, alwaysThisWeek = false) {
  if (!iso) return null;
  try {
    const date = new Date(iso);
    // No timeZoneName -- still the visitor's own local time (toLocaleString with no explicit
    // timeZone), just without a per-game "PDT"/"EDT" suffix cluttering every kickoff time. The
    // footer's sitewide "All times shown in your local time zone" note (Layout.jsx) covers this
    // instead, once, rather than repeating it on every single time string.
    const opts = { weekday: 'short', hour: 'numeric', minute: '2-digit' };
    if (!alwaysThisWeek) {
      const daysOut = (date - new Date()) / 86400000;
      if (daysOut < 0 || daysOut > 6) Object.assign(opts, { month: 'short', day: 'numeric' });
    }
    return date.toLocaleString('en-US', opts);
  } catch {
    return iso;
  }
}

// Opponent label (e.g. "vs #8 Michigan" / "at Alabama" for an unranked opponent) and kickoff/
// network text (e.g. "Sat, Sep 5, 3:30 PM PDT · FOX"), split so the caller can style the opponent
// distinctly (bold, so it stands out from the surrounding record/kickoff text). Both null for a
// bye week (no nextGame) or a team with no games left on CFBD's schedule. Shared by "Your Teams"
// and the team-detail hero card. Also passes through nextGame's status/scores/period/clock (only
// ever 'scheduled'/'final' as committed by fetch-cfb-data.mjs -- see its Step 6 comment; no
// client-side live overlay exists for nextGame yet, only for the homepage marquee panel, see
// src/utils/useLiveScores.js) using the same away/home-relative naming as games[] itself --
// callers resolve "my score" vs. "their score" from `homeAway`, same as they already do for the
// opponent label above, rather than this helper guessing which side is "mine".
export function nextGameParts(nextGame) {
  if (!nextGame) {
    return {
      opponent: null, vsAt: null, opponentTeam: null, opponentRank: null, opponentName: null,
      kickoff: null, homeAway: null,
      status: null, awayScore: null, homeScore: null, period: null, clock: null,
    };
  }
  const vsAt = nextGame.homeAway === 'home' ? 'vs' : 'at';
  const oppLabel = nextGame.opponentRank != null ? `#${nextGame.opponentRank} ${nextGame.opponent}` : nextGame.opponent;
  const kickoff = [formatKickoff(nextGame.when, true), nextGame.network].filter(Boolean).join(' · ');
  return {
    // Plain-text label, kept for any caller that just wants a string. Callers that want the
    // opponent's logo inline (so "#8 Michigan" gets its mark between the rank and the name, not
    // stuffed into a single un-splittable string) use vsAt/opponentTeam/opponentRank/opponentName
    // below instead and assemble the JSX themselves.
    opponent: `${vsAt} ${oppLabel}`,
    vsAt,
    // nextGame.opponentId is only present once fetch-cfb-data.mjs has been re-run past the
    // pipeline change that added it -- teamById() on an unresolved/old snapshot's undefined id
    // returns undefined, so this degrades to null (no logo) rather than throwing.
    opponentTeam: nextGame.opponentId ? teamById(nextGame.opponentId) ?? null : null,
    opponentRank: nextGame.opponentRank ?? null,
    opponentName: nextGame.opponent ?? null,
    kickoff: kickoff || null,
    homeAway: nextGame.homeAway,
    status: nextGame.status ?? 'scheduled',
    awayScore: nextGame.awayScore ?? null,
    homeScore: nextGame.homeScore ?? null,
    period: nextGame.period ?? null,
    clock: nextGame.clock ?? null,
  };
}

// Badge chrome for a game's current status -- shared by the "biggest games" cards, the full-slate
// table, "Your Teams", and the team-detail "Next Game" block, so LIVE/FINAL always look and read
// the same everywhere. `detail` is the period/clock text for a live game (e.g. "Q3 · 8:42"); null
// otherwise. `status`/`period`/`clock` are only ever 'scheduled'/'final'/null as COMMITTED to
// data/current.json (see docs/data-schema.md's "Game status lifecycle") -- a caller only ever sees
// 'in_progress' here at all once it's merged in src/utils/useLiveScores.js's client-side overlay,
// which is also what keeps `clock` actually current rather than "as of last deploy".
// "Q3" for regulation, "OT"/"2OT"/"3OT"... beyond it -- ESPN's period keeps counting past 4
// during overtime (5 = OT, 6 = 2OT, ...), so a naive `Q${period}` reads as "Q5" during an OT
// game, which looks broken rather than exciting to any football fan. Exported so any other
// period-displaying spot (e.g. GameSlateTable.jsx's live-status cell) uses the same convention
// instead of reimplementing it.
export function periodLabel(period) {
  if (period == null) return null;
  if (period <= 4) return `Q${period}`;
  const otNum = period - 4;
  return otNum === 1 ? 'OT' : `${otNum}OT`;
}

export function gameStatusBadge(status, period, clock) {
  if (status === 'final') return { text: 'FINAL', live: false, detail: null };
  if (status === 'in_progress') {
    const detail = period != null ? `${periodLabel(period)}${clock ? ` · ${clock}` : ''}` : null;
    return { text: 'LIVE', live: true, detail };
  }
  return { text: null, live: false, detail: null };
}

// Shared by leadingScoreLabel (plain text, below) and any caller that needs the raw pieces instead
// of a joined string (e.g. GameSlateTable.jsx styles the score digits bigger than the surrounding
// text for a live game, which a pre-joined string can't do). Puts the LEADER's score first --
// away/home order would silently attach the wrong-looking number to the callout (e.g. a naive
// "{home} 13-0" for a game whose away team is actually winning 0-13 reads as if the home team
// scored 13, not 0 -- confirmed live, this is exactly the confusing case a visitor flagged).
export function leadingScoreParts(g) {
  if (g.awayScore === g.homeScore) return { tied: true, leaderScore: g.awayScore, trailerScore: g.homeScore };
  const awayLeads = g.awayScore > g.homeScore;
  return {
    tied: false,
    leaderName: awayLeads ? (g.awayTeam?.name ?? g.away) : (g.homeTeam?.name ?? g.home),
    leaderScore: awayLeads ? g.awayScore : g.homeScore,
    trailerScore: awayLeads ? g.homeScore : g.awayScore,
    verb: g.status === 'final' ? 'wins' : 'leads',
  };
}

// "USC leads, 13–0" while live, "USC wins, 24–17" once final. No name/verb on a tie -- neither
// side is leading, and a tie can't be final in football anyway.
export function leadingScoreLabel(g) {
  const p = leadingScoreParts(g);
  if (p.tied) return `${p.leaderScore}–${p.trailerScore}`;
  return `${p.leaderName} ${p.verb}, ${p.leaderScore}–${p.trailerScore}`;
}

// Which side the betting line favors, resolved by checking whether CFBD's pre-formatted spread
// string (e.g. "Ohio State -6.5") starts with either team's resolved name -- there's no structured
// numeric field, just this string (see fetch-cfb-data.mjs's spread comment). Returns null (not a
// guess) when there's no line, or the string matches neither name -- a genuine pick'em line, or a
// name-formatting mismatch between the odds provider and our own team names.
//
// One team's name can be a strict prefix of the other's ("Texas" vs. "Texas A&M"/"Texas State"/
// "Texas Tech" -- all real matchups, Texas-A&M is a rivalry game in data/rivalries.json), so a
// spread favoring the LONGER-named team ("Texas A&M -3.5") also satisfies startsWith() for the
// shorter one purely by coincidence. When both names match, the longer name is the real one --
// the string has to be at least that long for the longer match to succeed at all, so it can't be
// a coincidental prefix collision the way the shorter match can.
function favoredSide(g) {
  if (!g.spread) return null;
  const awayName = g.awayTeam?.name;
  const homeName = g.homeTeam?.name;
  const awayMatch = !!(awayName && g.spread.startsWith(awayName));
  const homeMatch = !!(homeName && g.spread.startsWith(homeName));
  if (awayMatch && homeMatch) return awayName.length >= homeName.length ? 'away' : 'home';
  if (awayMatch) return 'away';
  if (homeMatch) return 'home';
  return null;
}

// "Potential upset" -- the underdog (per the betting line) is doing better than the line implies.
// While live: ahead in the first half (period 1-2), tied or better in Q3 (period 3), or within 7
// points in Q4 or OT (period >= 4). Once final: the underdog won outright. Needs a resolvable
// favorite (see favoredSide) and, for the live checks, a known period -- degrades to false rather
// than guessing when either is missing.
export function isPotentialUpset(g) {
  if (g.awayScore == null || g.homeScore == null) return false;
  const favored = favoredSide(g);
  if (!favored) return false;
  const favScore = favored === 'away' ? g.awayScore : g.homeScore;
  const dogScore = favored === 'away' ? g.homeScore : g.awayScore;

  if (g.status === 'final') return dogScore > favScore;
  if (g.status !== 'in_progress' || g.period == null) return false;
  if (g.period <= 2) return dogScore > favScore;
  if (g.period === 3) return dogScore >= favScore;
  return Math.abs(favScore - dogScore) <= 7; // period >= 4 -- Q4 or OT
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

// Hyphenated conference slug for routing (/conference/big-ten) -- deliberately a SEPARATE function
// from confSlug() above (no hyphens, used only for --conf-* CSS var lookups by ConfDot -- "Big Ten"
// -> "bigten"). Mirrors scripts/score.mjs's confSlugFor exactly (same name, same algorithm, kept in
// sync by hand per the scripts/src runtime split documented in scripts/lib/ranking.mjs) -- this is
// also the id format already baked into fieldStorylines[].id strings in current.json (e.g.
// "conf-race-big-ten").
export function confSlugFor(conf) { return conf.toLowerCase().replace(/[^a-z0-9]+/g, '-'); }

// Conference Tracker pages cover these 4 only -- the only conferences with a real --conf-* brand
// color today (everything else renders a grey ConfDot) and genuine multi-team auto-bid races.
export const POWER4_CONFS = ['Big Ten', 'SEC', 'ACC', 'Big 12'];

export function confByRouteSlug(slug) {
  return POWER4_CONFS.find((c) => confSlugFor(c) === slug) ?? null;
}

// Every member of a conference, ranked or not -- Top25Table/computeField only ever surface
// currently-ranked teams, which isn't what a standings page needs (a bye-week team belongs on the
// page too). Relies on fetch-cfb-data.mjs's Power-4 roster-completeness exception (see its Step 10
// comment) to guarantee every member has a teams{} entry regardless of ranked/bye status.
export function teamsInConf(conf) {
  return Object.values(teams).filter((t) => t.conf === conf);
}

// Every game this week involving at least one member of `conf`, from the FULL weekly slate (not
// just the sitewide marquee 6) -- what a conference page's schedule section renders.
export function gamesInConf(conf) {
  return allGames.filter((g) => g.awayTeam?.conf === conf || g.homeTeam?.conf === conf);
}

// Every game this week involving at least one currently-ranked team -- unlike `games` (the
// stakesScore-trimmed marquee subset), this is the complete Top 25 slate. Unsorted, same
// convention as gamesInConf() -- the caller sorts for its own display order.
export function rankedGamesThisWeek() {
  return allGames.filter((g) => g.awayRank != null || g.homeRank != null);
}

// ---- Straight-seeded 12-team field (CFP's 2025-26 seeding change) ----
// The 5 highest-ranked conference champions are GUARANTEED A FIELD SPOT (auto-bid), but the 4
// byes go to the top-4 teams by overall rank regardless of champion status -- a highly-ranked
// non-champion (an at-large team, or an Independent, which has no championship to win) can
// out-seed a lower-ranked champion for the bye. Confirmed against the CFP's own 2025-26 seeding
// announcement (collegefootballplayoff.com/news/2025/5/22/2526-seeding-rev.aspx). This replaces
// the pre-2025 rule (byes reserved for the top-4 champs specifically), which this function used
// to encode. Mirrors scripts/lib/ranking.mjs's computeField exactly -- keep in sync by hand.
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
  // Field selection: the 5 highest-ranked champs are guaranteed in, then fill to 12 with the
  // best-ranked non-champs (at-large). Seeding: the resulting 12-team field is sorted straight by
  // overall rank -- the top 4 of THAT sort get byes, whatever mix of champ/at-large they are.
  const guaranteedChamps = champs.slice(0, 5);
  const guaranteedIds = {}; guaranteedChamps.forEach((c) => { guaranteedIds[c.id] = true; });
  const pool = teams.filter((o) => !guaranteedIds[o.id]); // already rank-sorted
  const atLargeNeeded = 12 - guaranteedChamps.length;
  const atLarge = pool.slice(0, atLargeNeeded);
  const field = guaranteedChamps.concat(atLarge).sort((a, b) => a.rank - b.rank);
  const byes = field.slice(0, 4);
  const seeds5to12 = field.slice(4, 12);
  const usedIds = {}; field.forEach((o) => { usedIds[o.id] = true; });
  const bubble = teams.filter((o) => !usedIds[o.id]).slice(0, 4);
  return { byes, seeds5to12, bubble, champsByConf, allTeams: teams };
}

// Leader/chaser/gap for a single conference's auto-bid race -- extracted from what PlayoffWatch.jsx
// used to compute inline for every conference's card. Deliberately has NO score threshold, unlike
// fieldStorylines' conf-race-gap storylines (Stage 1 drops any conference whose gap is >=10 --
// confirmed live: this leaves whichever Power-4 conference has the widest gap that week with no
// storyline at all). This always returns the real leader/chaser for any conference with 1+ ranked
// teams, so a conference page can always show a race line even in a week its storyline got cut.
export function confRaceInfo(conf, wIdx) {
  const field = computeField(wIdx);
  const inConf = field.allTeams
    .filter((o) => o.team.conf === conf)
    .sort((a, b) => a.rank - b.rank);
  if (!inConf.length) return null;
  const leader = inConf[0];
  const chaser = inConf.length > 1 ? inConf[1] : null;
  const gap = chaser ? chaser.rank - leader.rank : null;
  return { leader, chaser, gap };
}

// In-conference win-loss record, derived from the same games[] log already used for overall
// record/resume -- filters to games where the opponent shared this team's OWN *current* conference
// (realignment-safe: a past game against a since-departed conference mate stops counting once that
// mate has moved, since it compares against team.conf now, not a hardcoded conference name).
// Requires teams[id].games[].oppConf (fetch-cfb-data.mjs Step 3) -- absent on any game logged
// before that field existed, which just won't match either way.
export function confRecord(team) {
  let wins = 0, losses = 0;
  for (const g of team.games) {
    // team.games now covers the full regular season (completed + upcoming) -- an upcoming game
    // has res: null, which already fails both the 'W' and 'L' checks below and falls through
    // uncounted, but this is now an intentional skip (not incidental) since upcoming games are a
    // real, expected part of every team's games[] array, not an edge case.
    if (g.res == null) continue;
    if (g.oppConf !== team.conf) continue;
    if (g.res === 'W') wins += 1;
    else if (g.res === 'L') losses += 1;
  }
  return { wins, losses, record: `${wins}-${losses}` };
}
