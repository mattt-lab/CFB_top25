import { Link } from 'react-router-dom';
import {
  WEEKLY_ORDER, teamById, deltaAt, sparkPoints,
  playoffOddsFor, nattyOddsFor, americanOdds, trendColor, deltaLabel,
  HAS_TREND_HISTORY, HAS_SP_RATINGS,
} from '../data/teams.js';
import ConfDot from './ConfDot.jsx';
import Sparkline from './Sparkline.jsx';
import PinButton from './PinButton.jsx';

function sparseCaption() {
  if (!HAS_TREND_HISTORY && !HAS_SP_RATINGS) {
    return 'Wk Δ, Trend, and SP+ will start appearing once more than one week of rankings exists and SP+ ratings are published for the season.';
  }
  if (!HAS_TREND_HISTORY) return 'Wk Δ and Trend will start appearing once more than one week of rankings exists.';
  if (!HAS_SP_RATINGS) return 'SP+ will start appearing once CFBD publishes ratings for the season.';
  return null;
}

export default function Top25Table({ weekIdx }) {
  const order = WEEKLY_ORDER[weekIdx];
  const caption = sparseCaption();

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table">
        {caption && <caption>{caption}</caption>}
        <thead>
          <tr>
            <th></th><th>Rk</th><th>Team</th><th>Record</th><th>Wk &Delta;</th><th>Trend</th>
            <th>SP+</th><th>Make CFP</th><th>Win it all</th>
          </tr>
        </thead>
        <tbody>
          {order.map((id, i) => {
            const rank = i + 1;
            const t = teamById(id);
            const delta = deltaAt(id, weekIdx);
            const po = playoffOddsFor(rank, t.record, t.sp);
            const no = nattyOddsFor(rank, t.record, t.sp, t.fpi);
            const color = trendColor(delta);

            return (
              <tr key={id} className="row-click">
                <td><PinButton teamId={id} /></td>
                <td className="tabnum" style={{ fontWeight: 800 }}>{rank}</td>
                <td>
                  <ConfDot conf={t.conf} />
                  <Link className="row-link" to={`/team/${id}`} state={{ from: 'top25' }}>{t.name}</Link>{' '}
                  <span style={{ color: 'var(--muted)', fontSize: 11 }}>{t.conf}</span>
                </td>
                <td className="tabnum">{t.record}</td>
                <td style={{ color, fontWeight: 700 }}>{deltaLabel(delta)}</td>
                <td><Sparkline points={sparkPoints(id, weekIdx)} /></td>
                <td className="tabnum">{t.sp != null ? `#${t.sp}` : '—'}</td>
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
