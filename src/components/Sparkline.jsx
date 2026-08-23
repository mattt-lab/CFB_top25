import { trendColor } from '../data/teams.js';

// Small inline trend sparkline (fixed 1-25 scale so magnitude is comparable across table rows).
export default function Sparkline({ points }) {
  const w = 64, h = 22;
  const known = points.filter((v) => v != null);
  if (known.length < 2) return <span style={{ fontSize: 11, color: 'var(--muted)' }}>—</span>;

  const minR = 1, maxR = 25;
  const y = (v) => 2 + (h - 4) * ((v - minR) / (maxR - minR));
  // A team not yet ranked in an early week leaves a null gap in `points` -- skip those weeks
  // rather than letting null coerce to 0 below, which would otherwise plot a false near-#1 point
  // instead of leaving a gap in the line. x-position still derives from the original index so
  // spacing stays proportional to the full week range, not just the known points.
  const pts = points
    .map((v, i) => (v == null ? null : [(i / (points.length - 1)) * (w - 4) + 2, y(v)]))
    .filter((p) => p != null);
  const d = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const last = pts[pts.length - 1];
  // Previous-minus-current rank, matching deltaAt()'s sign convention (positive = improved).
  // Guarded the same way -- a gap immediately before the current week means there's no trend to show.
  const prevWeek = points[points.length - 2];
  const currWeek = points[points.length - 1];
  const hasTrend = prevWeek != null && currWeek != null;
  const delta = hasTrend ? prevWeek - currWeek : 0;
  const dotColor = hasTrend ? trendColor(delta) : 'var(--muted)';

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }} aria-hidden="true">
      <path d={d} fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0].toFixed(1)} cy={last[1].toFixed(1)} r="2.4" fill={dotColor} />
    </svg>
  );
}
