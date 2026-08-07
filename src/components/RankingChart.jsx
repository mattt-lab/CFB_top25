import { useState } from 'react';
import {
  LineChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { WEEKS, HAS_TREND_HISTORY } from '../data/teams.js';
import { pollSpread } from '../utils/pollSpread.js';

const SERIES = [
  { key: 'ap', label: 'AP Poll', color: 'var(--series-ap)' },
  { key: 'coaches', label: 'Coaches Poll', color: 'var(--series-coaches)' },
  { key: 'cfp', label: 'CFP Committee', color: 'var(--series-cfp)' },
];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="chart-tooltip" style={{ position: 'static', opacity: 1, transform: 'none' }}>
      <b>Week {label}</b>
      {SERIES.map((s) => {
        const entry = payload.find((p) => p.dataKey === s.key);
        const v = entry ? entry.value : null;
        return (
          <div className="row" key={s.key}>
            <span><span className="sw" style={{ background: s.color }} />{s.label}</span>
            <span>{v == null ? '—' : `#${v}`}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function RankingChart({ team }) {
  const [showTable, setShowTable] = useState(false);
  const data = WEEKS.map((wk, i) => ({
    week: wk,
    ap: team.ap[i] ?? null,
    coaches: team.coaches[i] ?? null,
    cfp: team.cfp[i] ?? null,
    // [min, max] of whichever polls rank the team this week (null = unranked everywhere) --
    // recharts v3 draws an <Area> with an array dataKey as a range band between the two values.
    spread: pollSpread(team, i),
  }));

  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <div className="panel-title">
        <div>
          <h2>Ranking history — AP, Coaches &amp; CFP Committee</h2>
          <p>
            Weekly poll position across the season. Committee rankings begin week 7. Shaded band
            shows the spread between the highest and lowest poll.
          </p>
        </div>
        {HAS_TREND_HISTORY && (
          <button
            type="button"
            className="toggle-btn"
            aria-pressed={showTable}
            onClick={() => setShowTable((v) => !v)}
          >
            {showTable ? 'View as chart' : 'View as table'}
          </button>
        )}
      </div>

      {!HAS_TREND_HISTORY ? (
        <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: 0 }}>
          Ranking history builds up as the season progresses — check back after week 2.
        </p>
      ) : (
      <>
      <div className="legend">
        {SERIES.map((s) => (
          <span className="item" key={s.key}>
            <span className="sw" style={{ background: s.color }} />{s.label}
          </span>
        ))}
        {/* Swatch opacity sits above the band's 0.15 fill so it's legible at legend size,
            while still reading as "the faint one" next to the three solid line swatches. */}
        <span className="item">
          <span className="sw" style={{ background: 'var(--muted)', opacity: 0.4 }} />Poll spread
        </span>
      </div>

      {showTable ? (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <caption>Weekly poll position by week</caption>
            <thead><tr><th>Week</th><th>AP</th><th>Coaches</th><th>CFP Committee</th></tr></thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.week}>
                  <td>{row.week}</td>
                  <td className="tabnum">{row.ap ?? '—'}</td>
                  <td className="tabnum">{row.coaches ?? '—'}</td>
                  <td className="tabnum">{row.cfp ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="chart-wrap" style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid stroke="var(--grid)" vertical={false} />
              <XAxis
                dataKey="week"
                tickFormatter={(w) => `W${w}`}
                tick={{ fontSize: 10, fill: 'var(--muted)' }}
                axisLine={{ stroke: 'var(--grid)' }}
                tickLine={false}
              />
              <YAxis
                // Ranks legitimately run 1-25 (Top 25 polls) -- a domain capped at 20 was
                // clipping/hiding any week a team spent ranked #21-25, which is a completely
                // normal thing for a team hovering near the bottom of the poll.
                domain={[1, 25]}
                reversed
                ticks={[1, 5, 10, 15, 20, 25]}
                tick={{ fontSize: 10, fill: 'var(--muted)' }}
                axisLine={false}
                tickLine={false}
                width={22}
              />
              <Tooltip content={<CustomTooltip />} />
              {/* Range band spanning min->max of whichever polls rank the team each week --
                  first in JSX order so it renders UNDER the three lines. The reversed [1, 25]
                  YAxis handles the [min, max] pair fine (recharts just fills between the two
                  scaled positions -- range mode is triggered by the array value itself, no
                  extra prop); connectNulls matches the Lines' own gap behavior, and
                  CustomTooltip ignores this series (it only looks up SERIES dataKeys). */}
              <Area
                dataKey="spread"
                fill="var(--muted)"
                fillOpacity={0.15}
                stroke="none"
                activeDot={false}
                connectNulls
              />
              {SERIES.map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  stroke={s.color}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      </>
      )}
    </section>
  );
}
