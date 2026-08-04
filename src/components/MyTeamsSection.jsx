import { Link } from 'react-router-dom';
import { usePinnedStore } from '../store/usePinnedStore.js';
import { teamById, rankAt, formatKickoff } from '../data/teams.js';
import ConfDot from './ConfDot.jsx';
import PinButton from './PinButton.jsx';

// e.g. "vs #8 Michigan · Sat, 3:30 PM PDT · FOX" / "at Alabama · ..." (opponent unranked).
// null nextGame (bye week, or no games left on CFBD's schedule) renders as "Bye week".
function nextMatchupText(nextGame) {
  if (!nextGame) return 'Bye week';
  const vsAt = nextGame.homeAway === 'home' ? 'vs' : 'at';
  const opp = nextGame.opponentRank != null ? `#${nextGame.opponentRank} ${nextGame.opponent}` : nextGame.opponent;
  const parts = [`${vsAt} ${opp}`];
  const kickoff = formatKickoff(nextGame.when);
  if (kickoff) parts.push(kickoff);
  if (nextGame.network) parts.push(nextGame.network);
  return parts.join(' · ');
}

export default function MyTeamsSection({ weekIdx }) {
  const pinned = usePinnedStore((s) => s.pinned);

  return (
    <section className="card" style={{ marginBottom: 22 }}>
      <div className="panel-title">
        <div>
          <h2>Your Teams</h2>
          <p>Pinned teams — click the ☆ on any team below to add it here.</p>
        </div>
      </div>
      {!pinned.length ? (
        <p className="myteams-empty">Nothing pinned yet — click the ☆ next to any team in the Top 25 table below.</p>
      ) : (
        <div className="bubble-list">
          {pinned
            // A pinned id can outlive the team it pointed to (a rename, or a schema change) —
            // drop anything that no longer resolves rather than crashing the whole section.
            .filter((id) => teamById(id))
            .map((id) => ({ id, rank: rankAt(id, weekIdx) }))
            // Unranked (rank === null -- e.g. pinned from a direct team-page visit rather than
            // the Top 25 table) sorts to the end, not the front (plain a.rank - b.rank would
            // coerce null to 0 and put unranked teams first).
            .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity))
            .map(({ id, rank }) => {
              const t = teamById(id);
              return (
                <Link key={id} className="bubble-row" to={`/team/${id}`} state={{ from: 'top25' }}>
                  <span className="rk tabnum">{rank ?? '—'}</span>
                  <ConfDot conf={t.conf} />
                  <span className="nm">{t.name}</span>
                  <span className="needs">
                    <span className="tabnum" style={{ fontWeight: 700 }}>{t.record}</span>
                    {' · '}{nextMatchupText(t.nextGame)}
                  </span>
                  <PinButton teamId={id} />
                </Link>
              );
            })}
        </div>
      )}
    </section>
  );
}
