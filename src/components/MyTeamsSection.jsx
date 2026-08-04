import { Link } from 'react-router-dom';
import { usePinnedStore } from '../store/usePinnedStore.js';
import { teamById, rankAt, deltaAt, tierFor, arrowGlyph } from '../data/teams.js';
import ConfDot from './ConfDot.jsx';
import TierBadge from './TierBadge.jsx';
import PinButton from './PinButton.jsx';

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
              const delta = deltaAt(id, weekIdx);
              const tier = tierFor(rank);
              const color = delta > 0 ? 'var(--good)' : delta < 0 ? 'var(--critical)' : 'var(--muted)';
              return (
                <Link key={id} className="bubble-row" to={`/team/${id}`} state={{ from: 'top25' }}>
                  <span className="rk tabnum">{rank ?? '—'}</span>
                  <ConfDot conf={t.conf} />
                  <span className="nm">{t.name}</span>
                  <span className="needs">
                    <TierBadge tier={tier} />{' '}
                    · <span style={{ color, fontWeight: 700 }}>{arrowGlyph(delta)}{delta !== 0 ? Math.abs(delta) : ''}</span> this wk
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
