import { Link } from 'react-router-dom';
import { useWeekStore } from '../store/useWeekStore.js';
import { WEEK_IDX_MAX, computeField, isDetailed } from '../data/teams.js';
import { BUBBLE_NOTES, PATH_SCENARIOS } from '../data/content.js';
import WeekTravelBar from '../components/WeekTravelBar.jsx';
import ConfDot from '../components/ConfDot.jsx';

function TeamRow({ o, seedNum }) {
  const detailed = isDetailed(o.id);
  const content = (
    <>
      <span className="n tabnum">{seedNum}</span>
      <span className="t"><ConfDot conf={o.team.conf} />{o.team.name}</span>
    </>
  );
  return detailed
    ? <Link className="matchup-row" to={`/team/${o.id}`} state={{ from: 'playoff' }}>{content}</Link>
    : <div className="matchup-row" style={{ cursor: 'default' }}>{content}</div>;
}

export default function PlayoffWatch() {
  const weekIdx = useWeekStore((s) => s.weekIdx);
  const field = computeField(weekIdx);
  const eyebrow = weekIdx === WEEK_IDX_MAX ? 'Week 12 Projection' : `Week ${weekIdx + 1} Projection (historical)`;

  const confs = Object.keys(field.champsByConf).sort(
    (a, b) => field.champsByConf[a].rank - field.champsByConf[b].rank
  );

  const pairs = [[0, 7], [1, 6], [2, 5], [3, 4]];

  return (
    <div>
      <WeekTravelBar />

      <div className="page-title">
        <div className="eyebrow">{eyebrow}</div>
        <h1>Playoff Watch</h1>
        <p>
          If the 12-team field were set today: four byes to the top conference champions, a 5th
          auto-bid, seven at-large, and who's still fighting for the last spots.
        </p>
      </div>

      <div className="bracket-label">Conference championship races</div>
      <div className="conf-race-grid">
        {confs.map((conf) => {
          const leader = field.champsByConf[conf];
          const inConf = field.allTeams
            .filter((o) => o.team.conf === conf)
            .sort((a, b) => a.rank - b.rank);
          const chaser = inConf.length > 1 ? inConf[1] : null;
          const gap = chaser ? chaser.rank - leader.rank : null;
          return (
            <div className="conf-race-card" key={conf}>
              <div className="cf">{conf}</div>
              <div className="ld"><ConfDot conf={conf} />#{leader.rank} {leader.team.name}</div>
              {chaser && <div className="ch">Chasing: #{chaser.rank} {chaser.team.name}</div>}
              <div className="nt">
                {chaser
                  ? `Leads #${chaser.rank} ${chaser.team.name} by ${gap} spot${gap === 1 ? '' : 's'} for the auto-bid.`
                  : `${leader.team.name} is the only ranked ${conf} team.`}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bracket-label">Seeds 1–4 — bye week (top 4 conference champions)</div>
      <div className="seed-grid">
        {field.byes.map((o, i) => {
          const detailed = isDetailed(o.id);
          const inner = (
            <>
              <div className="n">Seed {i + 1}</div>
              <div className="t"><ConfDot conf={o.team.conf} />{o.team.name}</div>
              <div className="c">{o.team.conf} champ · {o.team.record} · #{o.rank} overall</div>
              <div className="byetag">First-round bye · auto-bid</div>
            </>
          );
          return detailed ? (
            <Link className="seed-card" key={o.id} to={`/team/${o.id}`} state={{ from: 'playoff' }}>{inner}</Link>
          ) : (
            <div className="seed-card" key={o.id} style={{ cursor: 'default' }}>{inner}</div>
          );
        })}
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
          const detailed = isDetailed(o.id);
          const content = (
            <>
              <span className="rk tabnum">{seedNum}</span>
              <ConfDot conf={o.team.conf} />
              <span className="nm">{o.team.name}</span>
              <span className="needs">{BUBBLE_NOTES[seedNum] || ''}</span>
            </>
          );
          return detailed ? (
            <Link className="bubble-row" key={o.id} to={`/team/${o.id}`} state={{ from: 'playoff' }}>{content}</Link>
          ) : (
            <div className="bubble-row" key={o.id} style={{ cursor: 'default' }}>{content}</div>
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
        <ul className="pred-list">
          {PATH_SCENARIOS.map((p, i) => (
            <li key={i}><span className="ic">{i + 1}</span><span>{p}</span></li>
          ))}
        </ul>
      </section>

      <p className="footnote">
        Seeding applies the real CFP rule: the 4 highest-ranked conference champions get byes, a 5th
        champion gets a guaranteed at-large-seeded bid, and the rest fills by rank. Each conference's
        "champion" here is just its current highest-ranked team — real championship games haven't
        been played in this model.
      </p>
    </div>
  );
}
