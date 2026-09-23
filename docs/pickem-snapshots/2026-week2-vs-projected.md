# Week 2 → Week 3 Pick'em snapshot

**Captured:** 2026-09-08, baseline only -- Week 2 games haven't been played yet (kickoffs run
Thu 9/10 through the weekend), so unlike the Week 1 snapshot this one starts empty. Come back once
Week 2 wraps up and fill in the Result/Score/Margin/Category/Projected columns from the live
`/pickem` page (same auto-populate mechanism as last time -- once a game goes final, its row switches
from chips to a static "Final -- ..." result automatically).

**Backfilled: 2026-09-22, reconstructed from git history, not captured live.** The live `/pickem`
snapshot tool (`scripts/snapshot-pickem.mjs`) didn't exist yet when Week 2 actually happened, so this
round was never captured or resolved at the time -- it sat empty. This fill-in applies **today's**
model code (`src/utils/projectTop25.js` / `src/utils/pickemModel.js` as of 2026-09-22) to Week 2's
historical inputs: `git show 44bcb4b:data/current.json` (Week 2's final scores, spreads, SP+/FPI/Elo
inputs, `currentWeek: 2`) fed through `scripts/lib/pickem-snapshot.mjs`'s `buildSnapshot` (all Week 2
ranked games were already final by the time of that commit, so no ESPN live-score overlay was needed),
then reviewed against the real Week 3 AP poll (`git show 11ca00b:data/rankings/2026-wk03.json`, or
equivalently today's `data/rankings/2026-wk03.json`) with `scripts/lib/pickem-review.mjs`. This is
**not** what the live site actually showed in September -- it's what the current model *would have*
said, applied retroactively. The throwaway script used for this was not committed.

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

| Wk2 rank | Team | This week's opponent | Result | Score (mine–theirs) | Margin | Category | Projected rank | Projected move | Actual Wk3 rank | Actual move | Model right? (root-mover corrected) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Ohio State | at #4 Texas | L | 23–24 | -1 | L | 4 | ▼3 | 6 | ▼5 | ✓ root mover -- direction right, magnitude underestimated |
| 2 | Georgia | vs Western Kentucky | W | 70–20 | +50 | Blowout W | 2 | – | 2 | – | — passive |
| 3 | Notre Dame | vs Rice | W | 52–0 | +52 | Blowout W | 3 | – | 3 | – | — passive |
| 4 | Texas | vs #1 Ohio State | W | 24–23 | +1 | W | 1 | ▲3 | 1 | ▲3 | ✓✓ root mover -- exact match |
| 5 | Indiana | vs Howard | W | 55–0 | +55 | Blowout W | 5 | – | 4 | ▲1 | — passive |
| 6 | Oregon | at Oklahoma State | L | 31–39 | -8 | L | 11 | ▼5 | 21 | ▼15 | ~ root mover -- direction right, magnitude badly underestimated (biggest miss of the week) |
| 7 | Miami | vs Florida A&M | W | 77–7 | +70 | Blowout W | 6 | ▲1 | 5 | ▲2 | — passive |
| 8 | LSU | vs Louisiana Tech | W | 45–14 | +31 | Blowout W | 7 | ▲1 | 7 | – | — passive |
| 9 | Ole Miss | vs Charlotte | W | 41–9 | +32 | Blowout W | 9 | – | 8 | ▲1 | — passive |
| 10 | Texas A&M | vs Arizona State | W | 48–20 | +28 | Blowout W | 8 | ▲2 | 9 | ▲1 | — passive |
| 11 | Oklahoma | at Michigan | L | 10–17 | -7 | L | 15 | ▼4 | 24 | ▼13 | ~ root mover -- direction right, magnitude badly underestimated |
| 12 | Alabama | at Kentucky | W | 45–17 | +28 | Blowout W | 10 | ▲2 | 10 | ▲2 | — passive |
| 13 | Texas Tech | at Oregon State | W | 35–24 | +11 | W | 12 | ▲1 | 13 | – | — passive (own rank unchanged; carried past by USC's real rise, not its own game) |
| 14 | USC | vs Louisiana | W | 49–30 | +19 | Blowout W | 14 | – | 12 | ▲2 | ✗ root mover -- model called flat, USC got real credit it didn't predict |
| 15 | BYU | vs Arizona | W | 28–17 | +11 | W | 13 | ▲2 | 11 | ▲4 | — passive |
| 16 | Penn State | at Temple | W | 27–9 | +18 | Blowout W | 16 | – | 14 | ▲2 | — passive |
| 17 | SMU | vs UC Davis | W | 56–10 | +46 | Blowout W | 17 | – | 16 | ▲1 | ✗ root mover -- model called flat, small real move it didn't predict |
| 18 | Tennessee | at Georgia Tech | W | 45–24 | +21 | Blowout W | 18 | – | 15 | ▲3 | ✗ root mover -- model called flat, real voters gave real credit |
| 19 | Washington | vs Utah State | W | 16–14 | +2 | W | 19 | – | **out of Top 25** | N/A | ✗✗ structural miss -- won, but model can't drop below #25 |
| 20 | Utah | vs Arkansas | W | 43–10 | +33 | Blowout W | 20 | – | 17 | ▲3 | — passive |
| 21 | Iowa | vs Iowa State | W | 16–13 | +3 | W | 21 | – | 18 | ▲3 | — passive |
| 22 | Houston | vs Southern | W | 77–6 | +71 | Blowout W | 23 | ▼1 | 22 | – | — passive (own rank unchanged; carried down by Missouri's real rise, not its own game) |
| 23 | Missouri | at Kansas | W | 38–21 | +17 | Blowout W | 22 | ▲1 | 20 | ▲3 | ✓ root mover -- direction right, magnitude underestimated |
| 24 | Louisville | vs Villanova | W | 59–13 | +46 | Blowout W | 24 | – | 23 | ▲1 | — passive |
| 25 | Virginia | vs Norfolk State | W | 59–3 | +56 | Blowout W | 25 | – | 25 | – | — passive |
| entrant | Michigan | at Oklahoma (road upset) | W | 17–10 | +7 | W | n/a | n/a | 19 | n/a | n/a -- unranked, model can't add a team (the same Michigan that fell out of the poll in Week 1) |

## Findings (root-mover corrected)

**Root movers:** Ohio State, Texas, Oregon, Oklahoma, USC, SMU, Tennessee, Missouri (8 of 24 teams
in both polls). Everyone else's real move that week is fully explained by Oklahoma's 11-spot real
collapse and Washington's exit rippling through the middle and bottom of the board -- the same
zero-sum mechanic the Week 1 doc documents for Oregon/Michigan. (Judgment calls, same rule as Week 3:
the team whose own absolute rank didn't move is scored passive even if the raw LIS algorithm flagged
it -- Texas Tech (13→13) and Houston (22→22) both got passed by a real mover, so they're passive here
even though their neighbors moved.)

**Mean absolute rank error, root movers only: 3.36 (model) vs. 5.79 (leave-the-poll-unchanged
baseline).** The model beat the baseline, but the gap is proportionally smaller than Week 3's
(3.0 vs. 6.0) -- three of the eight root movers (USC, SMU, Tennessee) are cases where the model
predicted *zero* movement and the real poll gave real credit anyway, which ties the model's error to
the baseline's error on exactly those three rows (a flat call literally equals the no-change
baseline).

*(Corrected 2026-09-23: "3.36 vs. 5.79" is the **combined Weeks 2+3** figure -- 47/14 and 81/14
over the 14 root movers of both weeks, which is how the Week 3 doc uses it. For Week 2 alone, the
8 root movers listed above give **3.625 vs. 5.625**, the source of the Week 3 doc's "3.625". The
mechanical root-mover method in `scripts/lib/pickem-backtest.mjs` also counts BYU (15 -> 11) as a
root mover and gets 3.44 vs. 5.44 over 9 teams. The conclusion holds: the model beat the baseline,
by proportionally less than in Week 3.)*

**Same two failure modes as Week 1, confirmed:**
- *Decisive win, still loses ground to peers the model didn't see:* USC, SMU, and Tennessee were all
  modeled flat (their own win didn't change their inputs enough to move them) but each gained 1-4 real
  spots. This is Washington's Week 1 shape again -- a good-not-flagged win that voters rewarded and the
  model had no mechanism to predict, because the model only reacts to a team's *own* opponent-quality
  and margin, not to how it stacks up against peers with similar results.
- *Falls out of the poll entirely:* Washington won (16-14) but as a 28.5-point favorite -- missed the
  line by 26.5, the single worst betting-line miss of the week -- and voters dropped it outright for
  Michigan. The model, as always, just held it flat.

**The Oklahoma/Michigan storyline the Week 2 baseline flagged in advance played out exactly as
hoped as a natural experiment:** the baseline notes below asked whether "a Michigan upset here would
be a good live test of whether Michigan's real freefall was a one-week overreaction or the start of a
real slide." Michigan won at Oklahoma (17-10) and re-entered the Top 25 at #19 one week after falling
out entirely in Week 1 -- so Week 1's Michigan miss really was a one-week overreaction on the voters'
part, not the start of a slide, and the same win doubled as Oklahoma's root-mover collapse (11→24,
the week's second-largest miss after Oregon).

## Betting-line lens

Favorites went 22-24 among ranked-team games with a line (Oregon and Oklahoma the only ranked
favorites to lose); 14 of 25 covered; mean surprise +0.9 (a slightly chalk-friendly week, opposite of
Week 3). Correlation with the real poll's move: beating the line 0.55, raw margin 0.4 (n=24, raw,
matching Week 3's pattern of the line correlating better than plain margin). Real poll moved
**0.197 rank spots per point of surprise**; the model's projected move only **0.066** -- again about a
third as sensitive to the line as the real poll.

On root movers specifically: Oregon's -31.5 surprise (missing its line by the most of any ranked team
that week) matches its -15 real move, the biggest miss of the week by far; Oklahoma's -12.5 surprise
lines up with its -13 real move. USC (-11.5), SMU (+13.5), and Tennessee (+8.5) -- the three "model
said flat, real gave credit" misses above -- do *not* line up cleanly with the line: SMU and
Tennessee beat their numbers and rose (1 and 3 spots), but USC *missed* its number by 11.5 (won 49-30
as a 30.5-point favorite) and still rose 2. The line explains two of those three, not all three.

*(Corrected 2026-09-23: an earlier version of this paragraph said all three "had double-digit
surprises in the direction of their real move." USC's surprise was opposite to its move, and
Tennessee's +8.5 isn't double-digit. Checked against `git show 44bcb4b:data/current.json`.)*

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
