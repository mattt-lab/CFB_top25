# Week 2 → Week 3 Pick'em snapshot

**Captured:** 2026-09-08, baseline only -- Week 2 games haven't been played yet (kickoffs run
Thu 9/10 through the weekend), so unlike the Week 1 snapshot this one starts empty. Come back once
Week 2 wraps up and fill in the Result/Score/Margin/Category/Projected columns from the live
`/pickem` page (same auto-populate mechanism as last time -- once a game goes final, its row switches
from chips to a static "Final -- ..." result automatically).

**Purpose:** same as the Week 1 file -- compare the model's projected movement against the real
Week 3 AP/Coaches poll once it lands, so we can track whether this early-season volatility (a lot of
uncertainty, big swings) keeps up or settles down. This is round 2 of a repeatable pattern.

**Model in one line:** movement scales with opponent quality (poll rank, else SP+ rank) and the
called margin (blowoutWin/win/loss/blowoutLoss); a blowout is any game decided by 14+ points either
direction; beating a fellow ranked team always vaults you above them.

**Methodology correction carried over from the Week 1 file (read this before grading):** a fixed
25-slot ranking is zero-sum -- when one team falls, everyone below it passively rises a slot whether
or not they did anything themselves. Don't grade each team's raw rank delta in isolation. Once the
real Week 3 poll is in, trace the full before/after order (not just each team's own row) and separate
**root movers** (teams whose order relative to their neighbors actually changed) from **pure passive
risers/fallers** (order relative to everyone around them is unchanged, they just got carried by a
root mover elsewhere in the board). Only root movers are a fair test of the model -- see the Week 1
file's "Correction" section for a full worked example (Oregon's real -4 explained four other teams'
"+1" rows that had nothing to do with their own games).

**When to expect Week 3's poll:** normally Sunday afternoon (~2pm ET) -- Week 1's Tuesday release was
specifically because that week's slate ran into Monday night (SMU/Florida State); Week 2's slate
doesn't have that same extension, so the normal Sunday cadence should resume for Week 3, landing
around 2026-09-14. Confirm rather than assume when the time comes.

## Baseline: Week 2 ranks and this week's matchups

| Wk2 rank | Team | This week's opponent | Result | Score (mine–theirs) | Margin | Category | Projected rank | Projected move | Actual Wk3 rank | Actual move | Model right? |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Ohio State | at #4 Texas | | | | | | | | | |
| 2 | Georgia | vs Western Kentucky | | | | | | | | | |
| 3 | Notre Dame | vs Rice | | | | | | | | | |
| 4 | Texas | vs #1 Ohio State | | | | | | | | | |
| 5 | Indiana | vs Howard | | | | | | | | | |
| 6 | Oregon | at Oklahoma State | | | | | | | | | |
| 7 | Miami | vs Florida A&M | | | | | | | | | |
| 8 | LSU | vs Louisiana Tech | | | | | | | | | |
| 9 | Ole Miss | vs Charlotte | | | | | | | | | |
| 10 | Texas A&M | vs Arizona State | | | | | | | | | |
| 11 | Oklahoma | at Michigan | | | | | | | | | |
| 12 | Alabama | at Kentucky | | | | | | | | | |
| 13 | Texas Tech | at Oregon State | | | | | | | | | |
| 14 | USC | vs Louisiana | | | | | | | | | |
| 15 | BYU | vs Arizona | | | | | | | | | |
| 16 | Penn State | at Temple | | | | | | | | | |
| 17 | SMU | vs UC Davis | | | | | | | | | |
| 18 | Tennessee | at Georgia Tech | | | | | | | | | |
| 19 | Washington | vs Utah State | | | | | | | | | |
| 20 | Utah | vs Arkansas | | | | | | | | | |
| 21 | Iowa | vs Iowa State | | | | | | | | | |
| 22 | Houston | vs Southern | | | | | | | | | |
| 23 | Missouri | at Kansas | | | | | | | | | |
| 24 | Louisville | vs Villanova | | | | | | | | | |
| 25 | Virginia | vs Norfolk State | | | | | | | | | |

## Notes for later-me

- **The marquee game to watch: Ohio State (#1) at Texas (#4), a ranked-vs-ranked head-to-head.**
  This is the one matchup this week where the model's `H2H` hard constraint (winner always ranked
  above loser) actually kicks in -- last week had no ranked-vs-ranked games among the current Top 25
  pairings until Louisville/Ole Miss resolved mid-week, so this is a cleaner test of that part of the
  model specifically.
- Once games are final, capture the live `/pickem` page's projected order the same way as last time
  (zero manual picks, pure auto-populate) so "Projected move" reflects only real results, not guesses.
- Oklahoma at Michigan is notable context, not a ranked-vs-ranked game (Michigan fell out of the
  poll last week) -- but a Michigan upset here would be a good live test of whether Michigan's real
  freefall was a one-week overreaction or the start of a real slide.
- When grading, apply the root-mover/passive-ripple split from the start this time (see Methodology
  correction above) rather than doing it as an afterthought -- trace the full before/after order,
  not just each team's own delta.
