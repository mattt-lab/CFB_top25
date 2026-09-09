import { Link, useNavigate } from 'react-router-dom';
import {
  WEEKLY_ORDER, WEEK_IDX_MAX, teamById, deltaAt, sparkPoints,
  playoffOddsFor, nattyOddsFor, americanOdds, trendColor, deltaLabel,
  HAS_TREND_HISTORY,
} from '../data/teams.js';
import TeamMark from './TeamMark.jsx';
import Sparkline from './Sparkline.jsx';
import PinButton from './PinButton.jsx';

function sparseCaption() {
  if (!HAS_TREND_HISTORY) return 'Wk Δ and Trend will start appearing once more than one week of rankings exists.';
  return null;
}

export default function Top25Table() {
  const navigate = useNavigate();
  const order = WEEKLY_ORDER[WEEK_IDX_MAX];
  const caption = sparseCaption();

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table">
        {caption && <caption>{caption}</caption>}
        <thead>
          <tr>
            <th></th><th>Rk</th><th>Team</th><th>Record</th><th>Wk &Delta;</th><th>Trend</th>
            <th>Make CFP</th><th>Win it all</th>
          </tr>
        </thead>
        <tbody>
          {order.map((id, i) => {
            const rank = i + 1;
            const t = teamById(id);
            // null means the team debuted in the poll this week (no real previous rank to diff
            // against) -- render NEW rather than feeding null through arrowGlyph/deltaLabel, which
            // would otherwise misrender it as a false flat "-0" (see deltaAt's own doc comment).
            const delta = deltaAt(id, WEEK_IDX_MAX);
            const po = playoffOddsFor(rank, t.record, t.sp);
            const no = nattyOddsFor(rank, t.record, t.sp, t.fpi);
            const color = delta == null ? 'var(--muted)' : trendColor(delta);

            return (
              <tr
                key={id}
                className="row-click"
                onClick={() => navigate(`/team/${id}`, { state: { from: 'top25' } })}
              >
                <td><PinButton teamId={id} /></td>
                <td className="tabnum" style={{ fontWeight: 800 }}>{rank}</td>
                <td>
                  <TeamMark team={t} />
                  <Link className="team-link" to={`/team/${id}`} state={{ from: 'top25' }}>{t.name}</Link>{' '}
                  <span style={{ color: 'var(--muted)', fontSize: 11 }}>{t.conf}</span>
                </td>
                <td className="tabnum">{t.record}</td>
                <td style={{ color, fontWeight: 700 }}>{delta == null ? 'NEW' : deltaLabel(delta)}</td>
                <td><Sparkline points={sparkPoints(id, WEEK_IDX_MAX)} /></td>
                <td className="tabnum">{po}%</td>
                <td className="tabnum">{americanOdds(no)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
