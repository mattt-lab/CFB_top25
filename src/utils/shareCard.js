import { playoffOddsFor, nattyOddsFor, americanOdds } from '../data/teams.js';

// Portrait 4:5 card (not a naive "stack more content below" of the old 1200x630 landscape card) --
// chosen specifically because 4:5 is the aspect ratio most chat/social apps (iMessage, Slack,
// X, Instagram) preview without cropping, so the whole card stays visible in a link/image preview.
const CARD_W = 1200;
const CARD_H = 1500;
const MARGIN_L = 60;
const MARGIN_R = 60;
const CONTENT_R = CARD_W - MARGIN_R; // 1140
const FONT = 'system-ui, sans-serif';

// --- small drawing helpers -------------------------------------------------

// Loads a same-origin logo image without ever rejecting -- a 404/network error just resolves to
// null so the caller can skip drawing it, matching the "skip entirely, don't block the rest of the
// card" requirement.
function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('canvas.toBlob() returned null'));
    }, 'image/png');
  });
}

// Shrinks font-weight/size until `text` fits `maxWidth`, down to a floor -- used for the team name
// so a long name can't run into the logo box.
function fitFont(ctx, text, maxWidth, startPx, minPx, weight) {
  let size = startPx;
  ctx.font = `${weight} ${size}px ${FONT}`;
  while (size > minPx && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${FONT}`;
  }
  return size;
}

// Truncates with an ellipsis (assumes ctx.font is already set to the font it'll be drawn in).
function truncateToWidth(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  const ellipsis = '…';
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate = text.slice(0, mid) + ellipsis;
    if (ctx.measureText(candidate).width <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return lo === 0 ? ellipsis : text.slice(0, lo) + ellipsis;
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// Reproduces the Gauge.jsx semicircle (SVG path `M 16 100 A 84 84 0 0 1 184 100`, strokeWidth 16,
// a --panel-2 track + a colored progress stroke) as a real canvas arc. In canvas's y-down space,
// angle Math.PI is the left end of the semicircle and 2*Math.PI is the right end, sweeping through
// the top -- matching the SVG path's left-to-right-over-the-top sweep, so `Math.PI + Math.PI *
// (pct/100)` is the exact canvas analog of the SVG's strokeDashoffset-based fill fraction.
function drawGauge(ctx, { cx, cy, r, lineWidth, pct, color, track, ink1, ink2, valueLabel, caption }) {
  const clamped = Math.max(0, Math.min(100, pct));

  ctx.lineCap = 'round';
  ctx.lineWidth = lineWidth;

  ctx.strokeStyle = track;
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, 2 * Math.PI);
  ctx.stroke();

  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, Math.PI + Math.PI * (clamped / 100));
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = ink1;
  ctx.font = '800 40px ' + FONT;
  ctx.fillText(valueLabel, cx, cy - 14);

  ctx.fillStyle = ink2;
  ctx.font = '600 16px ' + FONT;
  ctx.fillText(caption, cx, cy + 34);
  ctx.textAlign = 'left';
}

// Same tag -> label mapping as ResumeTable.jsx's noteFor() (not exported anywhere shared, so
// copied inline here on purpose).
function noteFor(g) {
  if (g.tag === 'quality') return 'Quality win';
  if (g.tag === 'bad') return 'Bad loss';
  return g.res === 'W' ? 'Expected result' : 'Loss';
}

