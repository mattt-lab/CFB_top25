# Data schema

The contract between the data-fetch pipeline (`scripts/`) and the frontend (`src/`). Every
downstream task — the fetch script, the scoring/narration scripts, and the app's data loader —
targets this shape. If it needs to change, update this file first.

## File layout

```
data/
  current.json          <- single consolidated file the frontend imports at build time
  current.sample.json   <- fixture matching this schema, generated from mock data (no live API needed)
  rivalries.json         <- static hand-maintained config (task #4), NOT fetched from any API
  rankings/
    2026-wk07.json ... 2026-wk14.json
                          <- raw per-week poll snapshots as returned by CFBD, one file per week,
                             append-only (never overwritten). This is the audit trail / source of
                             truth. current.json's `rankingsByWeek` is a derived rollup of these.
```

**Why the split:** `data/rankings/*.json` exists so a later week's fetch can never silently corrupt
an earlier week's point-in-time record — that's what makes "quality win over the team ranked #9
*in week 9*" still correct in week 12, even after that opponent falls out of the poll. `current.json`
is the single file the app actually reads; it's cheap to regenerate from the raw snapshots at fetch
time.

**Real-data change from the mockup:** the mockup split teams into `DETAILED` (7 teams with full
poll/game history, hand-authored) and `SUMMARY` (18 teams, current-state-only) purely because
hand-authoring 25 full histories was tedious. CFBD returns the same shape of data for every FBS
team uniformly — **that split doesn't exist in the real schema.** Every team in `teams` has the
same fields. Similarly, the mockup's seeded-RNG `WEEKLY_ORDER` generator (fabricating a plausible
historical ranking order) goes away entirely — `rankingsByWeek` below is real historical data, not
a simulation.

## Season changeover and the pre-committee gap

Two related facts about real CFBD data that shape this schema, both confirmed live rather than
assumed:

- **Which season is "current" isn't just the calendar year.** A season is named by the year it
  starts (the "2026 season" runs Aug 2026 → Jan 2027), and the previous season's national
  championship happens in January — so for the five months between January and July, "the
  season worth showing" started the *previous* calendar year. `scripts/lib/season.mjs` resolves
  this with an explicit rule: the previous season stays the target through the off-season, and
  the site flips forward on **August 1**, even though the new season won't have meaningful
  ranking data for another couple of months.
- **The CFP committee doesn't exist for the first ~6-10 weeks of every season** (its first
  reveal is usually week 7-11). For that whole span — which, right after the Aug 1 changeover,
  is *every* week until the committee starts — there's no `cfp` poll to rank teams by. Every
  week therefore resolves a **primary** ranking with a fallback chain: **CFP Committee → Coaches
  Poll → AP**. This is "our own analytics [SP+/FPI/Elo] + USA Today/Coaches poll stuff" filling
  the gap the committee hasn't filled yet — not a placeholder, a real published poll. Confirmed
  live: early August currently has exactly one poll on file for the upcoming season — a
  preseason Coaches Poll — with real teams, points, and first-place votes, weeks before the
  committee exists.

Everything that needs "the" cross-team ranking (Top 25 order, tiers, the Playoff Watch bracket,
time-travel, quality-win/bad-loss tagging) reads the resolved `primary` order below, **never**
`cfp` directly — `cfp` alone would be empty for a real stretch of every season.

## Game status lifecycle

`games[].status` / `teams[id].nextGame.status` move through exactly three states: `"scheduled"` →
`"in_progress"` → `"final"`. Two different scripts write this field, at two different cadences,
because CFBD splits the data across two endpoints with very different freshness:

- **`fetch-cfb-data.mjs`** (once daily) reads CFBD's plain `/games` endpoint, which only ever
  reports a boolean `completed` flag plus final points — no true mid-game state. It writes
  `"scheduled"` or `"final"` (never `"in_progress"`) directly from that, for free, with zero extra
  API calls. This is also what stops a game from ever regressing from `"final"` back to
  `"scheduled"` the next time this script rebuilds `games[]` from scratch.
- **`fetch-live-scores.mjs`** (every ~15 min during game windows — see
  `.github/workflows/fetch-live-scores.yml`) is the **only** writer of `"in_progress"`, `period`,
  and `clock`, via CFBD's separate `/scoreboard` endpoint (one call returns every currently-live
  game at once). It patches both `games[]` and `allGames[]` (so a Conference Tracker page's
  schedule section shows live state too, not just the marquee panel), plus every team's
  `nextGame`. It can also confirm `"final"` well before the next day's heavy pipeline run gets
  to it — the moment it first sees a game go final, it bumps both teams' `wins`/`losses`, appends a
  `teams[id].games[]` entry (with `oppConf`, so `confRecord()` stays correct even for a game this
  script settled mid-week), and writes a deterministic recap sentence directly into `blurb`
  (`blurbSource: "fallback"`) so the result shows up immediately, not whenever Claude next runs.

