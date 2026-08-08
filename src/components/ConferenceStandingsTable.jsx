import { Link, useNavigate } from 'react-router-dom';
import {
  teamsInConf, confRecord, confSlugFor, rankAt, trendColor, deltaLabel, playoffOddsFor,
} from '../data/teams.js';
import TeamMark from './TeamMark.jsx';
import PinButton from './PinButton.jsx';

export default function ConferenceStandingsTable({ conf, weekIdx }) {
  const navigate = useNavigate();
  const rows = teamsInConf(conf)
    .map((t) => ({
      t,
      natRank: rankAt(t.id, weekIdx),
      prevRank: weekIdx > 0 ? rankAt(t.id, weekIdx - 1) : null,
      cRec: confRecord(t),
    }))
    // Conference record first (a standings table's whole point), national rank as the tiebreaker
    // for teams still level -- unranked teams sort last, same null-to-Infinity convention byRankAsc
    // uses elsewhere, just inlined here since this is a multi-key sort, not a single extracted rank.
    .sort((a, b) => {
      if (b.cRec.wins !== a.cRec.wins) return b.cRec.wins - a.cRec.wins;
      if (a.cRec.losses !== b.cRec.losses) return a.cRec.losses - b.cRec.losses;
      return (a.natRank ?? Infinity) - (b.natRank ?? Infinity);
    });

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table">
        <thead>
          <tr>
            <th></th><th>Rk</th><th>Team</th><th>Conf</th><th>Overall</th><th>Trend</th><th>Make CFP</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ t, natRank, prevRank, cRec }) => {
            // Every existing caller of rankAt-derived deltas only ever calls it for teams already
            // known ranked that week, so a null operand has never come up before -- this table is
            // the first to show UNRANKED teams, where a naive delta would coerce null to 0 and
            // render a false "improved" arrow for a team that actually just fell out of the poll
            // entirely. Only render a trend arrow when both weeks resolved to a real rank.
            const hasTrend = natRank != null && prevRank != null;
            const delta = hasTrend ? prevRank - natRank : 0;
            const po = natRank != null ? playoffOddsFor(natRank, t.record, t.sp) : null;
            return (
              <tr
                key={t.id}
                className="row-click"
                onClick={() => navigate(`/team/${t.id}`, { state: { from: 'conference', confSlug: confSlugFor(conf) } })}
              >
                <td><PinButton teamId={t.id} /></td>
                <td className="tabnum" style={{ fontWeight: 800 }}>{natRank ?? '—'}</td>
                <td>
                  <TeamMark team={t} />
                  <Link
                    className="team-link"
                    to={`/team/${t.id}`}
                    state={{ from: 'conference', confSlug: confSlugFor(conf) }}
                  >
                    {t.name}
                  </Link>
                </td>
                <td className="tabnum">{cRec.record}</td>
                <td className="tabnum">{t.record}</td>
                <td style={{ color: hasTrend ? trendColor(delta) : 'var(--muted)', fontWeight: 700 }}>
                  {hasTrend ? deltaLabel(delta) : '—'}
                </td>
                <td className="tabnum">{po != null ? `${po}%` : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
