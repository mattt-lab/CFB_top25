# CFB HQ — College Football Top 25 Tracker

A live college football Top 25 tracker: real rankings, real betting lines, real live/final scores,
and AI-written recaps and storylines grounded entirely in that real data. Deployed as a static site
at **[mattt-lab.github.io/CFB_top25](https://mattt-lab.github.io/CFB_top25/)**.

## What it does

- **This Week** — your pinned teams' status, this week's biggest games (live scores, spreads, and
  TV/streaming info), short AI-written notes on the week's most interesting storylines, and a
  compact **Full Slate** table of every ranked team's matchup this week sorted by kickoff — flagged
  with 🔥 when an underdog (per the betting line) is making a game interesting *after halftime*:
  tied or ahead in Q3 (unless it's a coin-flip line of 3 points or fewer), ahead or within a score
  in Q4/OT, and an outright win once final. Nothing is flagged in the first half. See
  [Live scoring](#live-scoring-client-side-not-a-server-poller) for the exact rule.
- **Top 25** — the full current AP/Coaches/CFP-resolved ranking board: rank, week-over-week trend, a
  multi-week rank sparkline, and playoff/title odds for all 25 teams.
- **Up Next** — every game on today's schedule, not just ranked teams, live scores included and
  finished games sorted to the bottom; rolls forward to the next day with games if today's slate is
  empty. Same 🔥 upset flag as the Full Slate; a same-day kickoff shows just its time and network.
- **Playoff Watch** — a real, computed projection of the 12-team CFP field: straight seeding since
  2025 (the top-4 teams by overall rank get the bye, not necessarily conference champions), the 5
  highest-ranked champions guaranteed a spot, the at-large seeds, and who's on the bubble —
  following the actual current CFP seeding rule, not a guess.
- **Live game-day scores** — game cards, the Full Slate table, Up Next, and conference pages all
  move through *scheduled → live → final* on their own as game day unfolds. A live game shows a
  pulsing dot, the quarter and clock, and the network — `Q4 4:00 FOX`, or `Halftime` at the break —
  beside a bigger-than-normal score that leads with the leading team's name (`Miami 55–3`, no
  "leads"/"wins" wording). Once a game ends it shows a final score, with the recap following on the
  next pipeline run. Kickoff times always render in the visitor's own time zone (the footer says
  so). See [Live scoring](#live-scoring-client-side-not-a-server-poller) below for how this works
  without a server.
- **Team pages** — a full season schedule (every game, completed and upcoming), a ranking-history
  chart, computer-rating comparisons (SP+/FPI/Elo vs. the poll), a resume of recent results, and a
  head-to-head/common-opponent comparison against another team with real shared history to compare.
- **Conferences** — a directory of each Power 4 conference's standings, schedules, and the auto-bid
  race for its own CFP spot, with a dedicated page per conference.
- **Top 25 Pick 'em** — pick a result (blowout win/win/loss/blowout loss) for every ranked team's
  still-to-play game and watch the Top 25 project live, with head-to-head picks auto-synced between
  both sides of a ranked-vs-ranked matchup. Once a team's real game goes final, its pick auto-fills
  from the actual result (≥14-point margin counts as a blowout) — the board fills in with reality as
  the week plays out, and only still-unplayed games stay pickable. On phones it's left out of the
  top nav; the Top 25 page links to it.
- **Pin your teams** — star any team (in the Top 25 or conference standings tables, or at the
  top-right of its own team page) to add it to "Your Teams" on the homepage: one full-width card per
  pinned team, laid out like the "biggest games" cards — kickoff, network and the star up top, the
  matchup with both records (each team links to its own page), the spread and over/under (or the
  live/final score), then the same AI-written analysis blurb the marquee panel gets whenever that
  game involves a currently-ranked team.
- **Honest about gaps** — every panel that depends on data that doesn't exist yet (SP+ before it's
  published, trend history before week 2, an AI recap before it's had a moment to write one) says so
  explicitly instead of rendering a wall of blank dashes.

## How the data pipeline works

Nothing in the frontend calls an API directly — it only ever reads one committed file,
`data/current.json`, regenerated on a schedule by GitHub Actions. The pipeline is split into two
stages that are deliberately never allowed to blur together:

1. **Selection is always deterministic, never the model's call.** `scripts/fetch-cfb-data.mjs`
   pulls rankings, games, betting lines, broadcast info, and computer ratings from
   [CollegeFootballData.com](https://collegefootballdata.com); `scripts/score.mjs` scores every
   game and team storyline on plain, explainable signals (rank, proximity to a playoff cutoff,
   rivalry, trajectory vs. the computer ratings, spread-implied competitiveness) and picks the
   handful worth surfacing.
2. **Narration is always Claude's call, never a selection.** `scripts/narrate.mjs` hands the
   already-selected facts to Claude (`claude-opus-5`) and asks for nothing but phrasing — it's
   explicitly barred from inventing stats or picking what matters. Those facts are enriched first
   with real ESPN detail — an AP-sourced recap article plus scoring-play and turnover data for a
   finished game, ESPN's Matchup Predictor win probability for an upcoming one — as reference
   material only: never quoted, never committed (see
   [`docs/data-schema.md`](docs/data-schema.md#blurb-narration-sources-stage-2)). If the API call
   fails for any reason, a plain deterministic sentence built from the same facts ships instead, so
   a bad API day never means blank text. Which path produced any given blurb is recorded
   (`blurbSource`) and disclosed to readers in the site's own footnote.

A single GitHub Actions workflow runs this once daily (13:00 UTC), plus a Monday-only run
(19:30 UTC) to catch weeks whose slate runs into Sunday/Monday and pushes the AP/Coaches poll's
release later than usual, and two Saturday-only runs (00:00 and 06:00 UTC — 8pm and 2am ET) since
Saturday carries the large majority of each week's games and the single daily run fires before
nearly any of them have even kicked off — those two catch final scores the same night instead of
sitting stale until the next day's run, via this pipeline's own `/games` call. That workflow
commits with its own `GITHUB_TOKEN`, and GitHub's anti-recursion
rule means a `GITHUB_TOKEN` push does *not* trigger another workflow's `on: push` listener — so it
explicitly dispatches `deploy-pages.yml` itself after a real data change, rather than relying on the
push to cascade. See below for how *in-game* state gets on the page sooner than that.

### Live scoring: client-side, not a server poller

True in-game state (live score, quarter, clock) used to come from CFBD's separate `/scoreboard`
endpoint, polled every 15 minutes by its own GitHub Actions workflow. CFBD put that endpoint behind
a paid Patreon tier, so that workflow's retired. Instead, the affected pages fetch ESPN's public
scoreboard **directly from the visitor's own browser** on page load (`src/utils/useLiveScores.js`)
— no server involved, no API key, one request per visitor rather than a metered server-side quota.
It polls every 60 seconds, but only while a matched game is actually in progress and the tab is
visible, and pauses when the tab is backgrounded.

Each poll asks ESPN for one *day* at a time and merges the results. ESPN files every game under its
US-Eastern calendar day (an 8pm ET Saturday kickoff is still "Saturday"), and the app never sends
a multi-day `dates=A-B` range: as of 2026-09-19 ESPN answers every range with HTTP 400, which once
silently froze every live score on the site. Explicit dates are still needed rather than ESPN's
dateless default, whose "current window" can omit a real, in-progress game (a ranked team hosting an
FCS opponent, once). A day that fails is skipped as long as another worked; only a total failure
backs off and retries.

Since ESPN's team IDs have nothing to do with CFBD's, `src/data/espnTeamMap.json` (generated by
`scripts/build-espn-team-map.mjs`) maps our team ids to ESPN's, so an ESPN event can be matched
back to one of our games. It's a static snapshot of the teams in the data when it was generated, so
it goes stale whenever a new team enters the weekly slate (FCS opponents rotate every week) — a team
missing from it can never get a live update. Re-run it when that happens, and *merge* the result
with the existing map rather than replacing it: a fresh run only contains the teams in the current
slate, and dropping the rest would break them again the week they return. A team or game that can't
be matched just keeps whatever `data/current.json` already says (scheduled, or final once the next
pipeline run catches up) — nothing in this path can crash the page.

Covers the homepage marquee panel, the Full Slate table, Up Next, conference schedules, "Your
Teams", and team pages (the last two go through a `teams[id].nextGame`-to-pseudo-game adapter,
`toPseudoGame()`, since that field is opponent-relative rather than away/home-relative).

`gameStatusBadge()` in `src/data/teams.js` is the single source for how a live game reads
everywhere (`Q4 4:00`, or `Halftime` at period 2 with the clock at 0:00). ESPN can report a game "in
progress" before it has a real period — a literal "Q0" — so a live game with no period is treated as
not started rather than shown as live.

The 🔥 upset flag (Full Slate and Up Next) comes from `isPotentialUpset()` in `src/data/teams.js`.
It works from the betting line, not the poll rank: the favorite is resolved from CFBD's spread
string (`src/utils/spread.js`, shared with the Pick 'em scripts), and the flag means the
*underdog* is doing better than the line implies — only after halftime:

| State | Flagged when the underdog is |
|---|---|
| Q1–Q2 (including halftime) | never |
| Q3 | tied or ahead — but not a tiny underdog (a line of 3 points or fewer) |
| Q4 / OT | ahead by any amount, or behind by no more than 7 |
| Final | the winner |

No line, or a line that matches neither team's name, means no flag rather than a guess. Replayed
against a real week of play-by-play, first-half leads flagged about half of all games and the
favorite usually won, which is why they're ignored.

### Pick 'em snapshots and review

A manual evaluation loop — not part of the GitHub Actions workflow, and it needs no API keys — for
checking how well the Pick 'em projection predicts the real poll:

- `node scripts/snapshot-pickem.mjs` — once a week's ranked games are all final, freezes the
  projection (the page's own model, with each team's real result as its pick) into
  `data/pickem-snapshots/{season}-wk{NN}.json`, along with every game's pre-game spread, over/under
  and final score. `data/current.json` rolls to the next slate and would otherwise lose the lines.
  Games the committed data hasn't marked final yet are checked against ESPN, and
  `--require-complete` refuses to write if any ranked game is still unfinished.
- `node scripts/review-pickem.mjs --write` — once the next poll lands in `data/rankings/`, compares
  projected against actual order (with a "leave the poll unchanged" baseline) and against the
  betting line: how each result compared with its spread, and whether the poll moved with it. Exits
  with code 3 if that poll isn't in the data yet.
- `docs/pickem-snapshots/` — the written-up weekly analyses. A 25-slot poll is zero-sum, so they
  grade only "root movers", not teams carried along by someone else's move; and since the model can
  only re-sort the 25 teams already ranked, teams that fall out or enter are reported separately.

The snapshot format is documented in [`docs/data-schema.md`](docs/data-schema.md).

### Other pipeline details worth knowing

- **Season changeover**: which CFB season is "current" flips automatically on August 1, even though
  the new season has no meaningful ranking data for a couple more months.
- **Pre-committee poll fallback**: the CFP committee doesn't exist for the first several weeks of
  every season. Every ranking on the site resolves a `primary` order — CFP once it exists, else the
  Coaches Poll, else AP — rather than assuming committee data is always there.
- **Point-in-time correctness**: each week's raw poll snapshot is written once and never overwritten,
  so "quality win over the team ranked #9 in week 9" stays correct in week 12, even after that
  opponent falls out of the poll entirely.
- **Records/recaps settle once a day, not instantly**: back when a server-side script polled CFBD's
  `/scoreboard`, a team's win-loss record and game log updated the moment its game went final. That
  script's retired (see above), so records/recaps now only ever update on the next daily pipeline
  run — the client-side live overlay is display-only and never writes back to `data/current.json`.

The full contract between the pipeline and the frontend — every field, who writes it, and why — is
documented in [`docs/data-schema.md`](docs/data-schema.md).

## Tech stack

- **React 19 + Vite**, deployed as a static build to GitHub Pages
- **Zustand** for the one bit of client state that needs it (pinned teams)
- **Recharts** for the ranking-history chart
- **Anthropic SDK** (`claude-opus-5`) for narration only — never for selection or scoring
- **Vitest** for the pure-function test suite (helpers in `src/data/teams.js`; the `src/utils/`
  modules for live-score matching, spread parsing, the Pick 'em model, poll spreads, and the Up Next
  schedule; and the pipeline's pure `scripts/lib/` modules — ESPN matching and game stories, ranking
  math, poll classification, and the Pick 'em snapshot/review)
- **oxlint** for linting
- **GitHub Actions**: one workflow for the data pipeline (daily, plus a Monday extra run and two
  Saturday-night catch-up runs), one
  that builds and deploys the site on every push to `main` (including an explicit dispatch from the
  data workflow itself, since its own commits don't trigger that push listener), and a
  manually-triggered one to refresh team logos

## Running it locally

```bash
npm install
npm run dev      # dev server against whatever's in data/current.json
npm run test     # vitest
npm run lint     # oxlint
npm run build    # production build to dist/
```

To run the real data pipeline yourself, you'll need free API keys from
[CollegeFootballData.com](https://collegefootballdata.com/key) and
[Anthropic](https://console.anthropic.com/):

```bash
CFBD_API_KEY=... node scripts/fetch-cfb-data.mjs
node scripts/score.mjs
ANTHROPIC_API_KEY=... node scripts/narrate.mjs
```

The Pick 'em evaluation scripts read the committed data and public ESPN, so they need no keys:

```bash
node scripts/snapshot-pickem.mjs         # freeze this week's projection + lines once games are final
node scripts/review-pickem.mjs --write   # compare a snapshot with the next real poll
```

## Project structure

```
scripts/                   data pipeline (Node, run by GitHub Actions)
  fetch-cfb-data.mjs        rankings, games, lines, ratings -> data/current.json
  score.mjs                 deterministic selection (Stage 1)
  narrate.mjs                Claude narration (Stage 2)
  build-espn-team-map.mjs   generator for src/data/espnTeamMap.json (re-run + merge when new teams appear)
  snapshot-pickem.mjs       manual: freeze a week's Pick 'em projection + pre-game lines
  review-pickem.mjs         manual: compare a snapshot with the next real poll
  lib/                       shared helpers (CFBD HTTP client, ranking math, game-log tagging, season
                              rollover, ESPN event matching + recap/predictor extraction, Pick 'em snapshot/review)
data/
  current.json               the one file the frontend reads
  rankings/                  append-only per-week poll snapshots (audit trail)
  ratings/                   append-only per-week SP+/FPI/Elo rank snapshots
  pickem-snapshots/          frozen Pick 'em projections + lines, and their reviews
  rivalries.json             hand-maintained rivalry pairs
docs/
  data-schema.md             the full schema contract, kept in sync with the pipeline
  pickem-snapshots/          written-up weekly Pick 'em analyses
src/
  pages/                     Top25Tracker (This Week), Top25Poll (Top 25), UpNext, PlayoffWatch,
                              TeamDetail, Conferences, ConferenceDetail, Pickem
  components/                shared UI (game cards, tables, charts, gauges, ...)
  data/teams.js              the frontend's data-loading + pure-helper layer
  data/espnTeamMap.json      our team id -> ESPN team id, for the client-side live overlay
  utils/useLiveScores.js     client-side ESPN fetch + match (marquee, Full Slate, Up Next, conferences, Your Teams, team pages)
  utils/spread.js            betting-line string -> favorite + size (upset flag, Pick 'em scripts)
  utils/pickemModel.js       the Pick 'em page's data prep, shared with the snapshot script
  utils/projectTop25.js      the Pick 'em re-ranking model
.github/workflows/           fetch-data.yml, deploy-pages.yml, fetch-team-logos.yml (manual)
```
