# Pick 'em model tuning, round 1 (2026-09-23)

**Status: analysis only.** Nothing on the live site changed. The work lives on branch
`worktree-pickem-tuning`, and the model at `src/utils/projectTop25.js` is untouched.

**Question.** The weekly reviews (`docs/pickem-snapshots/`) kept showing the same misses. Can the
Pick 'em projection predict the next AP poll's order better by changing at most three settings,
without fitting noise?

**Where the numbers live.** Machine-written results:
`data/pickem-backtest/experiment-1.results.md` / `.json`. Reproduce with
`node scripts/backtest-pickem.mjs`, which reads only local files and makes no API calls.

## TL;DR

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

1. **Safe to ship now: `unrankedLossPenalty = 4`.**
   - It's the only change that passed every pre-registered rule.
   - It's easy to explain: "losing to an unranked team costs about 4 extra spots."
   - It needs a footnote update at `Pickem.jsx:170`.
   - Expected gain is about 5–10% fewer ordering errors, and in 2026 so far the average miss goes
     from 1.44 to 1.21 spots.
2. **Worth one more test first: a loss scale of about 2× (all losses), plus possibly an
   early-season win scale.**
   - Pre-register these as experiment 2 and test them on a season nothing has touched: 2024, 3
     CFBD calls.
   - If they hold up, ship them together with the penalty. Their potential is roughly double the
     penalty's gain.
3. **Consider a drop-out mechanism.** "Ranked 16–25 and lost" predicts 82% of exits, and exits are
   23% of the error. It's a page change, not a constant, so it's a product decision.
4. **Plumbing:**
   - `review-pickem.mjs --params <file>` now scores a challenger next to the live model every week.
     That's the rollback signal once something ships.
   - The weekly task should rebuild a missed week from git (`reconstruct-pickem-week.mjs --week N`)
     instead of trying the new week on Tuesdays.

## Caveats

- **One tuning season.** 2025 and 2026 are both 12-team-playoff seasons, but different voters and
  seasons can differ.
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
- **Don't re-fetch 2025.** `data/pickem-history/2025-raw.json` is the permanent cache.
- **Exploratory numbers** (loss scale, per-season-part fits, exit rates) came from throwaway
  scripts. Anything that ships from them goes through a new pre-registered experiment file first.
