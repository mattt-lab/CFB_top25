# Pick 'em model tuning: experiments 1 and 2 (2026-09-23)

**Status: analysis only.** Nothing on the live site changed. The work lives on branch
`worktree-pickem-tuning`, and the model at `src/utils/projectTop25.js` is untouched.

**Question.** The weekly reviews (`docs/pickem-snapshots/`) kept showing the same misses. Can the
Pick 'em projection predict the next AP poll's order better by changing only a few settings,
without fitting noise?

**Where the numbers live.** Machine-written results are in `data/pickem-backtest/experiment-1.results.md`
and `experiment-2.results.md` (each with a `.json`). Reproduce them with
`node scripts/backtest-pickem.mjs` and `node scripts/holdout-pickem.mjs`. Both read only local files
and make no API calls.

## Bottom line (both experiments)

**Recommendation: `lossScale = 2.5`.** Every loss drops a team 2.5× as far as the model does today.
Nothing else changes: no betting line, no penalty, no week-dependent settings.

- **How it was chosen.**
  - Experiment 1 tuned on 2025 with rules committed in advance, and kept only a small
    unranked-loss penalty.
  - Exploring 2025 afterwards pointed at loss scaling. That was post-hoc, so not evidence.
  - Experiment 2 fixed every value from 2025, committed the rules, then fetched **2024**, a season
    nothing had been tuned on. Loss scaling beat both the current model and the penalty there, and
    passed every rule.
  - Adding the early-season win scale or the penalty on top made 2024 *worse*, so both were
    rejected.
- **How it performs** (average rank miss over teams in both polls; pairwise = weighted ordering
  errors):

  | Season | Role | Current model | Loss ×2.5 | Change |
  |---|---|---|---|---|
  | 2024 | untouched holdout | 1.43 spots (279.5 pairwise) | **1.12** (205.5) | −22% (−26% pairwise) |
  | 2026 Wks 1–3 | never used for fitting | 1.44 (41) | **1.14** (34.5) | −21% (−16%) |
  | 2025 | where values were fit | 1.50 (314.5) | 1.16 (218.5) | −23% (−31%) |

  Teams that genuinely moved (root movers): 2024 2.12 → 1.64, 2026 2.77 → 2.09.
