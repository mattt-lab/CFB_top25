import { useNavigate } from 'react-router-dom';
import {
  WEEKLY_ORDER, teamById, deltaAt, sparkPoints,
  tierFor, playoffOddsFor, nattyOddsFor, americanOdds, arrowGlyph,
} from '../data/teams.js';
import ConfDot from './ConfDot.jsx';
import Sparkline from './Sparkline.jsx';
import TierBadge from './TierBadge.jsx';
import PinButton from './PinButton.jsx';

export default function Top25Table({ weekIdx }) {
  const navigate = useNavigate();
  const order = WEEKLY_ORDER[weekIdx];

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table">
        <thead>
          <tr>
            <th></th><th>Rk</th><th>Team</th><th>Record</th><th>Wk &Delta;</th><th>Trend</th>
            <th>SP+</th><th>Status</th><th>Make CFP</th><th>Win it all</th>
          </tr>
        </thead>
        <tbody>
          {order.map((id, i) => {
            const rank = i + 1;
            const t = teamById(id);
            const delta = deltaAt(id, weekIdx);
            const tier = tierFor(rank);
            const po = playoffOddsFor(rank, t.record, t.sp);
            const no = nattyOddsFor(rank, t.record, t.sp, t.fpi);
            const color = delta > 0 ? 'var(--good)' : delta < 0 ? 'var(--critical)' : 'var(--muted)';

            return (
              <tr
                key={id}
                className="row-click"
                onClick={() => navigate(`/team/${id}`, { state: { from: 'top25' } })}
              >
                <td><PinButton teamId={id} /></td>
                <td className="tabnum" style={{ fontWeight: 800 }}>{rank}</td>
                <td>
                  <ConfDot conf={t.conf} />{t.name}{' '}
                  <span style={{ color: 'var(--muted)', fontSize: 11 }}>{t.conf}</span>
                </td>
                <td className="tabnum">{t.record}</td>
                <td style={{ color, fontWeight: 700 }}>{arrowGlyph(delta)}{delta !== 0 ? Math.abs(delta) : ''}</td>
                <td><Sparkline points={sparkPoints(id, weekIdx)} /></td>
                <td className="tabnum">#{t.sp}</td>
                <td><TierBadge tier={tier} /></td>
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
