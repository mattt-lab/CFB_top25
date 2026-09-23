// Confirms pre-fitted models on a season none of them was tuned on (experiment-2.json). Pure:
// week records in, decisions out. Unlike experiment 1 nothing is fitted here -- every model's
// values are fixed in the spec -- so the held-out season can't be overfit, only passed or failed.

import { PARAMS_V1 } from './pickem-model-params.mjs';
import { evaluate } from './pickem-backtest.mjs';
import { bootstrapSums, improvementWithoutEachTeam } from './pickem-tuning.mjs';

const sum = (xs) => xs.reduce((a, b) => a + b, 0);

// Positive delta = the candidate makes fewer weighted pairwise errors than the current model.
export function compareOnHoldout(records, currentParams, candidateParams, opts = {}) {
  const a = evaluate(records, currentParams);
  const b = evaluate(records, candidateParams);
  const deltas = a.weeks.map((wa, i) => wa.w * wa.dModel - b.weeks[i].w * b.weeks[i].dModel);
  const delta = sum(deltas);
  const sums = bootstrapSums(deltas, opts);
  const ci5 = sums[Math.floor(0.05 * sums.length)];
  const early = sum(deltas.filter((_, i) => records[i].week <= (opts.earlyThroughWeek ?? 8)));
  const late = delta - early;
  const jack = improvementWithoutEachTeam(records, currentParams, candidateParams);
  return {
    eCurrent: a.wModel, eCandidate: b.wModel, delta, ci5, early, late,
    minWithoutOneTeam: jack.minImprovement, worstTeam: jack.worstTeam,
    pass: delta > 0 && ci5 > 0 && early >= 0 && late >= 0 && jack.minImprovement > 0,
  };
}

// Walks the spec's chain from V1: each step's candidate replaces the current model only if it
// passes compareOnHoldout against it. The final model must also not make the check season worse
// than V1; if it does, fall back through the adopted models until one doesn't.
export function runChain(holdout, check, { models, chain }, opts = {}) {
  let current = { name: 'V1', params: { ...PARAMS_V1 } };
  const adopted = [current];
  const steps = [];
  for (const step of chain) {
    if (step.onlyIfCurrent && !step.onlyIfCurrent.includes(current.name)) {
      steps.push({ step: step.step, to: step.candidate ?? step.label, from: current.name, skipped: true, pass: false });
      continue;
    }
    const cand = step.adds
      ? { name: `${current.name} + ${step.label}`, params: { ...current.params, ...step.adds } }
      : { name: step.candidate, params: { ...PARAMS_V1, ...models[step.candidate] } };
    const cmp = compareOnHoldout(holdout, current.params, cand.params, opts);
    steps.push({ step: step.step, from: current.name, to: cand.name, skipped: false, ...cmp });
    if (cmp.pass) {
      current = cand;
      adopted.push(cand);
    }
  }
  const eV1 = evaluate(check, PARAMS_V1).wModel;
  const path = [];
  let final = adopted[0];
  for (let i = adopted.length - 1; i >= 0; i--) {
    const eCheck = evaluate(check, adopted[i].params).wModel;
    path.push({ name: adopted[i].name, eCheck });
    if (eCheck <= eV1) { final = adopted[i]; break; }
  }
  return { steps, final, guard: { eV1, path, steppedBack: final !== current } };
}
