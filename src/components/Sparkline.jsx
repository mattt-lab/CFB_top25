// Small inline trend sparkline (fixed 1-25 scale so magnitude is comparable across table rows).
export default function Sparkline({ points }) {
  const w = 64, h = 22;
  if (points.length < 2) return <span style={{ fontSize: 11, color: 'var(--muted)' }}>—</span>;

  const minR = 1, maxR = 25;
  const y = (v) => 2 + (h - 4) * ((v - minR) / (maxR - minR));
  const pts = points.map((v, i) => [(i / (points.length - 1)) * (w - 4) + 2, y(v)]);
  const d = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const last = pts[pts.length - 1];
  const improved = points[points.length - 1] < points[points.length - 2];
  const flat = points[points.length - 1] === points[points.length - 2];
  const dotColor = flat ? 'var(--muted)' : improved ? 'var(--good)' : 'var(--critical)';

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }} aria-hidden="true">
      <path d={d} fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0].toFixed(1)} cy={last[1].toFixed(1)} r="2.4" fill={dotColor} />
    </svg>
  );
}
