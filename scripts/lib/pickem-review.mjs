// Compares a Pick 'em snapshot (scripts/lib/pickem-snapshot.mjs) with the poll that actually came
// out afterwards. Pure: (snapshot, actualOrder) in, plain numbers/lists out; renderReport() turns
// that into markdown. scripts/review-pickem.mjs is the IO wrapper.
//
// Two lenses, because "did the projection match the poll?" is only half the question:
//   1. Poll accuracy -- projected rank vs actual rank, against the do-nothing baseline (carry the
//      old poll forward). A model that can't beat "no change" isn't adding anything.
//   2. The betting line -- how each result compared with the pre-game expectation ("surprise" =
//      actual margin minus the spread's expected margin) and whether the poll moved with it. This
//      shows what voters actually reward: winning, winning big, or beating the number.
//
// Scope limit worth knowing: the model only re-sorts the 25 teams already ranked, so it can never
// predict a team dropping out or an unranked team entering -- those are reported separately
// (`dropped`, `entered`) rather than counted against its rank error.

const round = (x, d = 2) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 10 ** d) / 10 ** d);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const sign = (x) => (x > 0 ? 1 : x < 0 ? -1 : 0);

export function pearson(xs, ys) {
  const n = xs.length;
  if (n < 3) return null;
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0; let sxx = 0; let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return sxx === 0 || syy === 0 ? null : sxy / Math.sqrt(sxx * syy);
}

// Least-squares slope of y on x (units of y per unit of x), null when x doesn't vary.
export function slope(xs, ys) {
  const n = xs.length;
  if (n < 3) return null;
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0; let sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  return sxx === 0 ? null : sxy / sxx;
}

// Spearman rank correlation between two orderings of the SAME set of ids.
export function spearman(orderA, orderB) {
  const n = orderA.length;
  if (n < 3) return null;
  const posB = new Map(orderB.map((id, i) => [id, i + 1]));
  let d2 = 0;
  orderA.forEach((id, i) => { d2 += (i + 1 - posB.get(id)) ** 2; });
  return 1 - (6 * d2) / (n * (n * n - 1));
}

