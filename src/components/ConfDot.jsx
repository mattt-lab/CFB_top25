import { confSlug } from '../data/teams.js';

export default function ConfDot({ conf }) {
  return (
    <span
      className="conf-dot"
      title={conf}
      style={{ background: `var(--conf-${confSlug(conf)}, var(--muted))` }}
    />
  );
}
