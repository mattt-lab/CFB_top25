export default function DeltaRows({ team }) {
  const rows = [
    { label: 'SP+', modelRank: team.sp },
    { label: 'FPI', modelRank: team.fpi },
    { label: 'Elo', modelRank: team.elo },
  ];
  const maxAbs = 8;
  // cfpRank is the resolved primary rank (CFP/Coaches/AP fallback) -- both this and any of the
  // computer ratings can be null early in a season (confirmed live: 2026 preseason has no SP+ or
  // Elo published yet), so each row degrades independently rather than computing a delta against
  // a missing number.
  const primaryRank = team.cfpRank;

  return (
    <div className="delta-rows">
      {rows.map((r) => {
        if (primaryRank == null || r.modelRank == null) {
          return (
            <div className="delta-row" key={r.label}>
              <div className="lbl">{r.label}</div>
              <div className="delta-track"><div className="mid" /></div>
              <div className="num" style={{ color: 'var(--muted)' }}>—</div>
            </div>
          );
        }
        const delta = primaryRank - r.modelRank;
        const pct = Math.min(1, Math.abs(delta) / maxAbs) * 50;
        const color = delta > 0 ? 'var(--div-pos)' : delta < 0 ? 'var(--div-neg)' : 'var(--muted)';
        const barStyle = delta >= 0
          ? { left: 'calc(50% + 1px)', width: `${pct}%`, background: color }
          : { right: 'calc(50% + 1px)', width: `${pct}%`, background: color };
        return (
          <div className="delta-row" key={r.label}>
            <div className="lbl">{r.label}</div>
            <div className="delta-track">
              <div className="mid" />
              <div className="bar" style={barStyle} />
            </div>
            <div className="num" style={{ color }}>{delta > 0 ? '+' : ''}{delta}</div>
          </div>
        );
      })}
    </div>
  );
}
