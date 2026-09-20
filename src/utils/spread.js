// Pure parser for CFBD's pre-formatted betting-line string (e.g. "Ohio State -6.5"). There is no
// structured numeric field for the line, just this string (see fetch-cfb-data.mjs's spread
// comment), so the favorite is resolved by checking whether it starts with either team's name.
// Lives in its own module (no imports, no data/current.json) so both the site (teams.js's
// isPotentialUpset) and the Node scripts (Pick 'em snapshot/review) read the line identically.
//
// Returns { side: 'away' | 'home' | null, points: number | null }. side is null (not a guess) when
// there's no line, or the string matches neither name -- a genuine pick'em line, or a
// name-formatting mismatch between the odds provider and our own team names. points is the
// favorite's margin as a positive number, null whenever side is null.
//
// One team's name can be a strict prefix of the other's ("Texas" vs. "Texas A&M"/"Texas State"/
// "Texas Tech" -- all real matchups, Texas-A&M is a rivalry game in data/rivalries.json), so a
// spread favoring the LONGER-named team ("Texas A&M -3.5") also satisfies startsWith() for the
// shorter one purely by coincidence. When both names match, the longer name is the real one --
// the string has to be at least that long for the longer match to succeed at all, so it can't be
// a coincidental prefix collision the way the shorter match can.
export function parseSpread(spread, awayName, homeName) {
  if (!spread) return { side: null, points: null };
  const awayMatch = !!(awayName && spread.startsWith(awayName));
  const homeMatch = !!(homeName && spread.startsWith(homeName));
  let side = null;
  if (awayMatch && homeMatch) side = awayName.length >= homeName.length ? 'away' : 'home';
  else if (awayMatch) side = 'away';
  else if (homeMatch) side = 'home';
  if (!side) return { side: null, points: null };
  const m = spread.match(/(-?\d+(?:\.\d+)?)\s*$/);
  return { side, points: m ? Math.abs(Number(m[1])) : null };
}
