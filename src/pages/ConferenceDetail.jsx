import { useParams, Navigate, Link } from 'react-router-dom';
import { useWeekStore } from '../store/useWeekStore.js';
import {
  confByRouteSlug, confRaceInfo, gamesInConf, games, fieldStorylines, computeField,
  gameStatusBadge, formatKickoff,
} from '../data/teams.js';
import ConferenceStandingsTable from '../components/ConferenceStandingsTable.jsx';
import TeamMark from '../components/TeamMark.jsx';

// Deterministic fallback for the auto-bid race line, matching the same sentence shape
// narrate.mjs's fallbackFieldStorylineBlurb uses server-side -- used when this conference's
// conf-race-gap storyline got cut by the sitewide top-4 cap on fieldStorylines (confirmed live:
// happens whenever a conference's leader/chaser gap is >=10, independent of the cap itself).
function raceLine(conf, race) {
  if (!race) return `No ${conf} teams currently ranked.`;
  const { leader, chaser, gap } = race;
  if (!chaser) return `${leader.team.name} is the only ranked ${conf} team.`;
  return `#${leader.rank} ${leader.team.name} leads #${chaser.rank} ${chaser.team.name} by `
    + `${gap} spot${gap === 1 ? '' : 's'} for the auto-bid.`;
}

export default function ConferenceDetail() {
  const { confSlug } = useParams();
  const weekIdx = useWeekStore((s) => s.weekIdx);
  const conf = confByRouteSlug(confSlug);
  if (!conf) return <Navigate to="/conferences" replace />;

  const race = confRaceInfo(conf, weekIdx);
  const storyline = fieldStorylines.find((s) => s.type === 'conf-race-gap' && s.conf === conf);

  // Marquee games (games[]) already have an LLM/fallback blurb from the normal pipeline -- reuse
  // it here rather than leaving a blank line, for exactly the games a visitor is most likely to
  // recognize. Every other game in the conference's full slate intentionally gets no blurb (see
  // the live-score architecture plan: narrating everyone's full weekly schedule would meaningfully
  // multiply Claude calls for a once-daily job, for text that mostly restates what the card already
  // shows).
  const marqueeBlurbByCfbdId = new Map(games.map((g) => [g.cfbdId, g.blurb]));
  const schedule = gamesInConf(conf).slice().sort((a, b) => new Date(a.when) - new Date(b.when));

  const field = computeField(weekIdx);
  const inField = {
    byes: field.byes.filter((o) => o.team.conf === conf),
    seeds5to12: field.seeds5to12.filter((o) => o.team.conf === conf),
    bubble: field.bubble.filter((o) => o.team.conf === conf),
  };
  const fieldCount = inField.byes.length + inField.seeds5to12.length + inField.bubble.length;

  return (
    <div>
      <div className="page-title">
        <div className="eyebrow">Conference Tracker</div>
        <h1>{conf}</h1>
        <p>Standings, this week's full schedule, and the auto-bid race, all in one place.</p>
      </div>

      <p style={{ fontSize: 13.5, color: 'var(--ink-2)', margin: '0 0 20px' }}>
        {storyline?.blurb || raceLine(conf, race)}
      </p>

      <div className="bracket-label">This week's {conf} games</div>
      {schedule.length ? (
        <div className="games-grid">
          {schedule.map((g) => {
            const badge = gameStatusBadge(g.status, g.period, g.clock);
            const decided = g.status === 'in_progress' || g.status === 'final';
            const blurb = marqueeBlurbByCfbdId.get(g.cfbdId);
            return (
              <div className="game-card" key={g.id}>
                <div className="game-meta">
                  {badge.text ? (
                    <span className={`badge-status${badge.live ? ' badge-live' : ' badge-final'}`}>
                      {badge.live && <span className="pulse-dot" aria-hidden="true" />}
                      {badge.text}{badge.detail && ` · ${badge.detail}`}
                    </span>
                  ) : (
                    formatKickoff(g.when)
                  )}
                  {g.network && <span> · {g.network}</span>}
                  {g.rivalry && <span className="tag rivalry" style={{ marginLeft: 8 }}>Rivalry</span>}
                </div>
                <div className="game-teams">
                  <Link className="game-team" to={`/team/${g.away}`}>
                    {g.awayRank != null && <span className="r">#{g.awayRank}</span>}
                    {g.awayTeam && <TeamMark team={g.awayTeam} />}
                    {g.awayTeam?.name ?? g.away}
                    {g.awayTeam?.record && (
                      <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 12 }}> ({g.awayTeam.record})</span>
                    )}
                  </Link>
                  <div className="game-at">at</div>
                  <Link className="game-team" to={`/team/${g.home}`}>
                    {g.homeRank != null && <span className="r">#{g.homeRank}</span>}
                    {g.homeTeam && <TeamMark team={g.homeTeam} />}
                    {g.homeTeam?.name ?? g.home}
                    {g.homeTeam?.record && (
                      <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 12 }}> ({g.homeTeam.record})</span>
                    )}
                  </Link>
                </div>
                <div className="game-line">
                  {decided ? (
                    <span className="score">
                      {g.awayTeam?.name ?? g.away} {g.awayScore} – {g.homeTeam?.name ?? g.home} {g.homeScore}
                    </span>
                  ) : (
                    <>
                      {g.spread && <span className="spread">{g.spread}</span>}
                      {g.ou != null && <span style={{ color: 'var(--muted)' }}>O/U {g.ou}</span>}
                    </>
                  )}
                </div>
                {blurb && <div className="game-impl">{blurb}</div>}
              </div>
            );
          })}
        </div>
      ) : (
        <p style={{ fontSize: 13, color: 'var(--ink-2)' }}>No {conf} games on the schedule this week.</p>
      )}

      <div className="bracket-label">Standings</div>
      <ConferenceStandingsTable conf={conf} weekIdx={weekIdx} />

      <section className="card" style={{ marginTop: 22 }}>
        <div className="panel-title">
          <div>
            <h2>Projected 12-team field</h2>
            <p>If the playoff started today.</p>
          </div>
        </div>
        {fieldCount ? (
          <ul className="pred-list">
            {inField.byes.map((o) => (
              <li key={o.id}><span className="ic">B</span><Link to={`/team/${o.id}`} state={{ from: 'conference', confSlug }}>#{o.rank} <TeamMark team={o.team} />{o.team.name} — first-round bye</Link></li>
            ))}
            {inField.seeds5to12.map((o) => (
              <li key={o.id}><span className="ic">F</span><Link to={`/team/${o.id}`} state={{ from: 'conference', confSlug }}>#{o.rank} <TeamMark team={o.team} />{o.team.name} — in the field</Link></li>
            ))}
            {inField.bubble.map((o) => (
              <li key={o.id}><span className="ic">?</span><Link to={`/team/${o.id}`} state={{ from: 'conference', confSlug }}>#{o.rank} <TeamMark team={o.team} />{o.team.name} — on the bubble</Link></li>
            ))}
          </ul>
        ) : (
          <p style={{ fontSize: 12.5, color: 'var(--ink-2)', margin: 0 }}>
            No {conf} team currently projects into the 12-team field.
          </p>
        )}
      </section>

      <p className="footnote">
        Standings and schedule reflect the current week regardless of any historical snapshot
        selected above; the projected field uses the real CFP seeding rule (top-4 conference
        champions get byes, a 5th champion auto-bids, the rest fills by rank) -- see Playoff Watch
        for the full bracket.
      </p>
    </div>
  );
}
