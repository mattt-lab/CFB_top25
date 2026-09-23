# Week 3 → Week 4 Pick'em snapshot

**Captured:** 2026-09-19/20, from `data/pickem-snapshots/2026-wk03.json` -- the frozen snapshot taken
Saturday 2026-09-19 ~9:34 PM PT once every *ranked* team's game was final (`complete: true`,
`notFinal: []`). Seven unranked late-night West Coast games were still live at capture time (James
Madison @ San Diego State, South Dakota @ Boise State, Northern Illinois @ Arizona, North Dakota
State @ Sacramento State, Montana @ Oregon State, Fresno State @ San Jose State, Purdue @ UCLA) --
none of those teams entered the real Week 4 poll, so this gap doesn't touch anything scored below.

**Resolved:** 2026-09-22, against the real Week 4 AP poll (`data/rankings/2026-wk04.json`, landed
in the automated data pipeline; fetched by us 2026-09-21T18:35Z). `node scripts/review-pickem.mjs
--write` produced `data/pickem-snapshots/2026-wk03.review.md`/`.review.json` -- those are the raw,
non-ripple-corrected numbers; this doc applies the root-mover correction on top per the Week 1
methodology.

**Model in one line:** movement scales with opponent quality (poll rank, else SP+ rank) and the
called margin (blowoutWin/win/loss/blowoutLoss); a blowout is any game decided by 14+ points either
direction; beating a fellow ranked team always vaults you above them. It never looks at the betting
line and can only re-sort the 25 teams already ranked -- it cannot add or drop one.

## Baseline table: Week 3 ranks, results, and Week 4 actual

