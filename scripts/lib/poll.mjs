// Poll-name classification, extracted from fetch-cfb-data.mjs into its own lib module (same
// convention as ranking.mjs/game-log.mjs/season.mjs) specifically so it's safely testable --
// fetch-cfb-data.mjs calls main() unconditionally at module scope, so importing it directly (just
// to reach this function) would trigger the entire live pipeline.

// CFBD's /rankings response types `poll` as a bare string, not an enum (confirmed against the
// live OpenAPI spec -- components.schemas.Poll.poll is just `{type: "string"}`). The actual
// values it returns ("AP Top 25", "Coaches Poll", "Playoff Committee Rankings", plus lower-tier
// polls like AFCA Division II) are documented informally by downstream client libraries
// (cfbfastR). Matched case-insensitively/fuzzily so small wording drift doesn't silently break
// this script -- unrecognized polls are just skipped.
export function classifyPoll(pollName) {
  const p = (pollName || '').toLowerCase();
  // CFBD started also returning FCS-level polls (e.g. "FCS Coaches Poll") in the same /rankings
  // response as the FBS ones -- confirmed live, 2026 week 1 suddenly added one alongside the real
  // "Coaches Poll" where only the FBS one existed before. A loose "coaches" substring match can't
  // tell them apart, and since both entries land in the same `polls` array for that week, whichever
  // one is processed second silently overwrites weekPolls[wk].coaches -- confirmed live, this
  // replaced the real Top 25 Coaches Poll with FCS teams (Montana State, Montana, ...) as the
  // resolved primary ranking. Exclude anything non-FBS-level outright; this app only ever tracks
  // FBS rankings, so there's never a legitimate reason for a lower-division poll to match here.
  // Broadened beyond "fcs" alone (the original incident's exact trigger) to Division II/III too --
  // same failure mode, different substring, and cfbfastR's own poll-name docs list both as real
  // values CFBD can return in this response.
  if (/\b(fcs|division\s+ii|division\s+iii|d-?ii|d-?iii)\b/.test(p)) return null;
  if (p.includes('playoff committee') || p === 'cfp') return 'cfp';
  if (p.includes('coaches')) return 'coaches';
  if (p.includes('ap top') || p === 'ap') return 'ap';
  return null;
}
