import { Link } from 'react-router-dom';
import { WEEKLY_ORDER, WEEK_IDX_MAX, teamById, deltaAt, arrowGlyph } from '../data/teams.js';

export default function TeamLadder({ currentId }) {
  const order = WEEKLY_ORDER[WEEK_IDX_MAX].slice(0, 12);

  return (
    <section className="ladder-section">
      <div className="eyebrow-lbl" style={{ margin: '0 0 8px' }}>Top 12 (current) — tap a team</div>
      <div className="ladder" role="listbox" aria-label="CFP top 12 teams">
        {order.map((id, i) => {
          const rank = i + 1;
          const t = teamById(id);
          const delta = deltaAt(id, WEEK_IDX_MAX);
          const dir = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
          const inner = (
            <>
              <span className="rk tabnum">{rank}</span>
              <span className="nm">{t.name}</span>
              <span className={`dl ${dir}`}>{arrowGlyph(delta)}{delta !== 0 ? Math.abs(delta) : ''}</span>
            </>
          );
          return (
            <Link
              key={id}
              className="chip"
              to={`/team/${id}`}
              role="option"
              aria-pressed={id === currentId}
            >
              {inner}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
