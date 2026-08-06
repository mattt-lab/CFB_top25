// Shared CollegeFootballData.com (CFBD) HTTP helper -- identical auth/URL-building/response-
// validation logic needed by both fetch-cfb-data.mjs (the once-daily heavy pipeline) and
// fetch-live-scores.mjs (the frequent light poller), pulled out so a fix here doesn't need to be
// applied twice.

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
