# Week 1 → Week 2 Pick'em snapshot

**Captured:** 2026-09-07 (Monday of Week 1 game week), from the live `/pickem` page's real state —
every ranked team's game result as of this moment, auto-populated per the ≥14-point blowout rule,
fed through the site's `projectOrder` movement model with zero manual picks on top.

**Purpose:** a baseline to compare against once CFBD actually publishes the real Week 2 AP/Coaches
poll — fill in the "Actual Wk2 rank" / "Actual move" columns then, and see whether the blowout/W/L
categorization + opponent-quality-scaled movement model over- or under-estimated real committee/voter
movement. This is a repeatable pattern — save a new dated file here each week worth tracking.

**Model in one line (from `Pickem.jsx`/`projectTop25.js`):** movement scales with opponent quality
(poll rank, else SP+ rank) and the called margin (blowoutWin/win/loss/blowoutLoss); a blowout is any
game decided by 14+ points either direction; beating a fellow ranked team always vaults you above them.

**Status at capture time:** 24 of 25 ranked teams' games were final; SMU @ Florida State (Mon night)
was still in progress/not yet kicked off — see its row below.

| Preseason rank | Team | Result | Score (mine–theirs) | Margin | Category | Projected rank | Projected move | Actual Wk2 rank | Actual move | Model right? |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Ohio State | W | 56–3 | 53 | Blowout W | 1 | – | | | |
| 2 | Oregon | W | 34–27 | 7 | W | 2 | – | | | |
| 3 | Georgia | W | 63–3 | 60 | Blowout W | 3 | – | | | |
| 4 | Notre Dame | W | 41–13 | 28 | Blowout W | 4 | – | | | |
| 5 | Texas | W | 59–7 | 52 | Blowout W | 5 | – | | | |
| 6 | Indiana | W | 52–16 | 36 | Blowout W | 6 | – | | | |
| 7 | Miami | W | 45–6 | 39 | Blowout W | 7 | – | | | |
| 8 | Texas A&M | W | 50–0 | 50 | Blowout W | 9 | ▼1 | | | |
| 9 | Ole Miss | W | 41–38 | 3 | W | 8 | ▲1 | | | |
| 10 | Oklahoma | W | 51–0 | 51 | Blowout W | 11 | ▼1 | | | |
| 11 | LSU | W | 51–10 | 41 | Blowout W | 10 | ▲1 | | | |
| 12 | Texas Tech | W | 33–10 | 23 | Blowout W | 12 | – | | | |
| 13 | Alabama | W | 48–10 | 38 | Blowout W | 13 | – | | | |
| 14 | USC | W | 39–0 | 39 | Blowout W | 14 | – | | | |
| 15 | BYU | W | 63–7 | 56 | Blowout W | 15 | – | | | |
| 16 | Michigan | W | 13–12 | 1 | W | 16 | – | | | |
| 17 | Washington | W | 24–10 | 14 | Blowout W | 17 | – | | | |
| 18 | Penn State | W | 45–0 | 45 | Blowout W | 18 | – | | | |
| 19 | SMU | *pending* | — | — | *not final at capture* | 20 | ▼1 | | | |
| 20 | Tennessee | W | 56–9 | 47 | Blowout W | 19 | ▲1 | | | |
| 21 | Utah | W | 66–14 | 52 | Blowout W | 21 | – | | | |
| 22 | Iowa | W | 40–0 | 40 | Blowout W | 22 | – | | | |
| 23 | Houston | W | 33–20 | 13 | W | 23 | – | | | |
| 24 | Louisville | L | 38–41 | -3 | L | 25 | ▼1 | | | |
| 25 | Missouri | W | 54–14 | 40 | Blowout W | 24 | ▲1 | | | |

## Notes for later-me

- "Projected move" here is the model's output with **zero manual Pick'em input** — every entry above
  is auto-populated from the real final score, not a guess. So this table literally *is* "what the
  model thinks Week 2 should look like," ready to diff against the real poll.
- SMU's row needs a follow-up capture once Florida State's game actually finishes — its real result
  will change both its own projected rank and (via `H2H`, since Louisville-Ole Miss already resolved
  independently) nothing else's, since SMU/FSU isn't a ranked-vs-ranked game.
- Most results were emphatic (17 of 24 decided games were 14+-point blowouts), so the *interesting*
  test cases for "did the model get the AMOUNT of movement right" are the close ones: Michigan
  (13–12), Ole Miss (41–38), Houston (33–20), Oregon (34–27) — these are where a real committee/voter
  might move a team more or less than this model's margin-scaling assumes.
- To fill in "Actual Wk2 rank": once CFBD's Week 2 poll is live, either read it straight off `/top25`
  after the next data-pipeline run, or check the AP poll directly if you want it before the site
  rebuilds. "Actual move" = preseason rank − actual Wk2 rank (same sign convention as the site: positive = moved up).
