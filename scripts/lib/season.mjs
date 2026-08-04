// Which CFBD season (year) is "active" for a given date. CFBD's `year` param names a season by
// the calendar year it STARTS in (e.g. the "2026 season" runs Aug 2026 -> Jan 2027).
//
// Explicit changeover rule: the previous season stays the target through the off-season (its
// natty is in January, and there's real value in still showing that season's final result for
// months afterward) right up through July. On August 1, the site flips forward to the new
// season -- even though that new season won't have meaningful ranking data for a couple more
// months (see resolvePrimaryPoll in fetch-cfb-data.mjs for how the site handles that gap).
export function resolveSeasonYear(now = new Date()) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1; // 1-12
  return month >= 8 ? year : year - 1;
}
