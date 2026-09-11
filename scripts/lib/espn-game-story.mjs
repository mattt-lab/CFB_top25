// Extracts narration-worthy facts from ESPN's summary?event= response (college-football summary
// endpoint -- confirmed live 2026-09-11 it returns the same shape as the NFL version: a real
// AP-sourced recap article once a game is final, and a win-probability predictor while it's still
// scheduled). Mirrors the Seahawks_HQ sibling project's buildGameStory() (same source, same
// derivation), adapted for CFB's summary shape, which was verified independently here rather than
// assumed identical.

function stripHtml(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

// Real structured facts about a completed game. `drives.previous[].result` is a real enum
// (PUNT/TD/FG/END OF HALF/END OF GAME/DOWNS/FUMBLE RETURN TD/...) confirmed live against a real
// 2026 game; counting INT/FUM results per drive's own team gives a verified, non-copyrighted
// turnover count. KNOWN LIMITATION inherited from the same logic in Seahawks_HQ: a "FUMBLE RETURN
// TD" drive is attributed to the RECOVERING team (the one that just scored), not the team that
// lost the ball -- an turnover in that exact shape is not counted for the team that committed it.
// Rare enough (and the consequence -- a turnover count off by one on an unusual play) that it
// isn't worth a special case here.
//
// articleStory is kept ONLY as reference material for narrate.mjs's prompt to summarize in
// Claude's own words -- never surfaced verbatim on the site itself.
export function buildGameStory(summary) {
  const drives = summary?.drives?.previous ?? [];
  const turnoversByTeam = {};
  for (const d of drives) {
    if (/INT|FUM/i.test(d.result ?? '')) {
      const abbr = d.team?.abbreviation;
      if (abbr) turnoversByTeam[abbr] = (turnoversByTeam[abbr] ?? 0) + 1;
    }
  }
  const scoringPlays = (summary?.scoringPlays ?? []).map((p) => ({
    team: p.team?.abbreviation ?? null,
    text: p.text ?? null,
    period: p.period?.number ?? null,
  }));
  const article = summary?.article;
  return {
    turnoversByTeam,
    scoringPlays,
    articleHeadline: article?.headline ?? null,
    articleDescription: article?.description ?? null,
    articleStory: article?.story ? stripHtml(article.story).slice(0, 1500) : null,
  };
}

// True if buildGameStory() found anything actually worth narrating from -- ESPN hasn't always
// published its recap article/scoring detail the moment a game goes final, so an empty result
// here means "try again next run," not "there's nothing to say."
export function hasGameStory(gameStory) {
  return Boolean(
    gameStory.articleStory || gameStory.articleDescription || gameStory.scoringPlays.length,
  );
}

// Win-probability context for a still-scheduled game, from ESPN's own "Matchup Predictor" --
// confirmed live it's a real, if simple, model (e.g. "LOU 98.3%, VILL 1.7%" for a 38.5-point
// favorite). Verified BY ESPN TEAM ID against our own away/home assignment rather than trusted by
// position -- a neutral-site game is the one real case where ESPN's home/away could plausibly
// disagree with CFBD's, and guessing wrong here would put the win probability on the wrong team.
// Returns null (not a guess) if either side doesn't check out.
export function buildPregameContext(summary, awayEspnId, homeEspnId) {
  const predictor = summary?.predictor;
  const home = predictor?.homeTeam;
  const away = predictor?.awayTeam;
  if (!home?.gameProjection || !away?.gameProjection) return null;
  if (String(home.id) !== String(homeEspnId) || String(away.id) !== String(awayEspnId)) return null;
  const homeWinPct = Number(home.gameProjection);
  const awayWinPct = Number(away.gameProjection);
  if (!Number.isFinite(homeWinPct) || !Number.isFinite(awayWinPct)) return null;
  return { homeWinPct, awayWinPct };
}
