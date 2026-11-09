#!/usr/bin/env node
// Fits experiment 3's loss-count values on 2024 + 2025 (both already examined, so they're the
// tuning data) before the held-out season is fetched. Same selection rule as experiment 2: the
// one-standard-error choice (pickem-tuning.mjs oneSeChoice, 10,000 bootstrap draws, seed
// 20260923) over a grid starting at "off", on top of the live model (lossScale 2.5).
// Local files only; no API calls. Prints the curves the experiment-3 spec cites.
//
// Usage: node scripts/fit-loss-pull.mjs [--draws 10000]

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PARAMS_LIVE } from './lib/pickem-model-params.mjs';
import { errorMatrix, oneSeChoice, crossValidate } from './lib/pickem-tuning.mjs';
import { loadHistorySeason } from './lib/pickem-data.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const i = args.indexOf('--draws');
const OPTS = { draws: i === -1 ? 10000 : Number(args[i + 1]), seed: 20260923 };

const records = [2024, 2025].flatMap((s) => loadHistorySeason(ROOT, s).records.map((r) => ({ ...r, season: s })));
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const r2 = (x) => Math.round(x * 100) / 100;

function fit(base, setting, grid) {
  const M = errorMatrix(records, base, { setting, grid });
  const pick = oneSeChoice(M, OPTS);
  const cv = crossValidate(M, OPTS);
  console.log(`\n${setting} on top of ${JSON.stringify(Object.fromEntries(Object.entries(base).filter(([k, v]) => PARAMS_LIVE[k] !== v || k === 'lossScale')))}`);
  console.log('value | 2024+2025 | 2024 | 2025 | excess over best | 1 SE');
  grid.forEach((v, idx) => {
    const by = (s) => r2(sum(M[idx].filter((c) => c.season === s).map((c) => c.e)));
    const t = pick.table[idx];
    console.log(`${v} | ${r2(t.E)} | ${by(2024)} | ${by(2025)} | ${r2(t.excess)} | ${r2(t.se)}${idx === pick.bestIndex ? '  <- best' : ''}${idx === pick.index ? '  <- one-SE pick' : ''}`);
  });
  console.log(`leave-one-week-out: ${JSON.stringify(Object.fromEntries(Object.entries(cv).filter(([k]) => k !== 'folds')))}`);
  return grid[pick.index];
}

const pull = fit(PARAMS_LIVE, 'lossCountPull', [0, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4]);
fit(PARAMS_LIVE, 'lossPullFrom3', [0, 0.5, 1, 2, 3, 4, 6, 8]);
if (pull) fit({ ...PARAMS_LIVE, lossCountPull: pull }, 'lossPullFrom3', [0, 0.5, 1, 2, 3, 4, 6, 8]);
// Does the pull stand in for part of the loss scale? Refit lossScale with the pull in place
// (grid starts at the live 2.5 so "no change" is the first row).
if (pull) fit({ ...PARAMS_LIVE, lossCountPull: pull }, 'lossScale', [2.5, 1.5, 2, 3, 3.5]);
