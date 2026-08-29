// Shared CollegeFootballData.com (CFBD) HTTP helper -- auth/URL-building/response-validation
// logic for fetch-cfb-data.mjs (the once-daily heavy pipeline). Used to also be shared with
// fetch-live-scores.mjs (a frequent light poller of CFBD's /scoreboard endpoint) until CFBD put
// /scoreboard behind a paid Patreon tier -- that script's retired; live in-game score/clock for
// the homepage marquee now comes from a client-side ESPN fetch instead (src/utils/useLiveScores.js).

const CFBD_BASE = 'https://api.collegefootballdata.com';

const API_KEY = process.env.CFBD_API_KEY;
if (!API_KEY) {
  console.error(
    'ERROR: CFBD_API_KEY environment variable is not set.\n' +
    'Get a free key at https://collegefootballdata.com/key, then run:\n' +
    '  CFBD_API_KEY=xxxxxxxx node <script>',
  );
  process.exit(1);
}

export async function cfbdGet(path, params = {}) {
  const url = new URL(path, CFBD_BASE);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  let res;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${API_KEY}`, Accept: 'application/json' },
    });
  } catch (err) {
    throw new Error(`CFBD ${path} -- network error: ${err.message}`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`CFBD ${path} -> HTTP ${res.status} ${res.statusText}: ${body.slice(0, 500)}`);
  }
  const json = await res.json();
  if (!Array.isArray(json)) {
    throw new Error(`CFBD ${path} -- expected a JSON array, got ${typeof json}`);
  }
  return json;
}
