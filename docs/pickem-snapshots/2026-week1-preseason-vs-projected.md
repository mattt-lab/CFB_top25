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

| Preseason rank | Team | Result | Score (mine–theirs) | Margin | Category | Projected rank | Projected move | Actual Wk2 rank | Actual move | Model right? (ripple-corrected) |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Ohio State | W | 56–3 | 53 | Blowout W | 1 | – | 1 | +0 | ✓ exact |
| 2 | Oregon | W | 34–27 | 7 | W | 2 | – | 6 | -4 | ✗ real miss -- root mover, model saw no reason to fall |
| 3 | Georgia | W | 63–3 | 60 | Blowout W | 3 | – | 2 | +1 | — ripple only (Oregon's fall), not a real test |
| 4 | Notre Dame | W | 41–13 | 28 | Blowout W | 4 | – | 3 | +1 | — ripple only (Oregon's fall), not a real test |
| 5 | Texas | W | 59–7 | 52 | Blowout W | 5 | – | 4 | +1 | — ripple only (Oregon's fall), not a real test |
| 6 | Indiana | W | 52–16 | 36 | Blowout W | 6 | – | 5 | +1 | — ripple only (Oregon's fall), not a real test |
| 7 | Miami | W | 45–6 | 39 | Blowout W | 7 | – | 7 | +0 | ✓ exact |
| 8 | Texas A&M | W | 50–0 | 50 | Blowout W | 9 | ▼1 | 10 | -2 | ✓ real swap vs. Ole Miss called correctly; extra -1 was LSU ripple |
| 9 | Ole Miss | W | 41–38 | 3 | W | 8 | ▲1 | 9 | +0 | ✓ real swap vs. Texas A&M called correctly; masked by LSU ripple |
| 10 | Oklahoma | W | 51–0 | 51 | Blowout W | 11 | ▼1 | 11 | -1 | — ripple only (LSU's jump), not a real test |
| 11 | LSU | W | 51–10 | 41 | Blowout W | 10 | ▲1 | 8 | +3 | ~ right direction, underestimated real magnitude |
| 12 | Texas Tech | W | 33–10 | 23 | Blowout W | 12 | – | 13 | -1 | ✗ missed real swap vs. Alabama |
| 13 | Alabama | W | 48–10 | 38 | Blowout W | 13 | – | 12 | +1 | ✗ missed real swap vs. Texas Tech |
| 14 | USC | W | 39–0 | 39 | Blowout W | 14 | – | 14 | +0 | ✓ exact |
| 15 | BYU | W | 63–7 | 56 | Blowout W | 15 | – | 15 | +0 | ✓ exact |
| 16 | Michigan | W | 13–12 | 1 | W | 16 | – | **OUT of Top 25** | N/A | ✗✗ structural miss -- model can't demote below #25 |
| 17 | Washington | W | 24–10 | 14 | Blowout W | 17 | – | 19 | -2 (-3 real, +1 Michigan ripple) | ✗ real miss -- root mover, blowout still lost real ground |
| 18 | Penn State | W | 45–0 | 45 | Blowout W | 18 | – | 16 | +2 (+1 real vs. Washington, +1 ripple) | ✗ missed the real pass of Washington |
| 19 | SMU | W | 27–24 | 3 | W | 20 | ▼1 (no real pick live) | 17 | +2 | N/A -- game was still pending at capture |
| 20 | Tennessee | W | 56–9 | 47 | Blowout W | 19 | ▲1 | 18 | +2 (+1 real vs. Washington, +1 ripple) | ✓ real component matches predicted +1 |
| 21 | Utah | W | 66–14 | 52 | Blowout W | 21 | – | 20 | +1 | — ripple only (Michigan's exit), not a real test |
| 22 | Iowa | W | 40–0 | 40 | Blowout W | 22 | – | 21 | +1 | — ripple only (Michigan's exit), not a real test |
| 23 | Houston | W | 33–20 | 13 | W | 23 | – | 22 | +1 | — ripple only (Michigan's exit), not a real test |
| 24 | Louisville | L | 38–41 | -3 | L | 25 | ▼1 | 24 | +0 (-1 real vs. Missouri, +1 Michigan ripple) | ✓ real component matches predicted -1 |
| 25 | Missouri | W | 54–14 | 40 | Blowout W | 24 | ▲1 | 23 | +2 (+1 real vs. Louisville, +1 ripple) | ✓ real component matches predicted +1 |

*(Virginia entered the real Week 2 poll at #25, unranked preseason -- no model prediction was possible for a team that wasn't already tracked.)*

## Findings (ripple-corrected -- see the Correction section below for the full trace)

**Magnitude: decent. Direction, on the moves the model could actually be tested on: a coin flip.**
Mean absolute error was **~1.04 rank spots** across the 23 gradeable teams -- tight for a simplified
model against a real committee/voter poll. The table's "Model right?" column now separates real
moves from passive ripple (8 of the original 23 rows -- Georgia/Notre Dame/Texas/Indiana/Oklahoma/
Utah/Iowa/Houston -- turned out to be pure ripple with nothing to grade). Of the **12 teams with an
actual real movement to test**, the model called the right direction on **6/12 (50%)**: right on Ole
Miss, Texas A&M, Tennessee, Louisville, Missouri, and LSU's direction (though it underestimated LSU's
magnitude); wrong on Oregon, Michigan, Washington, Penn State, Texas Tech, and Alabama.

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
the blowout line) still cost them 3 *real* spots (beyond the Michigan-vacancy ripple) -- who you blow
out clearly matters more than by how much, and margin-vs-a-weak-opponent isn't a reliable stand-in
for resume value. (See "Did I actually check the formula" below -- this isn't a simple threshold bug.)

## Correction: passive ripple vs. real movement

The per-team grading above has a real flaw, caught after the fact: **a fixed 25-slot ranking is a
zero-sum system.** When one team falls, everyone below it slides up a slot whether or not THEY did
anything -- that rise isn't evidence the model correctly (or incorrectly) predicted *their* game, it's
just the mechanical consequence of the team above them falling. Grading every team's raw absolute-rank
delta independently, like the table above does, smears one team's real miss across several other
teams' rows as if it were their own error too.

Tracing the actual before/after order position-by-position (not just each team's own delta) separates
this cleanly:

- **Oregon fell 4 real spots** (2 -> 6) on its own. Georgia, Notre Dame, Texas, and Indiana then each
  rose exactly 1 -- but checking their order *relative to each other*, it's byte-identical
  before and after. None of them gained anything real; they were purely carried up by Oregon's fall.
  So 4 of the 8 "close (err 1)" rows above aren't really 4 separate small model misses -- they're one
  miss (Oregon) counted five times.
- **Michigan fell out of the Top 25 entirely**, vacating a slot. Utah, Iowa, and Houston's "+1"s are
  100% that vacancy -- checking the relative order in that whole block, those three didn't pass anyone
  or get passed by anyone. Oklahoma's "-1" (in the earlier table, graded "exact match") turns out to
  be the same story but for LSU's jump, not Oklahoma's own game -- LSU passing Oklahoma explains all of
  it, with nothing left over.
- **Washington's drop is only partly ripple.** Stripping out the pure Michigan-vacancy effect,
  Washington still fell 3 *real* spots -- Penn State, SMU, and Tennessee each specifically passed
  Washington, independent of the Michigan vacancy they also benefited from. That's a genuine model
  miss (blowout win, predicted flat, actually lost real ground to peers), not ripple noise.
- **A handful of small moves were real, targeted swaps the model actually called correctly in
  direction:** Ole Miss passed Texas A&M (model predicted exactly Ole Miss +1 / Texas A&M -1), Missouri
  passed Louisville (model predicted exactly Missouri +1 / Louisville -1). Louisville's raw "+0" in the
  table above reads as a miss, but it's actually a real -1 (lost to Missouri, as the model expected)
  masked by a +1 gift from the Michigan vacancy landing at the same time -- the model's underlying call
  was right, the zero-sum bookkeeping just hid it.
- **Alabama passing Texas Tech** was a real swap the model did NOT call (both were modeled flat).

**Revised picture:** the model's genuine failures are concentrated in about **three teams it had no
way to see coming** -- Oregon (-4), Michigan (fell out entirely), and Washington (-3 real) -- plus two
smaller missed swaps (Texas Tech/Alabama). Once ripple is stripped out, several of the moves that
looked like model misses (Georgia/Notre Dame/Texas/Indiana/Oklahoma/Utah/Iowa/Houston, 8 rows) are
revealed as the model correctly having nothing to say about those teams -- the "error" belonged to
Oregon and Michigan's rows all along. And on the real, non-ripple swaps it *was* positioned to call
(Ole Miss/Texas A&M, Missouri/Louisville), it got the direction right both times.

**Methodology note for next time:** don't grade a team's raw absolute-rank delta in isolation. First
identify which teams are "root movers" (their relative order changed against teams they weren't
already ahead/behind of) versus which are pure passive risers/fallers (their relative order to
everyone around them is unchanged) -- only the root movers are a fair test of the model.

**Resolved (2026-09-08):** filled in against the real Week 2 AP poll — see the Findings section
above. SMU's real result (W 27-24) and actual movement are in the table now too, though it's marked
N/A for grading since no pick was actually live for it at capture time (its projected row above was
just the passive effect of other teams' movements, not a real prediction about SMU's own game).

## Did I actually check the formula, or is this just guessing? (2026-09-09)

Before recommending any change, read `src/utils/projectTop25.js` line by line rather than assuming
what it does. Two things worth knowing before touching it:

**The blowout multiplier is already opponent-quality-scaled, not a flat bonus.** For a win,
`drift = (0.5 + q*2.5) * (1.5 if blowout)`, where `q` is 0..1 opponent quality. At `q=0` (a true
cupcake), the blowout multiplier only adds +0.25 to the drift (0.5 -> 0.75); at `q=1` (an elite
opponent), it adds +1.5 (3.0 -> 4.5). So "blowing out a bad team" was never going to swing the model
much on its own -- the formula already discounts exactly the case Washington's row looks like it's
complaining about. This isn't a one-line threshold bug.

**Tracing Oregon vs. Georgia specifically, the model's own math was internally consistent -- it was
just wrong about which factor mattered more.** Oregon (beat a real, non-cupcake Boise State team,
`q`~0.25, non-blowout) computed a *higher* drift than Georgia (blew out an FCS team, `q`~0,
blowout-multiplied) under this formula -- so the model correctly, deliberately kept Oregon ranked
above Georgia. The real poll did the opposite. That's not an arithmetic error to patch; it's the
model's opponent-quality-vs-margin tradeoff genuinely disagreeing with how voters weighed it this
particular week.

**Recommendation: wait for Week 2, don't tune yet.** With n=1 week of evidence, I can't tell whether
"voters weight opponent quality more than this formula assumes" is a real, persistent bias worth
correcting, or just this week's idiosyncrasy (SP+ ratings are also at their noisiest early in the
season, before results have accumulated -- a bad `q` input this early doesn't necessarily mean the
*formula* is wrong). Same logic applies even more strongly to the Michigan structural gap (the model
can't ever demote a team below #25) -- one occurrence isn't enough to justify the real work of adding
unranked-team candidates into the model. If the SAME failure modes repeat in Week 2 -- a blowout
against a fine-but-not-great opponent still losing ground, or another team falling out entirely --
that's the signal to actually change something, and by then there'll be a specific, evidenced
parameter to point at instead of a guess.

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
