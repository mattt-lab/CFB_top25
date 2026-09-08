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

**Resolved:** 2026-09-08, against the real Week 2 AP poll — see Findings below.

| Preseason rank | Team | Result | Score (mine–theirs) | Margin | Category | Projected rank | Projected move | Actual Wk2 rank | Actual move | Model right? |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Ohio State | W | 56–3 | 53 | Blowout W | 1 | – | 1 | +0 | ✓ exact |
| 2 | Oregon | W | 34–27 | 7 | W | 2 | – | 6 | -4 | ✗ big miss |
| 3 | Georgia | W | 63–3 | 60 | Blowout W | 3 | – | 2 | +1 | close (err 1) |
| 4 | Notre Dame | W | 41–13 | 28 | Blowout W | 4 | – | 3 | +1 | close (err 1) |
| 5 | Texas | W | 59–7 | 52 | Blowout W | 5 | – | 4 | +1 | close (err 1) |
| 6 | Indiana | W | 52–16 | 36 | Blowout W | 6 | – | 5 | +1 | close (err 1) |
| 7 | Miami | W | 45–6 | 39 | Blowout W | 7 | – | 7 | +0 | ✓ exact |
| 8 | Texas A&M | W | 50–0 | 50 | Blowout W | 9 | ▼1 | 10 | -2 | ~ right direction |
| 9 | Ole Miss | W | 41–38 | 3 | W | 8 | ▲1 | 9 | +0 | ✗ predicted up, held flat |
| 10 | Oklahoma | W | 51–0 | 51 | Blowout W | 11 | ▼1 | 11 | -1 | ✓ exact |
| 11 | LSU | W | 51–10 | 41 | Blowout W | 10 | ▲1 | 8 | +3 | ~ right direction, underestimated |
| 12 | Texas Tech | W | 33–10 | 23 | Blowout W | 12 | – | 13 | -1 | close (err 1) |
| 13 | Alabama | W | 48–10 | 38 | Blowout W | 13 | – | 12 | +1 | close (err 1) |
| 14 | USC | W | 39–0 | 39 | Blowout W | 14 | – | 14 | +0 | ✓ exact |
| 15 | BYU | W | 63–7 | 56 | Blowout W | 15 | – | 15 | +0 | ✓ exact |
| 16 | Michigan | W | 13–12 | 1 | W | 16 | – | **OUT of Top 25** | N/A | ✗✗ total miss -- model can't predict falling out |
| 17 | Washington | W | 24–10 | 14 | Blowout W | 17 | – | 19 | -2 | ✗ blowout still dropped 2 |
| 18 | Penn State | W | 45–0 | 45 | Blowout W | 18 | – | 16 | +2 | ✗ (err 2) |
| 19 | SMU | W | 27–24 | 3 | W | 20 | ▼1 (no real pick live) | 17 | +2 | N/A -- game was still pending at capture |
| 20 | Tennessee | W | 56–9 | 47 | Blowout W | 19 | ▲1 | 18 | +2 | ~ right direction, underestimated |
| 21 | Utah | W | 66–14 | 52 | Blowout W | 21 | – | 20 | +1 | close (err 1) |
| 22 | Iowa | W | 40–0 | 40 | Blowout W | 22 | – | 21 | +1 | close (err 1) |
| 23 | Houston | W | 33–20 | 13 | W | 23 | – | 22 | +1 | close (err 1) |
| 24 | Louisville | L | 38–41 | -3 | L | 25 | ▼1 | 24 | +0 | ✗ predicted down after loss, held flat |
| 25 | Missouri | W | 54–14 | 40 | Blowout W | 24 | ▲1 | 23 | +2 | ~ right direction, underestimated |

*(Virginia entered the real Week 2 poll at #25, unranked preseason -- no model prediction was possible for a team that wasn't already tracked.)*

## Findings

**Magnitude: decent. Direction: weak.** Mean absolute error was **~1.04 rank spots** across the 23
gradeable teams (excludes Michigan and SMU, see below) -- tight for a simplified model against a real
committee/voter poll. But **direction was only right 5/19 times** when either side actually moved
(26%) -- most blowout wins were modeled as "no change," while in reality almost every team shuffled
1-2 spots regardless of their own game, because AP voters re-sort the *whole field* relative to each
other, not each team in isolation.

**The model's real blind spot isn't the blowout threshold -- it's that it scores each team mostly on
its own game + opponent quality, with no visibility into how the rest of the field's results ripple
across the board.** LSU (+3 real vs. +1 projected) and Oregon (-4 real vs. 0 projected) are the
clearest examples: both results were driven more by what OTHER teams did than by LSU's or Oregon's
own game.

**Michigan is the standout total miss and a structural limitation, not a calibration one.** Won by 1
(plain "W," not blowout), model said no change -- they fell **completely out of the Top 25**. The
model only ever reorders *within* the tracked 25; it has no mechanism to demote a team off the board
entirely, no matter how unconvincing the win.

**Washington's case argues the blowout threshold itself is too blunt.** A 14-point win (exactly at
the blowout line) still cost them 2 spots -- who you blow out clearly matters more than by how much,
and margin-vs-a-weak-opponent isn't a reliable stand-in for resume value.

**Resolved (2026-09-08):** filled in against the real Week 2 AP poll — see the Findings section
above. SMU's real result (W 27-24) and actual movement are in the table now too, though it's marked
N/A for grading since no pick was actually live for it at capture time (its projected row above was
just the passive effect of other teams' movements, not a real prediction about SMU's own game).

## Notes for later-me

- "Projected move" here is the model's output with **zero manual Pick'em input** — every entry above
  is auto-populated from the real final score, not a guess. So this table literally *is* "what the
  model thinks Week 2 should look like," ready to diff against the real poll.
- Most results were emphatic (17 of 24 decided games were 14+-point blowouts), so the *interesting*
  test cases for "did the model get the AMOUNT of movement right" are the close ones: Michigan
  (13–12), Ole Miss (41–38), Houston (33–20), Oregon (34–27) — these are where a real committee/voter
  might move a team more or less than this model's margin-scaling assumes.
- To fill in "Actual Wk2 rank": once CFBD's Week 2 poll is live, either read it straight off `/top25`
  after the next data-pipeline run, or check the AP poll directly if you want it before the site
  rebuilds. "Actual move" = preseason rank − actual Wk2 rank (same sign convention as the site: positive = moved up).
