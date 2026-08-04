import { Link } from 'react-router-dom';
import { usePinnedStore } from '../store/usePinnedStore.js';
import { teamById, isDetailed, rankAt, deltaAt, tierFor, arrowGlyph } from '../data/teams.js';
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
            .map((id) => ({ id, rank: rankAt(id, weekIdx) }))
            .sort((a, b) => a.rank - b.rank)
            .map(({ id, rank }) => {
              const t = teamById(id);
              const delta = deltaAt(id, weekIdx);
              const tier = tierFor(rank);
              const detailed = isDetailed(id);
              const color = delta > 0 ? 'var(--good)' : delta < 0 ? 'var(--critical)' : 'var(--muted)';
              const Row = detailed ? Link : 'div';
              const rowProps = detailed
                ? { to: `/team/${id}`, state: { from: 'top25' } }
                : { style: { cursor: 'default' } };
              return (
                <Row key={id} className="bubble-row" {...rowProps}>
                  <span className="rk tabnum">{rank}</span>
                  <ConfDot conf={t.conf} />
                  <span className="nm">{t.name}</span>
                  <span className="needs">
                    <TierBadge tier={tier} />{' '}
                    · <span style={{ color, fontWeight: 700 }}>{arrowGlyph(delta)}{delta !== 0 ? Math.abs(delta) : ''}</span> this wk
                  </span>
                  <PinButton teamId={id} />
                </Row>
              );
            })}
        </div>
      )}
    </section>
  );
}
