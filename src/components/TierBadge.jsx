export default function TierBadge({ tier }) {
  return <span className={`tier ${tier.cls}`}>{tier.label}</span>;
}
