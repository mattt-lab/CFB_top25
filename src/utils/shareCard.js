import { playoffOddsFor, nattyOddsFor, americanOdds } from '../data/teams.js';

export function downloadShareCard(team) {
  const cs = getComputedStyle(document.documentElement);
  const page = cs.getPropertyValue('--page').trim();
  const ink = cs.getPropertyValue('--ink-1').trim();
  const ink2 = cs.getPropertyValue('--ink-2').trim();
  const accent = cs.getPropertyValue('--accent').trim();

  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 630;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = page; ctx.fillRect(0, 0, 1200, 630);
  ctx.fillStyle = accent; ctx.fillRect(0, 0, 1200, 10);

  ctx.fillStyle = ink2; ctx.font = '700 22px system-ui, sans-serif';
  ctx.fillText('CFB HQ · PLAYOFF WATCH', 60, 80);

  ctx.fillStyle = ink; ctx.font = '800 62px system-ui, sans-serif';
  ctx.fillText(team.name, 60, 195);

  ctx.fillStyle = ink2; ctx.font = '600 26px system-ui, sans-serif';
  ctx.fillText(`${team.conf} · ${team.record}`, 60, 235);

  // cfpRank is the resolved primary rank (CFP/Coaches/AP fallback) -- null for a team that isn't
  // currently ranked at all.
  const rank = team.cfpRank;
  ctx.fillStyle = accent; ctx.font = (rank != null ? '800 150px' : '800 80px') + ' system-ui, sans-serif';
  ctx.fillText(rank != null ? `#${rank}` : 'Unranked', 60, 410);

  ctx.fillStyle = ink; ctx.font = '700 30px system-ui, sans-serif';
  if (rank != null) {
    const po = playoffOddsFor(rank, team.record, team.sp);
    const no = nattyOddsFor(rank, team.record, team.sp, team.fpi);
    ctx.fillText(`Make CFP: ${po}%`, 60, 475);
    ctx.fillText(`Win it all: ${americanOdds(no)}`, 60, 518);
  } else {
    ctx.fillText('Not currently ranked', 60, 475);
  }

  ctx.fillStyle = ink2; ctx.font = '400 18px system-ui, sans-serif';
  ctx.fillText('Playoff & title odds are a simplified model, not sportsbook prices', 60, 590);

  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = `${team.name.toLowerCase().replace(/\s+/g, '-')}-cfb-hq-card.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
