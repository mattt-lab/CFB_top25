import { Link } from 'react-router-dom';
import { usePinnedStore } from '../store/usePinnedStore.js';
import { teamById, rankAt, byRankAsc, nextGameParts } from '../data/teams.js';
import ConfDot from './ConfDot.jsx';
import PinButton from './PinButton.jsx';

export default function MyTeamsSection({ weekIdx }) {
  const pinned = usePinnedStore((s) => s.pinned);

  const visible = pinned
    // A pinned id can outlive the team it pointed to (a rename, or a schema change) — drop
    // anything that no longer resolves rather than crashing the whole section.
    .filter((id) => teamById(id))
    .map((id) => ({ id, rank: rankAt(id, weekIdx) }))
    // Unranked (rank === null -- e.g. pinned from a direct team-page visit rather than the Top
    // 25 table) sorts to the end, not the front.
    .sort(byRankAsc((x) => x.rank));

  // Nothing to show -- drop the whole card rather than an always-there empty-state message,
  // which was permanent clutter on the very first thing every visitor saw on the homepage.
  if (!visible.length) return null;

  return (
    <section className="card" style={{ marginBottom: 22 }}>
      <div className="panel-title">
        <div>
          <h2>Your Teams</h2>
          <p>Pinned teams — click the ☆ on any team below to add it here.</p>
        </div>
      </div>
      <div className="bubble-list">
        {visible.map(({ id, rank }) => {
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
    </section>
  );
}