export async function downloadShareCard(team) {
  const cs = getComputedStyle(document.documentElement);
  const get = (name) => cs.getPropertyValue(name).trim();
  const page = get('--page');
  const ink1 = get('--ink-1');
  const ink2 = get('--ink-2');
  const muted = get('--muted');
  const accent = get('--accent');
  const panel2 = get('--panel-2');
  const border = get('--border');
  const seriesCfp = get('--series-cfp');
  const divPos = get('--div-pos');
  const divNeg = get('--div-neg');
  const good = get('--good');
  const critical = get('--critical');

  // Logo is same-origin and static (public/logos/{id}.png) -- only fetched when the parallel data
  // change marked this team as having one. `import.meta.env.BASE_URL` matches the existing
  // precedent in TeamDetail.jsx (`${import.meta.env.BASE_URL}logos/${team.id}.png`), which already
  // accounts for the '/CFB_top25/' production base path set in vite.config.js.
  const logo = team.hasLogo
    ? await loadImage(`${import.meta.env.BASE_URL}logos/${team.id}.png`)
    : null;

  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = page;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, CARD_W, 10);

  // ---------------- Masthead (y = 0 - 650) ----------------

  const LOGO_SIZE = 170;
  const LOGO_X = CONTENT_R - LOGO_SIZE; // 970
  const LOGO_Y = 40;
  if (logo) {
    ctx.drawImage(logo, LOGO_X, LOGO_Y, LOGO_SIZE, LOGO_SIZE);
  }

  ctx.fillStyle = ink2;
  ctx.font = '700 22px ' + FONT;
  ctx.fillText('CFB HQ · PLAYOFF WATCH', MARGIN_L, 80);

  const nameMaxWidth = LOGO_X - MARGIN_L - 30; // keep clear of the logo box
  fitFont(ctx, team.name, nameMaxWidth, 56, 30, 800);
  ctx.fillStyle = ink1;
  ctx.fillText(team.name, MARGIN_L, 165);

  ctx.fillStyle = ink2;
  ctx.font = '600 24px ' + FONT;
  ctx.fillText(`${team.conf} · ${team.record}`, MARGIN_L, 205);

  const rank = team.cfpRank;
  ctx.fillStyle = accent;
  ctx.font = (rank != null ? '800 150px' : '800 70px') + ' ' + FONT;
  ctx.fillText(rank != null ? `#${rank}` : 'Unranked', MARGIN_L, 372);

  if (rank != null) {
    const po = playoffOddsFor(rank, team.record, team.sp);
    const no = nattyOddsFor(rank, team.record, team.sp, team.fpi);

    const GAUGE_CY = 560;
    const GAUGE_R = 108;
    const GAUGE_LW = 24;

    drawGauge(ctx, {
      cx: 330, cy: GAUGE_CY, r: GAUGE_R, lineWidth: GAUGE_LW,
      pct: po, color: accent, track: panel2, ink1, ink2,
      valueLabel: `${po}%`, caption: 'Make the 12-team field',
    });
    drawGauge(ctx, {
      cx: 890, cy: GAUGE_CY, r: GAUGE_R, lineWidth: GAUGE_LW,
      pct: no, color: seriesCfp, track: panel2, ink1, ink2,
      valueLabel: `${no.toFixed(1)}%`, caption: 'Win the national title',
    });

    ctx.textAlign = 'center';
    ctx.fillStyle = ink2;
    ctx.font = '500 16px ' + FONT;
    ctx.fillText(`Title odds ≈ ${americanOdds(no)} american`, CARD_W / 2, GAUGE_CY + 64);
    ctx.textAlign = 'left';
  } else {
    ctx.fillStyle = ink1;
    ctx.font = '700 32px ' + FONT;
    ctx.fillText('Not currently ranked', MARGIN_L, 460);
  }

  // ---------------- Divider ----------------

  ctx.strokeStyle = border;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(MARGIN_L, 650);
  ctx.lineTo(CONTENT_R, 650);
  ctx.stroke();

  // ---------------- Body (y = 692 - 1122): two columns ----------------

  const LEFT_X = MARGIN_L; // 60
  const LEFT_R = 580;
  const RIGHT_X = 620;
  const RIGHT_R = CONTENT_R; // 1140

  ctx.fillStyle = muted;
  ctx.font = '700 15px ' + FONT;
  ctx.fillText('RANK DIFFERENTIAL', LEFT_X, 692);
  ctx.fillText('LAST 6 GAMES', RIGHT_X, 692);

  // LEFT: DeltaRows.jsx reproduction -- SP+/FPI/Elo diverging bars off a center line.
  const deltaRows = [
    { label: 'SP+', modelRank: team.sp },
    { label: 'FPI', modelRank: team.fpi },
    { label: 'Elo', modelRank: team.elo },
  ];
  const MAX_ABS = 8;
  const TRACK_X = LEFT_X + 90; // 150
  const TRACK_W = 280; // ends at 430
  const TRACK_MID = TRACK_X + TRACK_W / 2; // 290
  const ROW_H = 88;

  deltaRows.forEach((row, i) => {
    const rowTop = 722 + i * ROW_H;
    const trackY = rowTop + 26;
    const trackH = 22;
    const labelBaseline = rowTop + 40;
    const numBaseline = rowTop + 42;

    ctx.fillStyle = ink2;
    ctx.font = '700 16px ' + FONT;
    ctx.fillText(row.label, LEFT_X, labelBaseline);

    ctx.fillStyle = panel2;
    roundRectPath(ctx, TRACK_X, trackY, TRACK_W, trackH, 5);
    ctx.fill();
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    roundRectPath(ctx, TRACK_X, trackY, TRACK_W, trackH, 5);
    ctx.stroke();

    ctx.strokeStyle = border;
    ctx.beginPath();
    ctx.moveTo(TRACK_MID, trackY);
    ctx.lineTo(TRACK_MID, trackY + trackH);
    ctx.stroke();

    ctx.textAlign = 'right';
    if (rank == null || row.modelRank == null) {
      ctx.fillStyle = muted;
      ctx.font = '700 18px ' + FONT;
      ctx.fillText('—', LEFT_R - 20, numBaseline);
    } else {
      const delta = rank - row.modelRank;
      const barLen = Math.min(1, Math.abs(delta) / MAX_ABS) * (TRACK_W / 2);
      const color = delta > 0 ? divPos : delta < 0 ? divNeg : muted;
      ctx.fillStyle = color;
      if (delta >= 0) {
        roundRectPath(ctx, TRACK_MID, trackY + 2, barLen, trackH - 4, 3);
      } else {
        roundRectPath(ctx, TRACK_MID - barLen, trackY + 2, barLen, trackH - 4, 3);
      }
      ctx.fill();

      ctx.fillStyle = color;
      ctx.font = '700 18px ' + FONT;
      ctx.fillText(`${delta > 0 ? '+' : ''}${delta}`, LEFT_R - 20, numBaseline);
    }
    ctx.textAlign = 'left';
  });

  // RIGHT: ResumeTable.jsx reproduction -- last 6 games (week, opponent[+rank], W/L, note).
  if (!team.games || team.games.length === 0) {
    ctx.fillStyle = ink2;
    ctx.font = '400 16px ' + FONT;
    ctx.fillText(`No game-by-game data available for ${team.name} yet.`, RIGHT_X, 760);
  } else {
    const recentGames = team.games.slice(-6);
    const COL_WK = RIGHT_X;
    const COL_OPP = RIGHT_X + 46; // 666
    const COL_RESULT = 930;
    const COL_NOTE = 985;

    ctx.fillStyle = muted;
    ctx.font = '700 12px ' + FONT;
    ctx.fillText('WK', COL_WK, 722);
    ctx.fillText('OPPONENT', COL_OPP, 722);
    ctx.fillText('RESULT', COL_RESULT, 722);
    ctx.fillText('NOTE', COL_NOTE, 722);

    const G_ROW_H = 62;
    recentGames.forEach((g, i) => {
      const rowTop = 750 + i * G_ROW_H;
      const baseline = rowTop + 30;

      ctx.fillStyle = ink1;
      ctx.font = '700 15px ' + FONT;
      ctx.fillText(String(g.wk), COL_WK, baseline);

      ctx.font = '600 15px ' + FONT;
      const oppMax = COL_RESULT - COL_OPP - 14;
      const oppText = truncateToWidth(ctx, g.opp, g.oppRank ? oppMax - 40 : oppMax);
      ctx.fillStyle = ink1;
      ctx.fillText(oppText, COL_OPP, baseline);
      if (g.oppRank) {
        const oppWidth = ctx.measureText(oppText).width;
        ctx.fillStyle = muted;
        ctx.font = '600 15px ' + FONT;
        ctx.fillText(` #${g.oppRank}`, COL_OPP + oppWidth, baseline);
      }

      ctx.fillStyle = g.res === 'W' ? good : critical;
      ctx.font = '800 14px ' + FONT;
      ctx.fillText(g.res, COL_RESULT, baseline);

      const note = noteFor(g);
      ctx.font = '600 13px ' + FONT;
      const noteMax = CONTENT_R - COL_NOTE - 10;
      const noteText = truncateToWidth(ctx, note, noteMax);
      ctx.fillStyle = g.tag === 'quality' ? good : g.tag === 'bad' ? critical : muted;
      ctx.fillText(noteText, COL_NOTE, baseline);

      ctx.strokeStyle = border;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(RIGHT_X, rowTop + 58);
      ctx.lineTo(RIGHT_R, rowTop + 58);
      ctx.stroke();
    });
  }

  // ---------------- Footer (y = 1400 - 1500) ----------------

  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(MARGIN_L, 1400);
  ctx.lineTo(CONTENT_R, 1400);
  ctx.stroke();

  ctx.fillStyle = ink2;
  ctx.font = '400 18px ' + FONT;
  ctx.fillText('Playoff & title odds are a simplified model, not sportsbook prices', MARGIN_L, 1445);

  // toBlob + object URL rather than toDataURL -- large base64 data URIs are handled unreliably by
  // mobile Safari's download flow; a blob URL is the more robust pattern there.
  const blob = await canvasToBlob(canvas);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${team.name.toLowerCase().replace(/\s+/g, '-')}-cfb-hq-card.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