export function reviewSnapshot(snapshot, actualOrder) {
  const actualRank = new Map(actualOrder.map((id, i) => [id, i + 1]));
  const rows = snapshot.teams.map((t) => {
    const ar = actualRank.get(t.id) ?? null;
    const g = t.game;
    return {
      id: t.id, name: t.name,
      currentRank: t.currentRank, projectedRank: t.projectedRank, actualRank: ar,
      projectedMove: t.move,
      actualMove: ar == null ? null : t.currentRank - ar,
      rankError: ar == null ? null : t.projectedRank - ar,          // + = projected too low in the poll
      baselineError: ar == null ? null : t.currentRank - ar,        // "no change" baseline
      margin: g?.margin ?? null,
      expectedMargin: g?.expectedMargin ?? null,
      surprise: g?.surprise ?? null,
      wasFavorite: g?.wasFavorite ?? null,
      upsetWin: g?.upsetWin ?? null,
      upsetLoss: g?.upsetLoss ?? null,
      opponent: g?.opponent ?? null,
      opponentRank: g?.opponentRank ?? null,
      spread: g?.spread ?? null,
      score: g?.score ?? null,
    };
  });
  const both = rows.filter((r) => r.actualRank != null);
  const dropped = rows.filter((r) => r.actualRank == null);
  const currentSet = new Set(snapshot.currentOrder);
  const entered = actualOrder.filter((id) => !currentSet.has(id));

  // ---- 1. poll accuracy
  const absErr = both.map((r) => Math.abs(r.rankError));
  const absBase = both.map((r) => Math.abs(r.baselineError));
  const commonProjected = snapshot.projectedOrder.filter((id) => actualRank.has(id));
  const commonActual = actualOrder.filter((id) => commonProjected.includes(id));
  const commonCurrent = snapshot.currentOrder.filter((id) => actualRank.has(id));
  const dir = both.filter((r) => r.projectedMove !== 0 || r.actualMove !== 0);
  const accuracy = {
    teamsInBothPolls: both.length,
    maeModel: round(mean(absErr)),
    maeBaselineNoChange: round(mean(absBase)),
    exact: absErr.filter((e) => e === 0).length,
    within1: absErr.filter((e) => e <= 1).length,
    within2: absErr.filter((e) => e <= 2).length,
    baselineExact: absBase.filter((e) => e === 0).length,
    baselineWithin1: absBase.filter((e) => e <= 1).length,
    baselineWithin2: absBase.filter((e) => e <= 2).length,
    spearmanModel: round(spearman(commonProjected, commonActual)),
    spearmanBaselineNoChange: round(spearman(commonCurrent, commonActual)),
    moveMaeModel: round(mean(both.map((r) => Math.abs(r.projectedMove - r.actualMove)))),
    moveMaeBaseline: round(mean(both.map((r) => Math.abs(r.actualMove)))),
    directionCorrect: dir.filter((r) => sign(r.projectedMove) === sign(r.actualMove)).length,
    directionTotal: dir.length,
  };
  const biggestMisses = both.filter((r) => r.rankError !== 0)
    .sort((a, b) => Math.abs(b.rankError) - Math.abs(a.rankError)).slice(0, 6);

  // ---- 2. the betting line
  const played = rows.filter((r) => r.surprise != null);
  const favorites = played.filter((r) => r.wasFavorite === true);
  const lineLens = {
    gamesWithLine: played.length,
    favoritesWon: favorites.filter((r) => r.margin > 0).length,
    favoritesTotal: favorites.length,
    coveredSpread: played.filter((r) => r.surprise > 0).length,
    meanSurprise: round(mean(played.map((r) => r.surprise)), 1),
    upsetLosses: played.filter((r) => r.upsetLoss).map((r) => r.id),
  };
  const withMove = both.filter((r) => r.surprise != null);
  const sx = withMove.map((r) => r.surprise);
  const correlations = {
    n: withMove.length,
    surpriseVsActualMove: round(pearson(sx, withMove.map((r) => r.actualMove))),
    surpriseVsProjectedMove: round(pearson(sx, withMove.map((r) => r.projectedMove))),
    rawMarginVsActualMove: round(pearson(withMove.map((r) => r.margin), withMove.map((r) => r.actualMove))),
    rawMarginVsProjectedMove: round(pearson(withMove.map((r) => r.margin), withMove.map((r) => r.projectedMove))),
    actualMovePerPointOfSurprise: round(slope(sx, withMove.map((r) => r.actualMove)), 3),
    projectedMovePerPointOfSurprise: round(slope(sx, withMove.map((r) => r.projectedMove)), 3),
  };
  // Voters disagreeing with the number: beat the line comfortably but didn't rise / missed it
  // badly but didn't fall. 7 points = a touchdown, the rough size of "meaningfully".
  const voterSurprises = withMove
    .filter((r) => (r.surprise >= 7 && r.actualMove <= 0) || (r.surprise <= -7 && r.actualMove >= 0))
    .sort((a, b) => Math.abs(b.surprise) - Math.abs(a.surprise));

  // Newcomers and exits, with their own line results from the whole-slate record.
  const gameOf = (id) => snapshot.games.find((g) => g.away === id || g.home === id) ?? null;
  const describeTeam = (id) => {
    const g = gameOf(id);
    if (!g) return { id, game: null };
    const isHome = g.home === id;
    const margin = g.homeMargin == null ? null : (isHome ? g.homeMargin : -g.homeMargin);
    const expected = g.expectedHomeMargin == null ? null : (isHome ? g.expectedHomeMargin : -g.expectedHomeMargin);
    return {
      id, opponent: isHome ? g.away : g.home, opponentRank: isHome ? g.awayRank : g.homeRank,
      spread: g.spread, margin, expectedMargin: expected,
      surprise: margin != null && expected != null ? margin - expected : null,
    };
  };

  return {
    week: snapshot.week, season: snapshot.season, pollSource: snapshot.pollSource,
    snapshotGeneratedAt: snapshot.generatedAt,
    rows, accuracy, biggestMisses, lineLens, correlations, voterSurprises,
    dropped: dropped.map((r) => ({ ...describeTeam(r.id), name: r.name, currentRank: r.currentRank, projectedRank: r.projectedRank })),
    entered: entered.map((id) => ({ ...describeTeam(id), actualRank: actualRank.get(id) })),
  };
}

const signed = (n) => (n == null ? 'n/a' : `${n > 0 ? '+' : ''}${n}`);
const mv = (n) => (n == null ? 'out' : n > 0 ? `▲${n}` : n < 0 ? `▼${-n}` : '–');

