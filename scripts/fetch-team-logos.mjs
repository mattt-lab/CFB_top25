// Downloads team logo images (light + dark background variants) from CollegeFootballData.com
// (CFBD) and writes them into public/logos/ as static assets. This is a STANDALONE, MANUALLY-RUN
// script -- deliberately NOT wired into the daily fetch-data.yml pipeline (see
// .github/workflows/fetch-team-logos.yml, which is workflow_dispatch-only, no cron). Team logos
// essentially never change mid-season, so there's no reason to spend a CFBD call on this every day.
//
// Endpoint hit (base https://api.collegefootballdata.com):
//   GET /teams/fbs   (no params -- confirmed against the live OpenAPI spec that `year` is optional
//                      on this endpoint; it just returns the current FBS team list) -> logos + names
//
// ONE API call total for the whole script.
//
// Response shape (confirmed live, 2026-08-07, against a real /teams/fbs entry):
//   {
//     "id": 2005,
//     "school": "Air Force",              <- plain team name, same field fetch-cfb-data.mjs's
//                                             slugify() consumes elsewhere (via r.school / g.homeTeam
//                                             etc.) to produce ids like "texas-a-m"
//     "logos": [
//       "https://cdn.collegefootballdata.com/logos/500/2005.png",
//       "https://cdn.collegefootballdata.com/logos-dark/500/2005.png",
//       "https://cdn.collegefootballdata.com/logos/256/2005.png",
//       "https://cdn.collegefootballdata.com/logos-dark/256/2005.png",
//       ... (128/96/64/48/32/16, same light/dark pairing per size)
//     ],
//     ...
//   }
//
// IMPORTANT correction vs. the initial assumption: `logos` is NOT light-only -- it's every size in
// BOTH light and dark, interleaved. The light/dark split is the URL's path segment: a light URL's
// path contains "/logos/<size>/<id>.png"; the dark counterpart is byte-identical except
// "/logos/" -> "/logos-dark/" (verified live: swapping that exact substring on
// "https://cdn.collegefootballdata.com/logos/256/2005.png" produces
// "https://cdn.collegefootballdata.com/logos-dark/256/2005.png", which 200s with content-type
// image/png). Filtering each URL with `.includes('/logos/')` correctly excludes the dark ones too
// -- "logos-dark" never contains the substring "/logos/" (the character after "logos" there is
// "-", not "/"), so no extra dark-exclusion check is needed beyond that one filter.
//
// ---------------------------------------------------------------------------------------------
// HOW TO TEST (once a live CFBD_API_KEY is available -- get a free one at
// https://collegefootballdata.com/key):
//
//   CFBD_API_KEY=xxxxxxxx node scripts/fetch-team-logos.mjs
//
// Verified live against the real 138-team FBS response (2026-08-07) -- see git history / this
// script's dev run for what surfaced. Idempotent: re-running overwrites the same files, no error.
// ---------------------------------------------------------------------------------------------

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { cfbdGet } from './lib/cfbd.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const LOGOS_DIR = join(ROOT, 'public', 'logos');

const TARGET_SIZE = 256;

// ---- small helpers --------------------------------------------------------------------------

// Byte-identical copy of fetch-cfb-data.mjs's slugify() -- kept as a local copy rather than a
// shared import since it isn't currently exported from a shared module, and this script needs ids
// that match data/current.json's team ids exactly (e.g. "texas-a-m", "san-jose-state").
function slugify(name) {
  // Strip diacritics rather than dropping the letter outright -- "San José State" should slug to
  // "san-jose-state", not "san-jos-state" (confirmed live: that team is real FBS/CFBD data, not
  // a hypothetical). NFD decomposes accented chars into base+combining-mark pairs; stripping the
  // combining-mark Unicode block leaves the plain base letter.
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Pulls the size number out of a CFBD logo URL, e.g.
// "https://cdn.collegefootballdata.com/logos/256/2005.png" -> 256.
function extractSize(url) {
  const m = /\/(\d+)\/[^/]+$/.exec(url);
  return m ? Number(m[1]) : null;
}

// From a team's full `logos` array (light + dark interleaved, see header comment), pick the best
// LIGHT-variant URL for TARGET_SIZE: exact match if present, else the smallest size >= TARGET_SIZE
// (closest without going below), else the largest size available below TARGET_SIZE.
function pickLightLogo(logos) {
  const lightSized = logos
    .filter((u) => typeof u === 'string' && u.includes('/logos/'))
    .map((u) => ({ url: u, size: extractSize(u) }))
    .filter((entry) => entry.size != null);
  if (lightSized.length === 0) return null;

  const exact = lightSized.find((entry) => entry.size === TARGET_SIZE);
  if (exact) return exact.url;

  const atOrAbove = lightSized.filter((entry) => entry.size >= TARGET_SIZE).sort((a, b) => a.size - b.size);
  if (atOrAbove.length > 0) return atOrAbove[0].url;

  const largest = lightSized.slice().sort((a, b) => b.size - a.size)[0];
  return largest.url;
}

// Derives the dark-background counterpart of a chosen light logo URL by substituting the
// "/logos/" path segment for "/logos-dark/" (verified live -- see header comment).
function toDarkUrl(lightUrl) {
  return lightUrl.replace('/logos/', '/logos-dark/');
}

async function downloadImage(url) {
  const res = await fetch(url);
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

// ---- main -------------------------------------------------------------------------------

async function main() {
  mkdirSync(LOGOS_DIR, { recursive: true });

  console.log('Fetching FBS team list...');
  const teams = await cfbdGet('/teams/fbs');
  console.log(`Got ${teams.length} teams.`);

  let logosWritten = 0;
  let darkLogosWritten = 0;
  const skipped = [];

  for (const team of teams) {
    if (!team || !team.school) {
      skipped.push(`(unnamed team id=${team && team.id}) -- missing school name`);
      continue;
    }
    const id = slugify(team.school);

    if (!Array.isArray(team.logos) || team.logos.length === 0) {
      skipped.push(`${id} -- no logos array`);
      continue;
    }

    const lightUrl = pickLightLogo(team.logos);
    if (!lightUrl) {
      skipped.push(`${id} -- no usable light logo URL found`);
      continue;
    }

    const lightBuf = await downloadImage(lightUrl);
    if (!lightBuf) {
      skipped.push(`${id} -- light logo fetch failed (${lightUrl})`);
      continue;
    }
    writeFileSync(join(LOGOS_DIR, `${id}.png`), lightBuf);
    logosWritten += 1;

    const darkUrl = toDarkUrl(lightUrl);
    const darkBuf = await downloadImage(darkUrl);
    if (!darkBuf) {
      skipped.push(`${id} -- dark logo fetch failed (${darkUrl}), skipped`);
      continue;
    }
    writeFileSync(join(LOGOS_DIR, `${id}-dark.png`), darkBuf);
    darkLogosWritten += 1;
  }

  console.log('---');
  console.log(`Processed ${teams.length} teams.`);
  console.log(`Wrote ${logosWritten} light logos, ${darkLogosWritten} dark logos to ${LOGOS_DIR}.`);
  if (skipped.length > 0) {
    console.log(`Skipped/warned ${skipped.length}:`);
    for (const s of skipped) console.log(`  - ${s}`);
  } else {
    console.log('No teams skipped.');
  }
}

main().catch((err) => {
  console.error('fetch-team-logos failed:', err && err.stack ? err.stack : err);
  process.exit(1);
});