`blurbSource: "fallback"` on a **`final`** game therefore doesn't necessarily mean the LLM call
failed — it may just mean the light poller's instant recap hasn't been replaced by narrate.mjs's
nicer LLM-written recap yet (narrate.mjs is now status-aware: it writes a postgame recap for
`"final"` games and a pregame preview for everything else, replacing whatever was there before).

## `data/current.json`

```jsonc
{
  "meta": {
    "season": 2026,
    "currentWeek": 12,                    // most recent week with ANY poll data (not committee-only)
    "currentPrimarySource": "cfp",        // "cfp" | "coaches" | "ap" — which poll currentWeek's ranking actually comes from;
                                           // the frontend labels things honestly off this ("Coaches Poll" pre-committee)
                                           // rather than assume it's always committee data
    "lastUpdated": "2026-11-25T13:04:00Z",
    "weeksAvailable": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]   // every week with ANY poll (AP/Coaches/CFP), ascending
  },

  // One entry per week with ANY poll data — not committee-only; a preseason-Coaches-Poll-only
  // week (or any pre-committee week) still gets an entry here, just with `cfp: []`. Used for
  // time-travel (Top 25 Tracker + Playoff Watch only — team drilldowns always show
  // current/full-season data regardless). Each poll is an ordered array of team ids, best-ranked
  // first; `primary` is the pre-resolved CFP → Coaches → AP fallback (see "Season changeover"
  // above) — use THIS for cross-team ranking, not `cfp` directly. `cfp` may also be a shorter
  // list than 25 in early committee weeks if CFBD hasn't published a full 25 yet — treat missing
  // entries as unranked, not an error.
  "rankingsByWeek": {
    "1":  { "ap": [], "coaches": ["ohio-state", "oregon", "..."], "cfp": [], "primary": ["ohio-state", "oregon", "..."], "primarySource": "coaches" },
    "7":  { "ap": ["ohio-state", "georgia", "..."], "coaches": ["..."], "cfp": ["..."], "primary": ["..."], "primarySource": "cfp" },
    "12": { "ap": ["..."], "coaches": ["..."], "cfp": ["..."], "primary": ["..."], "primarySource": "cfp" }
  },

  // Keyed by team id (lowercase, hyphenated: slugify(name)) for O(1) lookup.
  // Every currently-ranked-or-recently-ranked team gets a full entry — no lightweight variant.
  // EXCEPTION: every team in one of the 4 Conference Tracker conferences (Big Ten, SEC, ACC, Big
  // 12) gets an entry regardless of ranked/recently-ranked status, so a standings table doesn't
  // silently drop an unranked member sitting a bye week. Free (reads teamMeta, already populated
  // from the full-season /games fetch) and deliberately asymmetric -- every other conference's
  // team universe is exactly the ranked-or-this-week's-slate rule above, unchanged.
  "teams": {
    "ohio-state": {
      "name": "Ohio State",
      "conf": "Big Ten",
      "wins": 11,
      "losses": 1,
      "sp": 1,          // SP+ rank (integer, 1 = best)
      "fpi": 2,          // ESPN FPI rank
      "elo": 1,          // Elo rank
      "ap": [3, 3, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1],           // one entry per week 1-12+, null before the team is first ranked
      "coaches": [3, 3, 2, 2, 2, 3, 2, 2, 2, 1, 1, 1],
      "cfp": [null, null, null, null, null, null, 2, 2, 2, 1, 1, 1], // null before the committee's first reveal that season -- this varies year to year (confirmed live: week 7 in some seasons, week 11 in 2024), it isn't a fixed week number
      "games": [
        {
          "wk": 7,
          "opp": "Penn State",
          "oppConf": "Big Ten",  // opponent's conference (from the same /games response, not re-looked-up) -- lets confRecord() derive an in-conference W-L without fragile opponent-name matching; realignment-safe since it's compared against the team's own CURRENT conf, not stored as a fixed relationship
          "oppRank": 4,          // opponent's rank IN THAT WEEK, looked up from rankings/2026-wk07.json — this is why the snapshot files exist
          "res": "W",
          "tag": "quality"       // "quality" | "bad" | "" — computed once at derive time, not in the browser
        }
      ],
      "nextGame": {            // this team's own current-week matchup, from the FULL currentWeek
                                // slate — survives Stage 1 trimming `games` (top-level) down to
                                // the top 6, so every team has this, not just the ones in
                                // "biggest games". See "Game status lifecycle" below for who
                                // writes status/score/period/clock and when.
        "opponent": "Michigan",
        "opponentRank": 8,      // null if the opponent is unranked
        "homeAway": "home",     // "home" | "away" — is THIS team hosting or visiting
        "when": "2026-11-29T17:00:00Z",
        "network": "FOX",       // same source as games[].network; null if CFBD has no media entry yet
        "cfbdId": 401628383,    // CFBD's own numeric game id -- how fetch-live-scores.mjs matches
                                // this game against a /scoreboard response
        "status": "scheduled",  // "scheduled" | "in_progress" | "final"
        "awayScore": null,      // null until the game has started
        "homeScore": null,
        "period": null,         // current quarter -- only ever set while status is "in_progress"
        "clock": null           // e.g. "8:42" -- only ever set while status is "in_progress"
      },                        // null (not present as an object) if this team has no game in
                                // currentWeek's slate — bye week, or no games left on the schedule
      "bubbleNote": {           // present ONLY for the 4 teams currently on the playoff bubble
                                // (seeds 13-16, per computeField()) -- a "current state" fact like
                                // `nextGame`, not a historical per-week series, so a past-week
                                // time-travel view won't have this for whoever was on the bubble
                                // then. null for every other team.
        "seed": 13,             // 13-16, by bubble position -- NOT the same as raw poll rank,
                                // since a conference-champion bye can absorb a higher-ranked team
                                // out of the at-large pool
        "spotsFromField": 1,    // seed - 12; 1 = just missed the field, 4 = furthest out
        "movedUp": 2,           // rank spots gained since last week (negative = fell back)
        "trendScore": 0.45,     // same signal as predictions[].score, for Stage 1 tuning
        "nextOpponentRank": 23, // this team's next opponent's rank, or null if unranked/unknown
        "blurb": "...",         // Stage 2 output
        "blurbSource": "llm"    // "llm" | "fallback"
      }
    }
  },

  // The FULL current-week slate (~90-100 games) -- written once by the fetch script and never
  // trimmed. `games` below is a pure SUBSET of this array (the top 6 by stakesScore), not an
  // independently-fetched list -- Conference Tracker pages read allGames directly so a
  // conference's schedule section shows every one of its games this week, not just whichever made
  // the sitewide marquee panel. Entries here only ever get an LLM/fallback blurb if Stage 1 also
  // selected them into `games` (see that array's own comment) -- narrating the full weekly slate
  // for every conference would meaningfully multiply Claude calls for text that mostly restates
  // what's already on the card (rank, record, spread), so non-marquee entries keep
  // `stakesScore`/`blurb`/`blurbSource` at their fetch-time null/unset values forever.
  "allGames": [
    {
      "id": "2026-wk12-osu-mich",
      "cfbdId": 401628383,          // CFBD's own numeric game id -- how fetch-live-scores.mjs matches this game against a /scoreboard response
      "away": "ohio-state", "awayRank": 1,
      "home": "michigan", "homeRank": 8,
      "when": "2026-11-29T17:00:00Z",
      "spread": "Ohio State -6.5",
      "ou": 44.5,
      "network": "FOX",              // TV network or streaming outlet from CFBD's /games/media endpoint; null if CFBD has no media entry yet (common for games far in advance)
      "rivalry": true,               // from data/rivalries.json
      "status": "scheduled",         // "scheduled" | "in_progress" | "final" -- see "Game status lifecycle" below
      "awayScore": null, "homeScore": null,  // null until the game has started
      "period": null, "clock": null, // e.g. period 3, clock "8:42" -- only ever set while status is "in_progress"
      "stakesScore": null,           // Stage 1 output IF this game was selected into `games` below -- null otherwise
      "blurb": null,
      "blurbSource": null
    }
  ],

  // This week's "biggest games" marquee panel -- the top 6 of `allGames` above by stakesScore,
  // populated by Stage 1 (scoring, task #6) and Stage 2 (narration, task #7). Same per-game shape
  // as allGames, just narrated. The frontend just renders what's here, no client-side scoring.
  "games": [
    {
      "id": "2026-wk12-osu-mich",
      "cfbdId": 401628383,
      "away": "ohio-state", "awayRank": 1,
      "home": "michigan", "homeRank": 8,
      "when": "2026-11-29T17:00:00Z",
      "spread": "Ohio State -6.5",
      "ou": 44.5,
      "network": "FOX",
      "rivalry": true,
      "status": "scheduled",
      "awayScore": null, "homeScore": null,
      "period": null, "clock": null,
      "stakesScore": 9.1,            // Stage 1 output, for debugging/tuning — not rendered directly
      "blurb": "The Game. A Michigan win puts real pressure on the committee's #1 seed.",
      "blurbSource": "llm"           // "llm" | "fallback" | "manual" — which path produced `blurb` ("manual" only appears in current.sample.json, for the hand-written mockup-era blurbs)
    }
  ],

  // This week's scored + narrated team storylines (the "what the model expects" panel).
  "predictions": [
    {
      "teamId": "vanderbilt",
      "score": 7.4,
      "blurb": "Vanderbilt is this week's fastest riser...",
      "blurbSource": "llm"
    }
  ],

  // Playoff Watch's "Path scenarios" panel -- real, computed candidates for what could reshape
  // the 12-team field, replacing what used to be hand-written mockup-era copy. Two `type`s, with
  // different fact fields (both share id/score/blurb/blurbSource):
  "fieldStorylines": [
    {
      "id": "conf-race-big-ten",
      "type": "conf-race-gap",       // how tight a conference's auto-bid race is
      "conf": "Big Ten",
      "leaderId": "ohio-state", "leaderRank": 1,
      "chaserId": "oregon", "chaserRank": 2,
      "gap": 1,                      // chaserRank - leaderRank; smaller = tighter race
      "score": 9,                    // Stage 1 selection score, max(0, 10 - gap)
      "blurb": "...", "blurbSource": "llm"
    },
    {
      "id": "matchup-2026-wk1-lsu-clemson",
      "type": "bye-line-matchup",    // or "bubble-line-matchup" -- an upcoming game between two
                                      // teams in the same playoff-contention band (both current
                                      // bye seeds, or both current bubble seeds)
      "gameId": "2026-wk1-lsu-clemson",
      "awayId": "lsu", "awayRank": 13,
      "homeId": "clemson", "homeRank": 15,
      "score": 7,                    // 9 for bye-line, 7 for bubble-line (rarer/higher-stakes)
      "blurb": "...", "blurbSource": "llm"
    }
  ]
}
```