- **What it fixes, and what it doesn't.**
  - Oregon Week 2 (real #21) projects to #18 instead of #11. Texas A&M Week 3 (real #23) projects
    to #18 instead of #14.
  - Losses still stop short of what voters do to losses near the bottom of the poll, where most
    losers simply drop out, which the model can't express.
  - Ugly-win exits (Michigan, Washington, Oklahoma this year) are untouched.
- **Watch-outs.** Loss scaling overshoots conference-championship losers: voters and the committee
  go easy on title-game losses. The CFP-ranking weeks are mixed evidence (see Experiment 2).

## Experiment 1 summary (2025 tuning; superseded by the bottom line)

- **One change passed every pre-registered rule: `unrankedLossPenalty = 4`.** A loss to a team
  outside the Top 25 costs 4 extra rank slots. The drift-scale and betting-line candidates both
  failed.
- **It helps, modestly:**

  | | No change | Current model (V1) | Penalty 4 |
  |---|---|---|---|
  | 2025, average rank miss (335 team-weeks) | 2.25 | 1.50 | **1.35** |
  | 2025, root-mover average miss (138) | 3.75 | 2.15 | **2.01** |
  | 2025, share of real reshuffle captured (weighted pairs) | 0% | 37.5% | **45.3%** |
  | 2026 Wks 1–3, average rank miss (71) | 2.10 | 1.44 | **1.21** |
  | 2026 Wks 1–3, root-mover average miss (22) | 4.55 | 2.77 | **2.18** |
  | 2026 Wks 1–3, share of real reshuffle captured | 0% | 35.9% | **44.5%** |

  The honest out-of-sample number is smaller than the in-sample 12%. Re-running the whole
  selection with each 2025 week held out cuts errors on the held-out weeks by **5%**. Holding out
  weeks for the penalty alone gives **10%**. Weeks 1–3 of 2026 played no part in any fitting and
  improve 13%.
- **The bigger finding is post-hoc, so not validated yet: the model under-punishes every loss by
  2–3×, not just losses to unranked teams.**
  - Doubling only the loss drift cuts 2025 errors 26% (average miss 1.50 → 1.18) and 2026 Weeks 1–3
    errors 15%.
  - Combined with the penalty, the 2026 Weeks 1–3 average miss drops to 0.96.
  - I found this by looking at 2025, so it needs one clean test before it ships (see
    Recommendations).
- **The betting line doesn't help order the poll once win/loss and opponent status are known.**
  The line term failed cross-validation in both rounds. Where the line *does* matter is **exits**:
  - Teams that fell out averaged −14.5 against the line; teams that stayed averaged +2.5.
  - Early in the season, voters sometimes drop a team after an ugly *win*.

## How it was tested, and why it's hard to fool

- **Pre-registered.**
  - The rules were committed before the 2025 data was fetched (`88f7303`); the data came after
    (`f240a05`).
  - They cover the metric, weights, candidate settings, grids and pass rules:
    `data/pickem-backtest/experiment-1.json`.
- **The baseline is the real model.** `scripts/lib/pickem-model-params.mjs` is a tunable copy of
  `projectTop25.js`. Tests pin it to production output on 2,000 random 25-team weeks and on all 18
  real weeks. The test fails if any constant moves even 0.1.
- **Metric: pairwise order.**
  - For every pair of teams in the old poll: did the projection keep them in the real next-poll
    order?
  - A team that fell out counts as tied just below #25. Entrants can't be scored.
  - This ignores the zero-sum ripple without hand-picking "root movers". It reproduces the Week 3
    doc's six root movers and its 3.0 vs 6.0 error exactly.
  - Transitions out of poll Weeks 1–2 count half, as you asked.
- **Tuning data: 2025.**
  - 15 AP transitions and 375 ranked team-weeks, from 3 CFBD calls (749 left this month).
  - Every ranked game was final, and 314 of 315 had a line.
  - Each week's results pass a built-in alignment check: losers must fall on average.
- **Check data: 2026 Weeks 1–3.**
  - Weeks 1 and 2 were rebuilt from git (`3502887`, `44bcb4b`); Week 3 is the live snapshot.
  - Rebuilding from git is sound. The Week 3 rebuild from the Sunday commit gives the same
    projection as the live Saturday-night snapshot, even though 36 FPI/Elo inputs had updated
    overnight.
- **Stand-ins for 2025.** CFBD can't give SP+ as of a given week. Opponent quality uses the
  opponent's pre-game Elo rank that week, and a team's own computer rank uses Elo alone.
- **Pass rules** (all required):
  - **R1:** leave-one-week-out gain over 2025 > 0, with the 5th bootstrap percentile > 0.
  - **R2:** values fitted on Weeks 3–8 and on Weeks 9+ agree.
  - **R3:** 2026 isn't made worse.
  - **R4:** the gain doesn't hinge on one team.
  - **R5:** shrink the value toward "no change" within one standard error.

## Every model tried

**Round 1** (on the current model):

| Setting | Weighted errors across the grid (V1 = 314.5) | Reported value | Held-out gain (5th pct) | Early / late fit | 2026 | Pass |
|---|---|---|---|---|---|---|
| `driftScale` | 1.25: 289, 1.5: 281, **2: 256**, 2.5: 305.5, 3: 358.5 | 2 | +58.5 (+21) ✓ | **2 / 1.25 ✗** | 41 → 35.5 ✓ | no |
| `unrankedLossPenalty` | 2: 295, 4: 275.5, 6: 271, **8: 270**, 10: 277, 12: 283 | 4 (1-SE from 8) | +31 (+6) ✓ | 8 / 4 ✓ | 41 → 35.5 ✓ | **yes** |
| `surpriseK` | .05: 297.5, **.1: 286.5**, .15: 287.5, .2: 310.5, .3: 402, .4: 485 | 0.1 | +11 (**−12**) ✗ | .15 / .1 ✓ | 41 → 38.5 ✓ | no |

**Round 2** (on penalty 4 = 275.5): `driftScale` held-out gain −8 ✗. `surpriseK` +8.5 with 5th
percentile −9 ✗, and its late-season fit was 0 ✗. Nothing else passed, so selection stopped.

The drift scale's failure is the interesting one. Fitted by part of the season, 2× is best for
Weeks 1–2 and 3–8 (169 → 120 in Weeks 3–8), but only 1.25× for Weeks 9–15 (110 → 106). **Scaling all
movement, early and mid-season voters move teams about twice as much as the model. Late in the
season the overall scale is about right,** though losses alone are still under-punished then:
scaling only losses by 2× takes Weeks 9–15 from 110 to 84. That fits your point that early polls
behave differently. In the data, "early" runs through about Week 8, not just Weeks 1–2.

## What 2025 voters actually did (descriptive, not used for decisions)

**Losses: the model's biggest miss.** Average real move vs projected (exit = fell to #26):

| Loss | n | Real | V1 | Penalty 4 |
|---|---|---|---|---|
| To ranked, loser #1–5 | 10 | −5.0 | −2.4 | −2.3 |
| To ranked, #6–10 | 8 | −7.6 | −2.9 | −2.8 |
| To ranked, #11–15 | 9 | −4.2 | −2.2 | −1.9 |
| To unranked, #6–10 | 7 | −11.7 | −5.0 | −8.4 |
| To unranked, #11–15 | 10 | −10.3 | −4.3 | −8.0 |

- Losses to ranked teams are under-punished about as badly as losses to unranked teams, and the
  penalty doesn't touch them. That's why the post-hoc loss scale beats it.
- How badly the loser missed the line barely matters:

  | Loss vs line | Real move | V1 |
  |---|---|---|
  | Within 7 | −6.05 | −2.6 |
  | Missed by 7–14 | −5.7 | −2.2 |
  | Missed by 14+ | −7.0 | −3.2 |

  Voters punish the loss itself.

**Wins vs the line.** Winners that beat the line rose about 2 spots (model +1 to +1.5). Winners who
missed it by 14+ fell 1.1 spots on average (model +0.2), for example Clemson #8 → 12 and Georgia
#4 → 6 in Week 2. The effect is real but small inside the poll.

**Exits: 40 in 15 transitions.**
- **Nearly all follow a loss:** 39 after a loss, 1 after a win (Week 1 Kansas State, won by 3 as a
  27.5-point favorite), 0 while idle.
- **A loss at #16–25 is almost always fatal:** 82% (32 of 39) fell out, 88% if they also missed
  the line by 7+.
- **They're a quarter of the error:** 23% of the model's weighted errors come from pairs involving
  a team that fell out. The model can't express "out", only #25.

**Week 1's failure modes, re-checked.**
- **"Blowout win still loses ground":** real but rare. 11 of 151 blowout wins (7%) were root movers
  that fell.
- **"Falls out entirely":** common (2.7 a week) and structural.

**How much the poll reshuffles.**
- **Weeks 1–8:** 35–59 real pair swaps a week, average move about 2.3–3.3 spots.
- **Weeks 11–15:** 14–27 swaps, about 1–2 spots.
- **Week 10** was an outlier (50).

## 2026 Weeks 1–3, team by team (penalty 4 vs current)

| Wk | Team | Result (vs line) | Was → Real | V1 | Penalty 4 |
|---|---|---|---|---|---|
| 2 | Oregon | L by 8 at unranked OK State (−31.5) | 6 → 21 | 11 | **15** |
| 2 | Oklahoma | L by 7 at unranked Michigan (−12.5) | 11 → 24 | 15 | **18** |
| 3 | Texas A&M | L by 10 to unranked Kentucky (−26.5) | 9 → 23 | 14 | **16** |
| 2 | BYU / USC / SMU / Tennessee | wins | 15/14/17/18 → 11/12/16/15 | 13/14/17/18 | 12/13/16/17 |
| 1 | Oregon | W by 7 (−17.5) | 2 → 6 | 2 | 2 |
| 1–3 | Michigan / Washington / Oklahoma | ugly wins | → out | held | held |
| 3 | Virginia | L to unranked WVU (−21.5) | 25 → out | 25 | 25 |

The penalty moves the unranked-loss cases the right way, but still only about half as far as
voters did. The early-season ugly-win exits remain untouched, since no candidate addressed them.

## Experiment 2: confirming on 2024

Spec: `data/pickem-backtest/experiment-2.json`.
- **Order of events:** the spec was committed in `4acdb0f`, before 2024 existed locally. The 2024
  data was fetched in `361ca48` (3 CFBD calls; 746 left).
- **Holdout data:** 15 AP transitions and 376 ranked team-weeks. All 309 ranked games were final
  and 306 had a line. It passed the same alignment check as 2025.
- **Fitting:** none in this experiment. Each model's values were fixed from 2025 beforehand, and
  2024 could only confirm or reject them in a fixed chain. A step's candidate replaces the current
  model only if all of these hold on 2024:
  - weighted errors fall;
  - the 5th percentile of a 10,000-draw bootstrap (resampling whole weeks) is above 0;
  - neither half of the season gets worse;
  - the gain survives removing any one team.

| Step | Current → candidate | 2024 weighted errors | Gain (5th pct) | Weeks 1–8 / 9+ | Result |
|---|---|---|---|---|---|
| 1 | V1 → penalty 4 | 279.5 → 234 | +45.5 (+25) | +19.5 / +26 | **adopted**: experiment 1's pick holds on a new season |
| 2 | penalty 4 → loss ×2.5 | 234 → 205.5 | +28.5 (+4.5) | +20.5 / +8 | **adopted** |
| 3 | loss ×2.5 → + early-season win ×1.25 | 205.5 → 211 | −5.5 (−13) | −5.5 / 0 | rejected |
| 4 | loss ×2.5 → + penalty 4 | 205.5 → 238.5 | −33 (−51) | −8 / −25 | rejected |

- **The 2026 guard passed:** loss ×2.5 makes 34.5 weighted errors on 2026 Weeks 1–3, against V1's
  41.
- **Week by week in 2024:** loss ×2.5 beat V1 in 12 of 15 weeks, tied in 2, and lost only the
  conference-championship transition (10 → 15).
- **The 2024 loss table looks like 2025's.** Real drops are about double V1's, and loss ×2.5 lands
  on them. For example, #6–10 teams that lost to ranked opponents fell 7.4 spots; V1 said 4.0 and
  loss ×2.5 says 7.0.
- **Penalty and loss scaling don't stack.** Once every loss is scaled, adding the penalty
  over-punishes losses to unranked teams. That's why step 4 failed.

**CFP-ranking weeks** (a safety check, not part of the decision; about 5 transitions per season).
From about Week 10 the site re-sorts the committee's rankings.

| Season | V1 | Penalty 4 | Loss ×2.5 |
|---|---|---|---|
| 2024 CFP, weighted errors / avg miss | 98 / 1.33 | 83 / 1.20 | **77 / 1.16** |
| 2025 CFP | **62 / 0.98** | 69 / 1.05 | 67 / 1.04 (root movers 1.45 → **1.26**) |

- **2024:** clearly better.
- **2025:** slightly worse on pairs, better on teams that really moved.
- **Both seasons:** the championship-week transition is where loss scaling hurts most. Too little
  evidence to act on, but worth checking in the weekly reviews once the CFP rankings take over.

## What this changes in the Week 1–3 conclusions

- **"Should the model use the betting line?"**
  - **For ordering within the poll: no.** It failed held-out validation twice on 2025.
  - The 2026 anecdotes that pointed at the line (Oregon, A&M, Oklahoma) are explained just as well
    by "losses are under-punished, especially to unranked teams". Those three were all losses to
    unranked teams.
  - **For exits: probably yes, but that needs an exit mechanism first.**
- **Superseded:** the hand regression in the Week 3 doc (`k ≈ 0.42` on 14 root movers). The
  properly validated line term picks up a far smaller effect (in-sample best k = 0.1) and fails
  the held-out rule.
- **The Week 2 doc's root-mover figures were mislabeled.** It reports "3.36 vs 5.79", which is the
  combined Weeks 2+3 figure. **Correction text to add to `docs/pickem-snapshots/2026-week2-vs-projected.md`
  on `main`** (couldn't be edited from this worktree session), right after that paragraph:

  > *(Corrected 2026-09-23: "3.36 vs. 5.79" is the **combined Weeks 2+3** figure -- 47/14 and
  > 81/14 over the 14 root movers of both weeks. The Week 3 doc uses it that way. For Week 2
  > alone, the 8 root movers listed above give **3.625 vs. 5.625**, which is where the Week 3 doc's
  > "3.625" comes from. The mechanical root-mover method in `scripts/lib/pickem-backtest.mjs` also
  > counts BYU (15 -> 11) as a root mover and gets 3.44 vs. 5.44 over 9 teams. Every conclusion
  > here still holds: the model beat the baseline, by proportionally less than in Week 3.)*

  Everything else in the Week 2 doc re-derived exactly from the rebuilt snapshot: favorites 22 of
  24, 14 of 25 covered, correlations 0.55 and 0.40, slopes 0.197 and 0.066.

## Recommendations (to discuss before anything ships)

1. **Ship `lossScale = 2.5`.**
   - **The change:** in `projectTop25.js`, multiply the loss magnitude by 2.5. That's the same as
     `lossBase` 3.125 and `lossWeakOppSlope` 8.125; the quality-win cushion and computer nudge stay
     as they are.
   - **The page:** there's no new input, so the footnote at `Pickem.jsx:170` stays accurate. Losses
     you pick by hand on the page move teams 2.5× further too, which matches how voters behave.
   - **Tests:** those that pin today's loss drift get updated deliberately. For example, a generic
     close loss becomes −11.25 instead of −4.5.
   - **After shipping:** bump the version. The weekly review then scores V1 as the challenger, and
     the rollback rule applies: revert if V1 beats the live model in 2 of the first 3 weeks.
2. **Don't add the betting line or the unranked-loss penalty.** The line failed on held-out data
   twice. The penalty stops helping once losses are scaled.
3. **Later, not now:**
   - **A drop-out mechanism.** "Ranked 16–25 and lost" predicted 82% of 2025 exits, and exits are
     about a quarter of the error.
   - **A gentler conference-championship week.** That's where loss scaling overshoots.
   - **Re-checking the CFP weeks** once the committee rankings take over.

## The weekly task: recommendation

**What's broken.** `cfb-pickem-week3-review` (Tuesdays about 3:04 PM PT) can no longer do its job.
- **It can't capture the week.** Step 2 snapshots `currentWeek`. By Tuesday the pipeline has
  already rolled forward to the next, unplayed week; Week 3 → 4 rolled on Monday at 11:36 AM PT. So
  step 2 fails every Tuesday. Step 3 then finds nothing new, and the task reports "nothing to do"
  forever. That's what happened today. The Week 3 snapshot exists only because it was taken by
  hand on Saturday night.
- **Its method is outdated.**
  - The hand-graded root-mover method is where the docs' errors crept in (USC's line, the
    mislabeled 3.36).
  - The "does the line help?" question it exists to answer is now settled: it doesn't, and losses
    matter instead.
  - The throwaway `k·surprise` regression in step 5 is superseded by the backtests.

**Recommendation: keep the Tuesday schedule, but capture from git and score with the scripts.**
1. **Capture.** Find the newest week N whose next poll is in `data/rankings/` but which has no
   record in either `data/pickem-snapshots/` or `data/pickem-backtest/`. Run
   `node scripts/reconstruct-pickem-week.mjs --week N`.
   - It uses git only, with no API calls. Rebuilding Week 3 this way gave exactly the live
     projection.
   - Exit code 2 means no commit has every ranked game final. Report that and skip the week.
2. **Score.** Run `node scripts/review-pickem.mjs --week N --write --params <challenger>`.
   - After loss scaling ships, the challenger is V1, and the pairwise section's live-vs-V1 row is
     the rollback signal.
   - If it doesn't ship, the challenger is loss ×2.5, running in shadow.
3. **Write up briefly.** Skip the full hand-graded doc. Write a short note with the review's
   numbers, a few sentences on what really moved and why, and a running table of live vs V1 per
   week. Flag the rollback trigger when it's met.
4. **Watch the CFP switch (about Week 10).** Snapshots then re-sort the committee's rankings, and
   the review compares them with the next CFP ranking automatically. Call out whether loss scaling
   is holding up there, especially in championship week.
5. **Keep the constraints:** no commits or pushes, no paid APIs, and never touch the frozen
   snapshots. Rebuilt weeks only ever go to `data/pickem-backtest/`.

**Why not add a Sunday live-capture task instead?**
- It adds a second schedule.
- It depends on when the poll lands. Week 1's came on a Tuesday.
- It captures nothing a git rebuild doesn't.

**What has to happen first, before Tuesday 9/29 3:04 PM PT, or that run finds nothing again:**
- **`review-pickem.mjs`** must also look in `data/pickem-backtest/` (it only reads
  `data/pickem-snapshots/` today) and write its review next to whichever file it read.
- **This branch** must be merged to `main` and pushed. It holds tooling, data and docs only, with
  no `src/` changes. The task runs on `main` with fast-forward-only merges, so it can't sit on
  local-only commits.
- **The task prompt itself** needs updating along these lines.

Week 4 stays recoverable from git regardless.

## Caveats

- **Two seasons of evidence (2025 tuning, 2024 holdout) plus three 2026 weeks.** All three are
  12-team-playoff seasons, but voters and seasons can still differ.
- **Data quirks in 2024:** a 26-team Week 6 AP poll (a tie at #25), and one hurricane-cancelled
  game between unranked teams. Neither affects the ranked results.
- **Stand-ins.** 2025 uses Elo in place of SP+/FPI. The rebuilt 2026 weeks carry post-game FPI/Elo
  updates (the Week 3 projection was identical either way).
- **CFP switch.** Around Week 10 the site switches to CFP rankings, and this was all tuned on AP
  voters. 2025's 6 CFP weeks are in the cache if we want to check that.
- **Entrants still can't be predicted.**

## Notes for later-me

- **Reproduce:**
  1. `node scripts/backtest-pickem.mjs`
  2. `node scripts/review-pickem.mjs --week 3 --params <file>`, where the file looks like
     `{ "label": "penalty 4", "params": { "unrankedLossPenalty": 4 } }`.
  3. `node scripts/reconstruct-pickem-week.mjs --week N`
- **Don't re-fetch 2025 or 2024.** `data/pickem-history/2025-raw.json` and `2024-raw.json` are the
  permanent caches.
- **Experiment 2:** `node scripts/holdout-pickem.mjs`.
- **The CFP check** (exploratory) fed each season's CFP polls through the same builder, relabeled
  as the poll to re-sort.
- **Exploratory numbers** (loss scale, per-season-part fits, exit rates) came from throwaway
  scripts. Anything that ships from them goes through a new pre-registered experiment file first.
