# CFB HQ — College Football Top 25 Tracker

A live college football Top 25 tracker: real rankings, real betting lines, real live/final scores,
and AI-written recaps and storylines grounded entirely in that real data. Deployed as a static site
at **[mattt-lab.github.io/CFB_top25](https://mattt-lab.github.io/CFB_top25/)**.

## What it does

- **This Week** — your pinned teams' status, this week's biggest games (live scores, spreads, and
  TV/streaming info), short AI-written notes on the week's most interesting storylines, and a
  compact **Full Slate** table of every ranked team's matchup this week sorted by kickoff — flagged
  with 🔥 when the underdog is doing better than the spread implies (ahead in the first half, tied
  or better in Q3, or within a score in Q4/OT; an outright win once final).
- **Top 25** — the full current AP/Coaches/CFP-resolved ranking board: rank, week-over-week trend, a
  multi-week rank sparkline, and playoff/title odds for all 25 teams.
- **Up Next** — every game on today's schedule, not just ranked teams, live scores included and
  finished games sorted to the bottom; rolls forward to the next day with games if today's slate is
  empty.
- **Playoff Watch** — a real, computed projection of the 12-team CFP field: straight seeding since
  2025 (the top-4 teams by overall rank get the bye, not necessarily conference champions), the 5
  highest-ranked champions guaranteed a spot, the at-large seeds, and who's on the bubble —
  following the actual current CFP seeding rule, not a guess.
- **Live game-day scores** — game cards, the Full Slate table, and Up Next all move through
  *scheduled → live → final* on their own as game day unfolds, with a pulsing "LIVE" badge and a
  bigger-than-normal score, then a final score and a recap the moment a game ends. See
  [Live scoring](#live-scoring-client-side-not-a-server-poller) below for how this works without a
  server.
- **Team pages** — a full season schedule (every game, completed and upcoming), a ranking-history
  chart, computer-rating comparisons (SP+/FPI/Elo vs. the poll), a resume of recent results, and a
  head-to-head/common-opponent comparison against another team with real shared history to compare.
- **Conferences** — a directory of each Power 4 conference's standings, schedules, and the auto-bid
  race for its own CFP spot, with a dedicated page per conference.
- **Top 25 Pick 'em** — pick a result (blowout win/win/loss/blowout loss) for every ranked team's
  still-to-play game and watch the Top 25 project live, with head-to-head picks auto-synced between
  both sides of a ranked-vs-ranked matchup. Once a team's real game goes final, its pick auto-fills
  from the actual result (≥14-point margin counts as a blowout) — the board fills in with reality as
  the week plays out, and only still-unplayed games stay pickable.
- **Pin your teams** — star any team to add it to a personal "Your Teams" strip on the homepage,
  showing record, next opponent, and live/final status at a glance.
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

A single GitHub Actions workflow runs this once daily (13:00 UTC), plus a second Monday-only run
(19:30 UTC) to catch weeks whose slate runs into Sunday/Monday and pushes the AP/Coaches poll's
release later than usual — final scores land the day after a game either way, via this pipeline's
own `/games` call. That workflow commits with its own `GITHUB_TOKEN`, and GitHub's anti-recursion
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

Since ESPN's team IDs have nothing to do with CFBD's, `src/data/espnTeamMap.json` (generated by
`scripts/build-espn-team-map.mjs`, re-run only when a tracked team renames or realigns) maps our
team ids to ESPN's, so an ESPN event can be matched back to one of our games. A team or game that
can't be matched just keeps whatever `data/current.json` already says (scheduled, or final once the
next day's pipeline run catches up) — nothing in this path can crash the page.

Covers the homepage marquee panel, the Full Slate table, Up Next, conference schedules, "Your
Teams", and team pages (the last two go through a `teams[id].nextGame`-to-pseudo-game adapter,
`toPseudoGame()`, since that field is opponent-relative rather than away/home-relative).

The Full Slate table also uses this live period/score data to flag a potential upset (🔥) —
`isPotentialUpset()` in `src/data/teams.js` resolves the betting favorite from the spread string,
then checks the underdog against a live/final threshold (see the function's own comment for the
exact rule).

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
- **Vitest** for the pure-function test suite (helpers in `src/data/teams.js`,
  `src/utils/useLiveScores.js`, `src/utils/pollSpread.js`, `src/utils/projectTop25.js`, and
  `src/utils/upNextSchedule.js`)
- **oxlint** for linting
- **GitHub Actions**: one workflow for the data pipeline (daily, plus a Monday-only extra run), one
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

## Project structure

```
scripts/                   data pipeline (Node, run by GitHub Actions)
  fetch-cfb-data.mjs        rankings, games, lines, ratings -> data/current.json
  score.mjs                 deterministic selection (Stage 1)
  narrate.mjs                Claude narration (Stage 2)
  build-espn-team-map.mjs   one-off generator for src/data/espnTeamMap.json (re-run on realignment)
  lib/                       shared helpers (CFBD HTTP client, ranking math, game-log tagging, season rollover)
data/
  current.json               the one file the frontend reads
  rankings/                  append-only per-week poll snapshots (audit trail)
  rivalries.json             hand-maintained rivalry pairs
docs/data-schema.md          the full schema contract, kept in sync with the pipeline
src/
  pages/                     Top25Tracker (This Week), Top25Poll (Top 25), UpNext, PlayoffWatch,
                              TeamDetail, Conferences, ConferenceDetail, Pickem
  components/                shared UI (game cards, tables, charts, gauges, ...)
  data/teams.js              the frontend's data-loading + pure-helper layer
  data/espnTeamMap.json      our team id -> ESPN team id, for the client-side live overlay
  utils/useLiveScores.js     client-side ESPN fetch + match (marquee, Full Slate, Up Next, conferences, Your Teams, team pages)
.github/workflows/           fetch-data.yml, deploy-pages.yml, fetch-team-logos.yml (manual)
```
