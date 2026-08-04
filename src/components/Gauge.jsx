const CIRCUMFERENCE = 264;

export default function Gauge({ pct, color, valueLabel, caption }) {
  const offset = CIRCUMFERENCE - (CIRCUMFERENCE * Math.max(0, Math.min(100, pct))) / 100;
  return (
    <div className="gauge-single">
      <svg viewBox="0 0 200 110" width="100%" style={{ marginTop: 6 }}>
        <path d="M 16 100 A 84 84 0 0 1 184 100" fill="none" stroke="var(--panel-2)" strokeWidth="16" strokeLinecap="round" />
        <path
          d="M 16 100 A 84 84 0 0 1 184 100"
          fill="none"
          stroke={color}
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset .6s ease' }}
        />
      </svg>
      <div className="gauge-pct tabnum">{valueLabel}</div>
      <div className="gauge-lbl">{caption}</div>
    </div>
  );
}