export function renderReport(review, nameOf = (id) => id) {
  const a = review.accuracy;
  const c = review.correlations;
  const L = review.lineLens;
  const out = [];
  out.push(`# Week ${review.week} Pick 'em review -- ${review.pollSource.toUpperCase()} poll`);
  out.push('');
  out.push('## 1. Did the projected poll match the real one?');
  out.push('');
  out.push(`Teams in both polls: ${a.teamsInBothPolls}. Lower error is better; the baseline is "leave the poll unchanged".`);
  out.push('');
  out.push('| | Model | No-change baseline |');
  out.push('|---|---|---|');
  out.push(`| Mean abs rank error | ${a.maeModel} | ${a.maeBaselineNoChange} |`);
  out.push(`| Exact rank | ${a.exact} | ${a.baselineExact} |`);
  out.push(`| Within 1 | ${a.within1} | ${a.baselineWithin1} |`);
  out.push(`| Within 2 | ${a.within2} | ${a.baselineWithin2} |`);
  out.push(`| Spearman vs real order | ${a.spearmanModel} | ${a.spearmanBaselineNoChange} |`);
  out.push(`| Mean abs error in the *move* | ${a.moveMaeModel} | ${a.moveMaeBaseline} |`);
  out.push('');
  out.push(`Direction (up/down/same) right for ${a.directionCorrect} of ${a.directionTotal} teams that moved in the projection or the real poll.`);
  out.push('');
  out.push('| Team | Was | Projected | Actual | Proj move | Actual move | Result | vs line |');
  out.push('|---|---|---|---|---|---|---|---|');
  for (const r of [...review.rows].sort((x, y) => (x.actualRank ?? 99) - (y.actualRank ?? 99))) {
    const res = r.score ? `${r.margin > 0 ? 'W' : 'L'} ${r.score.mine}-${r.score.theirs}` : '--';
    out.push(`| ${r.name} | #${r.currentRank} | #${r.projectedRank} | ${r.actualRank ? `#${r.actualRank}` : 'out'} | ${mv(r.projectedMove)} | ${mv(r.actualMove)} | ${res} | ${signed(r.surprise)} |`);
  }
  out.push('');
  out.push(review.biggestMisses.length
    ? 'Biggest misses (projected rank vs actual): '
      + review.biggestMisses.map((r) => `${r.name} (proj #${r.projectedRank}, actual #${r.actualRank})`).join('; ') + '.'
    : 'Biggest misses: none -- every team in both polls landed exactly where projected.');
  out.push('');
  out.push(`Dropped out of the poll (the model can't predict exits): ${review.dropped.length
    ? review.dropped.map((d) => `${d.name} (was #${d.currentRank}, ${signed(d.surprise)} vs line)`).join('; ') : 'none'}.`);
  out.push(`Entered the poll (or can't be predicted either): ${review.entered.length
    ? review.entered.map((e) => `${nameOf(e.id)} (#${e.actualRank}, ${signed(e.surprise)} vs line)`).join('; ') : 'none'}.`);
  out.push('');
  out.push('## 2. Against the betting line');
  out.push('');
  out.push(`Ranked teams' games with a line: ${L.gamesWithLine}. Favorites won ${L.favoritesWon}/${L.favoritesTotal}; `
    + `${L.coveredSpread} of ${L.gamesWithLine} teams covered; mean surprise ${signed(L.meanSurprise)} points; `
    + `favorites that lost: ${L.upsetLosses.length ? L.upsetLosses.map(nameOf).join(', ') : 'none'}.`);
  out.push('');
  out.push(`Correlation with the real poll move (n=${c.n}; +1 = moves together): beating the line ${c.surpriseVsActualMove}, raw margin ${c.rawMarginVsActualMove}.`);
  out.push(`Same for the model's projected move: beating the line ${c.surpriseVsProjectedMove}, raw margin ${c.rawMarginVsProjectedMove}.`);
  out.push(`Real poll: ${c.actualMovePerPointOfSurprise} rank spots per point of surprise; model: ${c.projectedMovePerPointOfSurprise}.`);
  out.push('');
  out.push(review.voterSurprises.length
    ? 'Voters against the line (beat it by 7+ but did not rise, or missed by 7+ but did not fall): '
      + review.voterSurprises.map((r) => `${r.name} (${signed(r.surprise)} vs line, ${mv(r.actualMove)})`).join('; ') + '.'
    : 'No team beat/missed the line by 7+ and moved the opposite way.');
  out.push('');
  return out.join('\n');
}
