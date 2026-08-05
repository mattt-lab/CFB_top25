import { Link } from 'react-router-dom';
import { usePinnedStore } from '../store/usePinnedStore.js';
import { teamById, rankAt, byRankAsc, formatKickoff } from '../data/teams.js';
import ConfDot from './ConfDot.jsx';
import PinButton from './PinButton.jsx';

// Opponent label (e.g. "vs #8 Michigan" / "at Alabama" for an unranked opponent) and kickoff/
// network text (e.g. "Sat, Sep 5, 3:30 PM PDT · FOX"), split so the caller can style the opponent
// distinctly (bold, so it stands out from the surrounding record/kickoff text). Both null for a
// bye week (no nextGame) or a team with no games left on CFBD's schedule.
function nextGameParts(nextGame) {
  if (!nextGame) return { opponent: null, kickoff: null };
  const vsAt = nextGame.homeAway === 'home' ? 'vs' : 'at';
  const oppLabel = nextGame.opponentRank != null ? `#${nextGame.opponentRank} ${nextGame.opponent}` : nextGame.opponent;
  const kickoff = [formatKickoff(nextGame.when), nextGame.network].filter(Boolean).join(' · ');
  return { opponent: `${vsAt} ${oppLabel}`, kickoff: kickoff || null };
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
            // the Top 25 table) sorts to the end, not the front.
            .sort(byRankAsc((x) => x.rank))
            .map(({ id, rank }) => {
              const t = teamById(id);
              const { opponent, kickoff } = nextGameParts(t.nextGame);
              return (
                <Link key={id} className="bubble-row" to={`/team/${id}`} state={{ from: 'top25' }}>
                  <span className="rk tabnum">{rank ?? '—'}</span>
                  <ConfDot conf={t.conf} />
                  <span className="nm">{t.name}</span>
                  <span className="needs">
                    <span className="tabnum record">{t.record}</span>
                    <span className="opp">{opponent ?? 'Bye week'}</span>
                    {kickoff && <span className="kickoff">{kickoff}</span>}
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