## `data/rankings/2026-wkNN.json`

Raw per-week snapshot, written once by the fetch script and never overwritten. Same `polls` shape
as one entry of `rankingsByWeek` above:

```jsonc
{
  "week": 9,
  "fetchedAt": "2026-10-28T13:02:00Z",
  "polls": {
    "ap": ["georgia", "ohio-state", "..."],
    "coaches": ["..."],
    "cfp": [],                              // empty before the committee's first reveal
    "primary": ["georgia", "ohio-state", "..."],  // CFP -> Coaches -> AP fallback, resolved once here
    "primarySource": "coaches"
  }
}
```

## `data/rivalries.json`

Static, hand-maintained, versioned in the repo — not derived from any API (same pattern as the
SR-520 speed-limit constant). Team ids reference the same `slugify(name)` convention as `teams`
above.

```jsonc
[
  { "a": "ohio-state", "b": "michigan", "name": "The Game" },
  { "a": "texas", "b": "oklahoma", "name": "Red River Rivalry" }
]
```

## Team id convention

`slugify(name)`: NFD-normalize and strip combining diacritics first (so `"San José State"` →
`"san-jose-state"`, not `"san-jos-state"` — confirmed live, that's a real FBS team), then
lowercase and replace runs of non-alphanumeric characters with a single hyphen, trimming leading/
trailing hyphens. E.g. `"Texas A&M"` → `"texas-a-m"`, `"Ohio State"` → `"ohio-state"`. Every file
in `data/` that references a team uses this id, never the display name, so a mid-season name/
branding change doesn't break joins.

## Who populates what

| Field | Populated by |
|---|---|
| `meta`, `rankingsByWeek`, `teams` (except `games[].tag`/`oppConf`) | fetch script (task #5) |
| `allGames` (full weekly slate) | fetch script (task #5) -- `games` is a Stage 1-derived subset, not independently fetched |
| `teams[].games[].tag`/`oppConf` | fetch script, using that week's `rankings/wkNN.json` snapshot for the opponent's point-in-time rank (`tag`) and the same `/games` response's `awayConference`/`homeConference` (`oppConf`) |
| `games[].stakesScore`, `predictions[].score`, `fieldStorylines`, `teams[].bubbleNote` (minus `blurb`/`blurbSource`) | Stage 1 scoring (task #6) -- also where `games` itself is derived from `allGames` |
| `games[].blurb`, `predictions[].blurb`, `fieldStorylines[].blurb`, `teams[].bubbleNote.blurb`, all `blurbSource` fields | Stage 2 narration (task #7), with a deterministic-line fallback on failure -- status-aware since the live-score work: a pregame preview for scheduled/in_progress games, a postgame recap for final ones |
| `games[]`/`allGames[].cfbdId`/`status`/`awayScore`/`homeScore`, `teams[].nextGame.cfbdId`/`status`/`awayScore`/`homeScore` | fetch script (`"scheduled"`/`"final"` only, from `/games`) -- see "Game status lifecycle" above |
| `games[]`/`allGames[].period`/`clock`, `teams[].nextGame.period`/`clock`, and confirming `"final"` sooner than the next daily run | `scripts/fetch-live-scores.mjs`, from CFBD's `/scoreboard` endpoint -- the only writer of `"in_progress"` |
