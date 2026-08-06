import { Link } from 'react-router-dom';
import { POWER4_CONFS, confRaceInfo, confSlugFor, confSlug, WEEK_IDX_MAX } from '../data/teams.js';

export default function Conferences() {
  return (
    <div>
      <div className="page-title">
        <div className="eyebrow">Right now</div>
        <h1>Conferences</h1>
        <p>Standings, schedules, and the auto-bid race for each Power 4 conference.</p>
      </div>

      {/* Always the current week, regardless of any historical snapshot selected elsewhere on the
          site -- this is a directory, not a data view, and (deliberately) has no week selector of
          its own for the same reason PlayoffWatch/Top25Tracker do. Reading WEEK_IDX_MAX directly
          rather than the shared week-travel store avoids silently showing a stale past week if a
          visitor arrives here having time-traveled on another page first. */}
      <div className="seed-grid">
        {POWER4_CONFS.map((conf) => {
          const race = confRaceInfo(conf, WEEK_IDX_MAX);
          return (
            <Link className="seed-card" key={conf} to={`/conference/${confSlugFor(conf)}`}>
              <div className="n" style={{ color: `var(--conf-${confSlug(conf)})` }}>{conf}</div>
              <div className="t">{race ? `#${race.leader.rank} ${race.leader.team.name}` : 'No ranked teams yet'}</div>
              <div className="c">{race ? `${race.leader.team.record} · leads the conference` : ''}</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
