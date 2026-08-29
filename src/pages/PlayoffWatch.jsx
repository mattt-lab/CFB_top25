import { Link } from 'react-router-dom';
import { useWeekStore } from '../store/useWeekStore.js';
import {
  WEEK_IDX_MAX, computeField, primaryLabel, PRIMARY_SOURCE_BY_WEEK, fieldStorylines,
  confRaceInfo, confSlugFor,
} from '../data/teams.js';
import TeamMark from '../components/TeamMark.jsx';

function TeamRow({ o, seedNum }) {
  return (
    <Link className="matchup-row" to={`/team/${o.id}`} state={{ from: 'playoff' }}>
      <span className="n tabnum">{seedNum}</span>
      <span className="t"><TeamMark team={o.team} />{o.team.name}</span>
    </Link>
  );
}

export default function PlayoffWatch() {
  const weekIdx = useWeekStore((s) => s.weekIdx);
  const field = computeField(weekIdx);
  const weekSource = primaryLabel(PRIMARY_SOURCE_BY_WEEK[weekIdx]);
  // Same reasoning as Top25Tracker's eyebrow: the current-week poll source is already in the
  // sticky header, so only repeat it here when the snapshot is historical (source may differ).
  const eyebrow = weekIdx === WEEK_IDX_MAX
    ? `Week ${weekIdx + 1} Projection`
    : `Week ${weekIdx + 1} Projection (historical, by ${weekSource})`;

  const confs = Object.keys(field.champsByConf).sort(
    (a, b) => field.champsByConf[a].rank - field.champsByConf[b].rank
  );

  const pairs = [[0, 7], [1, 6], [2, 5], [3, 4]];

  return (
    <div>
      <div className="page-title">
        <div className="eyebrow">{eyebrow}</div>
        <h1>Playoff Watch</h1>
        <p>Who's in, who's got a bye, and who's still fighting for the last spot — if the field were set today.</p>
      </div>

      {/* Same "no committee yet" condition as the pre-committee footnote at the bottom of this
          page, so both agree for whichever week is actually being viewed (time-travel included)
          -- not a global "is it early in the season overall" flag, which wouldn't track a
          time-traveled week correctly. See PLAYOFF_PICTURE_IS_EARLY in teams.js for the nav tab's
          version of this, which IS global (time-travel doesn't apply to a persistent nav item). */}
      {weekSource !== 'CFP Committee' && (
        <div className="hist-banner">
          <span>
            ⚠ Too early to call — the CFP committee hasn't released a ranking yet, so every
            "champion" and seed below is just whichever team the {weekSource} happens to rank
            highest. Treat this as a rough early-season projection, not a real field.
          </span>
        </div>
      )}

      <div className="bracket-label">Conference championship races</div>
      <div className="conf-race-grid">
        {confs.map((conf) => {
          const { leader, chaser, gap } = confRaceInfo(conf, weekIdx);
          return (
            <Link className="conf-race-card" key={conf} to={`/conference/${confSlugFor(conf)}`}>
              <div className="cf">{conf}</div>
              <div className="ld"><span className="rank-prefix">#{leader.rank}</span><TeamMark team={leader.team} />{leader.team.name}</div>
              {chaser && <div className="ch">Chasing: #{chaser.rank} {chaser.team.name}</div>}
              <div className="nt">
                {chaser
                  ? `Leads #${chaser.rank} ${chaser.team.name} by ${gap} spot${gap === 1 ? '' : 's'} for the auto-bid.`
                  : `${leader.team.name} is the only ranked ${conf} team.`}
              </div>
            </Link>
          );
        })}
      </div>

      <div className="bracket-label">Seeds 1–4 — bye week (top 4 conference champions)</div>
      <div className="seed-grid">
        {field.byes.map((o, i) => (
          <Link className="seed-card" key={o.id} to={`/team/${o.id}`} state={{ from: 'playoff' }}>
            <div className="n">Seed {i + 1}</div>
            <div className="t"><TeamMark team={o.team} />{o.team.name}</div>
            <div className="c">{o.team.conf} champ · {o.team.record} · #{o.rank} overall</div>
            <div className="byetag">First-round bye · auto-bid</div>
          </Link>
        ))}
      </div>

      <div className="bracket-label">First round — seeds 5–12 (5th champion + 7 at-large)</div>
      <div className="matchup-grid">
        {pairs.map(([ai, bi]) => {
          const a = field.seeds5to12[ai], b = field.seeds5to12[bi];
          if (!a || !b) return null;
          return (
            <div className="matchup-card" key={ai}>
              <TeamRow o={a} seedNum={5 + ai} />
              <div className="matchup-vs">FIRST ROUND · ON CAMPUS</div>
              <TeamRow o={b} seedNum={5 + bi} />
            </div>
          );
        })}
      </div>

      <div className="bracket-label">On the bubble — seeds 13–16</div>
      <div className="bubble-list">
        {field.bubble.map((o, i) => {
          const seedNum = 13 + i;
          return (
            <Link className="bubble-row" key={o.id} to={`/team/${o.id}`} state={{ from: 'playoff' }}>
              <span className="rk tabnum">{seedNum}</span>
              <TeamMark team={o.team} />
              <span className="nm">{o.team.name}</span>
              <span className="needs">{o.team.bubbleNote?.blurb ?? ''}</span>
            </Link>
          );
        })}
      </div>

      <section className="card" style={{ marginTop: 24 }}>
        <div className="panel-title">
          <div>
            <h2>Path scenarios</h2>
            <p>What has to happen for the picture to change.</p>
          </div>
        </div>
        {fieldStorylines.length ? (
          <ul className="pred-list">
            {fieldStorylines.map((s, i) => (
              <li key={s.id}><span className="ic">{i + 1}</span><span>{s.blurb}</span></li>
            ))}
          </ul>
        ) : (
          <p style={{ fontSize: 12.5, color: 'var(--ink-2)', margin: 0 }}>
            No standout race gaps or bye/bubble-line collisions this week.
          </p>
        )}
      </section>

      <p className="footnote">
        Seeding applies the real CFP rule: the 4 highest-ranked conference champions get byes, a 5th
        champion gets a guaranteed at-large-seeded bid, and the rest fills by rank. Each conference's
        "champion" here is just its current highest-ranked team — real championship games haven't
        been played in this model.
        {weekSource !== 'CFP Committee' && (
          <> This week's ranking comes from the {weekSource} — the CFP committee hasn't released
          its first ranking of the season yet, so this is a projection, not an official field.</>
        )}
      </p>
    </div>
  );
}
