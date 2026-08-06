# CFB HQ — College Football Top 25 Tracker

A live college football Top 25 tracker: real rankings, real betting lines, real live/final scores,
and AI-written recaps and storylines grounded entirely in that real data. Deployed as a static site
at **[mattt-lab.github.io/CFB_top25](https://mattt-lab.github.io/CFB_top25/)**.

## What it does

- **Top 25 Tracker** — the current AP/Coaches/CFP-resolved ranking, this week's biggest games (with
  live scores, spreads, and TV/streaming info), and short AI-written notes on the week's most
  interesting storylines.
- **Playoff Watch** — a real, computed projection of the 12-team CFP field: the 4 conference
  champions who'd get a first-round bye, the 5th auto-bid, the 7 at-large seeds, and who's on the
  bubble — following the actual CFP seeding rule, not a guess.
- **Live game-day scores** — game cards move through *scheduled → live → final* on their own as
  Saturday unfolds, with a pulsing "LIVE" badge and score, then a final score and a recap the moment
  a game ends. See [Live scoring](#live-scoring-how-it-stays-cheap) below for how this stays within
  a free API tier.
- **Team pages** — full season history, a ranking-history chart, computer-rating comparisons
  (SP+/FPI/Elo vs. the poll), a resume of recent results, and a head-to-head/common-opponent
  comparison against any other team.
- **Pin your teams** — star any team to add it to a personal "Your Teams" strip on the homepage,
  showing record, next opponent, and live/final status at a glance.
- **Time travel** — step back through any past week's rankings and playoff picture (team pages
  always show the full season, regardless).
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
   explicitly barred from inventing stats or picking what matters. If the API call fails for any
   reason, a plain deterministic sentence built from the same facts ships instead, so a bad API day
   never means blank text. Which path produced any given blurb is recorded (`blurbSource`) and
   disclosed to readers in the site's own footnote.

A separate GitHub Actions workflow runs this once daily. A third, much lighter script keeps scores
current between those runs — see below.

### Live scoring: how it stays cheap

CollegeFootballData's free tier caps out at **1,000 API calls a month**, and true in-game state
(live score, quarter, clock) only exists on a separate `/scoreboard` endpoint — the endpoint the
daily pipeline already uses has no visibility into a game that's currently being played. Rather than
poll constantly, `scripts/fetch-live-scores.mjs` runs on its own frequent-but-bounded schedule
(every 15 minutes, but *only* during actual game windows — Thursday/Friday night primetime plus all
of Saturday), and every tick costs exactly **one** API call regardless of how many games are live,
because `/scoreboard` returns the whole slate at once. A self-guard skips the call entirely if
nothing tracked is near kickoff. The whole thing comfortably fits inside the free quota with room to
spare.

This script never touches Claude — the moment a game goes final it writes an instant, plain
deterministic recap ("Final: #13 LSU 27, #23 Clemson 20") directly, and bumps the affected teams'
records. The nicer AI-written recap arrives naturally the next time the full daily pipeline runs,
now that `narrate.mjs` is status-aware (a pregame preview for games that haven't happened yet, a
real recap — mentioning the actual score — for ones that have).

Because both this script and the daily pipeline can write to `data/current.json` on overlapping
schedules, a push can occasionally race the other workflow's. Rather than a rebase (which would
conflict almost every time two independently-regenerated JSON files collide), a failed push
discards the local commit, fast-forwards to whatever's now on `main`, and reapplies the same
already-fetched `/scoreboard` response against that fresh base — no wasted API call, no manual
intervention.

### Other pipeline details worth knowing

- **Season changeover**: which CFB season is "current" flips automatically on August 1, even though
  the new season has no meaningful ranking data for a couple more months.
- **Pre-committee poll fallback**: the CFP committee doesn't exist for the first several weeks of
  every season. Every ranking on the site resolves a `primary` order — CFP once it exists, else the
  Coaches Poll, else AP — rather than assuming committee data is always there.
- **Point-in-time correctness**: each week's raw poll snapshot is written once and never overwritten,
  so "quality win over the team ranked #9 in week 9" stays correct in week 12, even after that
  opponent falls out of the poll entirely.

The full contract between the pipeline and the frontend — every field, who writes it, and why — is
documented in [`docs/data-schema.md`](docs/data-schema.md).

## Tech stack

- **React 19 + Vite**, deployed as a static build to GitHub Pages
- **Zustand** for the small bits of client state (pinned teams, week time-travel)
- **Recharts** for the ranking-history chart
- **Anthropic SDK** (`claude-opus-5`) for narration only — never for selection or scoring
- **Vitest** for the pure-function test suite (helpers in `src/data/teams.js` and
  `scripts/fetch-live-scores.mjs`)
- **oxlint** for linting
- Two **GitHub Actions** workflows (data pipeline + live scores) plus a third that builds and
  deploys the site on every push to `main`

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

## Project structure

```
scripts/                   data pipeline (Node, run by GitHub Actions)
  fetch-cfb-data.mjs        rankings, games, lines, ratings -> data/current.json
  score.mjs                 deterministic selection (Stage 1)
  narrate.mjs                Claude narration (Stage 2)
  fetch-live-scores.mjs     lightweight live/final score patcher
  lib/                       shared helpers (CFBD HTTP client, ranking math, game-log tagging, season rollover)
data/
  current.json               the one file the frontend reads
  rankings/                  append-only per-week poll snapshots (audit trail)
  rivalries.json             hand-maintained rivalry pairs
docs/data-schema.md          the full schema contract, kept in sync with the pipeline
src/
  pages/                     Top25Tracker, PlayoffWatch, TeamDetail
  components/                shared UI (game cards, tables, charts, gauges, ...)
  data/teams.js              the frontend's data-loading + pure-helper layer
.github/workflows/           fetch-data.yml, fetch-live-scores.yml, deploy-pages.yml
```
