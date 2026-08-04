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

## `data/current.json`

```jsonc
{
  "meta": {
    "season": 2026,
    "currentWeek": 12,              // most recent week with a committee ranking
    "lastUpdated": "2026-11-25T13:04:00Z",
    "weeksAvailable": [7, 8, 9, 10, 11, 12]   // weeks with a CFP committee ranking (poll history starts wk 1, committee starts wk 7)
  },

  // One entry per week that has a committee ranking. Used for time-travel (Top 25 Tracker +
  // Playoff Watch only — team drilldowns always show current/full-season data regardless).
  // Each poll is an ordered array of team ids, best-ranked first. `cfp` may be a shorter list
  // than 25 in early committee weeks if CFBD hasn't published a full 25 yet — treat missing
  // entries as unranked, not an error.
  "rankingsByWeek": {
    "7":  { "ap": ["ohio-state", "georgia", "..."], "coaches": ["..."], "cfp": ["..."] },
    "8":  { "ap": ["..."], "coaches": ["..."], "cfp": ["..."] },
    "12": { "ap": ["..."], "coaches": ["..."], "cfp": ["..."] }
  },

  // Keyed by team id (lowercase, hyphenated: slugify(name)) for O(1) lookup.
  // Every currently-ranked-or-recently-ranked team gets a full entry — no lightweight variant.
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
      "cfp": [null, null, null, null, null, null, 2, 2, 2, 1, 1, 1], // null for weeks 1-6 (pre-committee)
      "games": [
        {
          "wk": 7,
          "opp": "Penn State",
          "oppRank": 4,          // opponent's rank IN THAT WEEK, looked up from rankings/2026-wk07.json — this is why the snapshot files exist
          "res": "W",
          "tag": "quality"       // "quality" | "bad" | "" — computed once at derive time, not in the browser
        }
      ]
    }
  },

  // This week's scored + narrated matchup slate. Populated by Stage 1 (scoring, task #6) and
  // Stage 2 (narration, task #7) — the frontend just renders what's here, no client-side scoring.
  "games": [
    {
      "id": "2026-wk12-osu-mich",
      "away": "ohio-state", "awayRank": 1,
      "home": "michigan", "homeRank": 8,
      "when": "2026-11-29T17:00:00Z",
      "spread": "Ohio State -6.5",
      "ou": 44.5,
      "rivalry": true,               // from data/rivalries.json
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
    "cfp": ["..."]   // omitted/empty for weeks before the committee's first reveal (week 7)
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

`slugify(name) = name.toLowerCase().replace(/[^a-z0-9]+/g, '-')` — e.g. `"Texas A&M"` →
`"texas-a-m"`, `"Ohio State"` → `"ohio-state"`. Every file in `data/` that references a team uses
this id, never the display name, so a mid-season name/branding change doesn't break joins.

## Who populates what

| Field | Populated by |
|---|---|
| `meta`, `rankingsByWeek`, `teams` (except `games[].tag`) | fetch script (task #5) |
| `teams[].games[].tag` | fetch script, using that week's `rankings/wkNN.json` snapshot to know the opponent's point-in-time rank |
| `games[].stakesScore`, `predictions[].score` | Stage 1 scoring (task #6) |
| `games[].blurb`, `predictions[].blurb`, `blurbSource` | Stage 2 narration (task #7), with a deterministic-line fallback on failure |
