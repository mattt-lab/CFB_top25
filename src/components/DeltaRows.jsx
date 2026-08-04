import { WEEK_IDX_MAX } from '../data/teams.js';

export default function DeltaRows({ team }) {
  const rows = [
    { label: 'SP+', modelRank: team.sp },
    { label: 'FPI', modelRank: team.fpi },
    { label: 'Elo', modelRank: team.elo },
  ];
  const maxAbs = 8;
  const committeeRank = team.cfp[WEEK_IDX_MAX];

  return (
    <div className="delta-rows">
      {rows.map((r) => {
        const delta = committeeRank - r.modelRank;
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