| Wk3 rank | Team | Result | Score | Margin | Line | Surprise (actual − line) | Projected Wk4 | Actual Wk4 | Model right? (root-mover corrected) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Texas | W vs UTSA | 30–6 | +24 | Texas -29.5 | -5.5 | 1 | 1 | — held; not a real test |
| 2 | Georgia | W | 45–17 | +28 | Georgia -24.5 | +3.5 | 2 | 2 | — held; not a real test |
| 3 | Notre Dame | W | 27–10 | +17 | Notre Dame -28.5 | -11.5 | 3 | 3 | — held; not a real test |
| 4 | Indiana | W vs Howard | 38–0 | +38 | Indiana -44.5 | -6.5 | 4 | 5 | — passive fall (A&M's collapse rippled everyone below it up) |
| 5 | Miami | W | 33–20 | +13 | Miami -20.5 | -7.5 | 5 | 6 | — passive |
| 6 | Ohio State | W | 59–3 | +56 | Ohio State -52.5 | +3.5 | 6 | 7 | — passive |
| 7 | LSU | **L** at Ole Miss | 24–32 | -8 | LSU -3 (favorite) | **-11** | 9 (▼2) | 10 (▼3) | ✓ root mover -- direction right, magnitude close (off by 1) |
| 8 | Ole Miss | **W** vs LSU | 32–24 | +8 | (underdog +3) | **+11** | 7 (▲1) | 4 (▲4) | ~ root mover -- direction right, magnitude badly underestimated |
| 9 | Texas A&M | **L** vs Kentucky | 21–31 | -10 | A&M -16.5 (favorite) | **-26.5** | 14 (▼5) | 23 (▼14) | ~ root mover -- direction right, worst magnitude miss of the week |
| 10 | Alabama | W | 50–36 | +14 | Alabama -18.5 | -4.5 | 8 | 8 | — passive |
| 11 | BYU | W | 41–23 | +18 | BYU -17.5 | +0.5 | 10 | 9 | — passive |
| 12 | USC | W vs Rutgers | 42–35 | +7 | USC -21 (favorite) | -14 | 12 | 12 | — passive (own rank unchanged 12→12; got passed *and* passed nobody) |
| 13 | Texas Tech | **W** vs Houston | 28–26 | +2 | TT -7.5 (favorite) | -5.5 | 11 (▲2) | 11 (▲2) | ✓✓ root mover -- exact match |
| 14 | Penn State | W | 55–13 | +42 | Penn State -39.5 | +2.5 | 13 | 13 | — passive |
| 15 | Tennessee | W | 42–9 | +33 | Tennessee -35.5 | -2.5 | 15 | 14 | — passive |
| 16 | SMU | **L** at Louisville | 31–41 | -10 | Louisville -3 (SMU underdog) | **-7** | 20 (▼4) | 22 (▼6) | ✓ root mover -- direction right, magnitude underestimated |
| 17 | Utah | W | 33–0 | +33 | Utah -26.5 | +6.5 | 16 | 15 | — passive |
| 18 | Iowa | W | 55–0 | +55 | Iowa -37.5 | +17.5 | 17 | 17 | — passive |
| 19 | Michigan | W | 52–17 | +35 | Michigan -34.5 | +0.5 | 18 | 18 | — passive |
| 20 | Missouri | W | 27–17 | +10 | Missouri -27.5 | -17.5 | 21 | 19 | — passive |
| 21 | Oregon | W | 84–0 | +84 | Oregon -58.5 | +25.5 | 22 | 20 | — passive |
| 22 | Houston | **L** at Texas Tech | 26–28 | -2 | +5.5 | +5.5 | 24 (▼2) | 25 (▼3) | — passive (carried down by Texas Tech's real rise, not its own game) |
| 23 | Louisville | **W** vs SMU | 41–31 | +10 | Louisville -3 (favorite) | **+7** | 19 (▲4) | 16 (▲7) | ✓ root mover -- direction right, magnitude underestimated |
| 24 | Oklahoma | W vs New Mexico | 14–6 | +8 | Oklahoma -21.5 (favorite) | -13.5 | 23 (▲1) | **out of Top 25** | ✗✗ structural miss -- model can't drop below #25 |
| 25 | Virginia | **L** vs West Virginia | 27–38 | -11 | Virginia -10.5 (favorite) | -21.5 | 25 (held) | **out of Top 25** | ✗✗ structural miss -- model can't drop below #25 |
| entrant | Florida | W at Auburn | 44–39 | +5 | Florida -2.5 (favorite) | +2.5 | n/a | 21 | n/a -- unranked, model can't add a team |
| entrant | Mississippi State | W at South Carolina | 41–34 | +7 | S.Carolina -3 (Miss. State underdog) | +10 | n/a | 24 | n/a -- unranked, model can't add a team |

## 1. Zero-sum correction: root movers vs. passive risers/fallers

Applying the longest-increasing-subsequence method to the 23 teams in both the Week 3 and Week 4 AP
polls: **17 of 23 are passive** (their order relative to every neighbor they started next to is
unchanged; they were purely carried by someone else's move) and **6 are root movers**: LSU, Ole
Miss, Texas A&M, Texas Tech, SMU, Louisville. That's the entire real test of the model this week --
everything else (Indiana/Miami/Ohio State drifting down a slot, Utah/Iowa/Michigan/Missouri/Oregon
drifting up) is 100% ripple from Texas A&M's collapse (vacating 14 spots) and Oklahoma/Virginia's
exits (vacating 2 more), not evidence the model called (or missed) those teams' own games.

**One judgment call, noted per the task's ask to say so:** the raw LIS algorithm also flagged USC as
a "root mover" because Texas Tech's real rise (13→11) technically inverted its order against USC
(12→12). But USC's own absolute rank is byte-identical before and after (12→12) -- it didn't pass
anyone or get passed in a way that reflects its own game. I'm scoring this pair as Texas Tech
(real mover, own rank changed) vs. USC (passive, own rank didn't), consistent with how the Week 1
doc treated the Oregon/Georgia ripple.

## 2. Poll accuracy: raw vs. root-mover-corrected

**Raw** (from `scripts/review-pickem.mjs`, all 23 teams, not ripple-corrected): mean absolute rank
error 1.26 vs. 2.35 for "leave the poll unchanged," exact rank 9/23, within-1 17/23, Spearman 0.95 vs.
0.85, direction right on 13/19 teams that moved either projected or actually.

**Root-mover-corrected** (the 6 teams above, the only fair test): mean absolute rank error **3.0**
vs. **6.0** for the no-change baseline -- the model is still clearly better than doing nothing, but
the raw number (1.26) was flattering: most of that "accuracy" was 17 teams the model had literally
nothing to say about, riding someone else's real move.

**Where the model actually earned its numbers:**
- **Direction: 6/6.** Every root mover moved the direction the model called -- LSU/Texas A&M/SMU
  down, Ole Miss/Texas Tech/Louisville up.
- **Magnitude: 1/6 exact (Texas Tech), 5/6 underestimated -- and underestimated hardest exactly where
  the betting-line miss was largest.** Texas A&M was picked to fall 5, fell 14 (surprise -26.5, the
  week's biggest line miss). Ole Miss was picked to rise 1, rose 4 (surprise +11). LSU/SMU/Louisville
  all landed 2-3 spots past the model's call, each with a |surprise| of 7-11. Texas Tech -- the one
  exact call -- also had the smallest |surprise| of the six (-5.5). That's not a coincidence worth
  ignoring; see Section 3.

**Biggest misses by raw rank position:** Texas A&M (proj #14, actual #23, -9), Ole Miss (proj #7,
actual #4, +3), and the two structural exits (Oklahoma, Virginia -- unscored by the metric at all,
not just "missed," because the model has no way to even represent "gone").

## 3. The betting line: what voters actually rewarded

Favorites went 19-3 among ranked-team games with a line (LSU, Texas A&M, and Virginia lost as
favorites -- all three straight upset losses, all three among this week's biggest poll movers or
exits). 11 of 25 ranked teams covered. Mean surprise across all 25 was -2.8 (a mildly chalk-unfriendly
week -- more teams missed their number than beat it).

**Correlation with the real poll's move** (n=23, raw, from the automated report): beating the line
0.55, raw margin 0.35 -- surprise (line-adjusted performance) tracked the real poll move noticeably
better than plain margin did. Real voters moved teams about **0.191 rank spots per point of
surprise**; the *model's* projected move only shifted **0.073 spots per point of surprise** (0.43/0.30
correlation with beating-the-line/margin respectively) -- the model is already picking up some of this
signal indirectly (via margin category + opponent quality), but at roughly a third the real poll's
sensitivity.

**On root movers specifically**, the pattern is sharper: the two biggest surprises of the week
(Texas A&M -26.5, Ole Miss +11, LSU -11) produced the three biggest magnitude misses of the six root
movers. Texas Tech's -5.5 surprise (smallest of the six) was the one exact call. This is a small
sample (n=6) but it's internally consistent with the correlation numbers above.

**Voters treated opposite to the line** (beat it by 7+ but did not rise, or missed by 7+ but did not
fall -- all three of these are *passive* teams, not root movers, so this is really "the model's flat
call for these three happened to be right regardless of the line"): Missouri (-17.5 vs. line, only
rose because of A&M's collapse), USC (-14 vs. line, held flat), Notre Dame (-11.5 vs. line, held
flat).

## 4. Entrants and exits

**Oklahoma (was #24) and Virginia (was #25) both fell out of the poll entirely -- the model, by
construction, held them at #23 and #25.** Virginia's case is the sharper failure: a 27-38 *home loss*
to an unranked team (West Virginia) as a 10.5-point favorite, missing the line by 21.5 points -- the
model still can't demote below #25 no matter how bad the result. Oklahoma actually *won* (14-6 over
New Mexico) but as a 21.5-point favorite that's a 13.5-point line miss, evidently unconvincing enough
for voters to drop it for Florida and Mississippi State instead.

**Florida (beat Auburn by 5 as a 2.5-pt road favorite, +2.5 vs. line) and Mississippi State (beat
South Carolina by 7 as a 3-pt underdog, +10 vs. line, an upset)** entered at #21 and #24 -- both teams
that specifically *beat* their number, while the two teams they replaced *missed* theirs by double
digits. That's a clean, if small-sample, data point for "beating the line matters for entering/exiting
the poll," on top of Section 3's evidence that it matters for movement within the poll too.

**How much of the total error is structural:** 2 of the 25 real poll slots this week (8%) are
teams the model literally could not have produced -- not a near-miss, an unrepresentable outcome. The
automated review's mean-abs-error metric excludes these by design (`scripts/review-pickem.mjs` reports
exits/entrants separately, not as rank error), so the "1.26" and even the corrected "3.0" numbers both
undercount the real gap between this model and a full 25-team accounting. This matches **Michigan's
Week 1 exit exactly** -- same failure mode, second and third occurrence.

## Verdict across three weeks (Week 1 → Week 2 → Week 3)

Week 1's own recommendation was to wait and see whether the *same* failure modes repeated before
tuning anything. They did, on both counts:

- **A blowout/decisive-enough win against a fine-but-not-great opponent still losing real ground:**
  Week 1 had Washington (blowout win, lost 3 real spots to Penn State/SMU/Tennessee). Week 2 (backfill,
  below) has the same shape with USC, SMU, and Tennessee all getting real credit the model's flat call
  missed. Week 3 doesn't have a clean example of this specific shape, but does show the mirror image at
  much higher stakes: A&M and LSU each dropped far more than a "decisive loss" call implied once the
  line said the result was even more lopsided than the raw score suggested.
- **A team falling out of the poll entirely, invisible to the model:** Week 1 -- Michigan (won by 1,
  gone). Week 3 -- Oklahoma *and* Virginia, same week. Two occurrences now beyond Week 1, both with a
  large line miss attached (13.5 and 21.5 points). This is no longer a one-off; it's a standing,
  structural gap.
- **Did the model beat "leave the poll unchanged" on root movers, every week?** Yes, in both weeks it
  could be measured this way: Week 3 root movers, 3.0 vs. 6.0 mean abs error; Week 2 backfill root
  movers (below), 3.36 vs. 5.79 (using the 14 combined root-mover data points from Weeks 2+3 -- Week 1
  predates the snapshot tooling and wasn't captured with this same measurement). The model is doing
  real, non-trivial work -- it is just consistently too conservative on the teams it does have
  something to say about.
- **Does a line-based term explain real moves better than the current model?** See below -- yes,
  suggestively, but the evidence is thin (n=14) and inconsistent between weeks when tested
  out-of-sample.

### Quick test: `drift += k * surprise`

Using the 14 root-mover data points from Weeks 2 and 3 combined (Week 1 predates spread/surprise
tracking in this codebase's data, so it isn't included in this specific regression -- see Notes,
including the 2026-09-23 correction there: Week 1's spreads are in fact recoverable from git):

- Correlation with real move: surprise **0.815**, raw margin **0.612**, current model's projected
  move **0.931** (the current model, even without a line input, already correlates strongly with real
  movement on the teams it's actually being tested on -- its problem is magnitude, not direction).
- A simple in-sample linear fit of `k` (real move per point of surprise) on all 14 points gives
  `k ≈ 0.42` and cuts mean absolute error from 3.36 (current model alone) to 2.62 (model + k·surprise)
  -- but this is fit and tested on the same 14 points, so it's an upper bound on how good it could
  look, not a real estimate.
- **Out-of-sample check (the honest version):** fitting `k` on Week 2's 8 points (k≈0.377) and
  applying it to Week 3's 6 points cuts error there from 3.0 to 1.39 -- a real improvement. But fitting
  `k` on Week 3's 6 points (k≈0.526) and applying it to Week 2 makes Week 2 *worse* (3.625 → 4.13).
  **That inconsistency is the headline, not the average:** with only two weeks of root movers to
  cross-validate against, `k` is not stable enough yet to trust. The direction of the effect (bigger
  surprise → bigger real move, beyond what margin alone predicts) is consistent across both weeks; the
  exact size of it is not.

**Do NOT read "0.42" or any of the above numbers as a recommended constant.** Three weeks (~25 teams
each, and only 6-9 of those are root movers in a given week) is a small sample; these correlations are
suggestive of a real, structural underweighting of the betting line, not proof of a specific value to
code.

## Recommendations

1. **Add the betting line (surprise = actual margin − expected margin) as a model input**, most
   likely as a scaling factor on top of the existing opponent-quality/margin-category drift rather than
   a replacement for it -- the current model's direction-calling (0.93 correlation with real movement
   on root movers) is already good; its problem is that it's consistently too timid on magnitude, and
   surprise correlates with real movement even more strongly than raw margin does. *Evidence that would
   confirm this:* the out-of-sample k-transfer test above holding up (or at least not reversing) across
   Weeks 4-6, not just improving the in-sample fit further.
2. **Add an unranked-entrant/exit mechanism**, even a crude one (e.g., any unranked team that beats
   its line by some large margin against a ranked or notable opponent becomes eligible to bump the
   worst-performing-vs-line ranked team out). *Evidence that would confirm this is worth the complexity:*
   this has now happened in all 3 tracked weeks (Michigan Wk1; nobody Wk2 -- though Washington's exit in
   Wk2 and Michigan's Wk3 re-entry are the same underlying churn; Oklahoma+Virginia Wk3) -- a fourth
   straight week of exits/entrants would make this the single largest source of unscored error.
3. **Treat "own-rank-unchanged" as the passive-team test, not raw LIS membership**, when doing this
   root-mover analysis going forward -- the USC/Texas Tech (Wk3) and Houston/Missouri, SMU/Tennessee
   (Wk2) cases show the greedy LIS can arbitrarily assign the "root mover" label to the wrong side of a
   pairwise swap. *Evidence:* this is a methodology fix, not a model change -- confirm by checking that
   future weeks' judgment calls keep landing on the team whose own absolute rank actually moved.

## Notes for later-me

- The Week 4 poll landed via the automated pipeline in time -- no `--poll-file` override or ESPN
  fallback needed, and none of the 7 unfinished West Coast games at capture time touched a ranked team
  or an eventual entrant, so that known gap in the frozen snapshot didn't end up mattering this week.
- ESPN's pre-game win-probability stand-in (from `summary?event=<id>`'s first `winprobability` point)
  was **not** pulled for this doc -- none of the close/upset games this week needed a second opinion on
  pre-game expectation beyond the CFBD spread already in the snapshot. Available if a future week's
  line data looks suspect.
- The Week 2 backfill (see `2026-week2-vs-projected.md`) uses **today's** model code
  (`src/utils/projectTop25.js` as of 2026-09-22) applied to Week 2's historical inputs reconstructed
  from git history (`44bcb4b:data/current.json`) -- it is not what the live site actually showed in
  September when Week 2 happened, since the pickem snapshot tool didn't exist yet at that point. Worth
  remembering if the model code changes later and this file is re-read.
- Week 1 has no structured `surprise`/spread-per-pick data in this codebase's format (the pick'em
  snapshot schema, including spread capture, was added after Week 1 happened) -- its contribution to
  the 3-week verdict above is qualitative (from the resolved Week 1 doc's findings), not part of the
  n=14 regression.
  *(Correction, 2026-09-23: Week 1's spreads DO exist in git history. Commit `3502887`'s
  `data/current.json` has `currentWeek: 1` with all 25 ranked games final and a spread on every
  one, so Week 1 can be reconstructed exactly the way Week 2 was. It was left out of the n=14
  regression above; the follow-up model-tuning analysis includes it.)*
