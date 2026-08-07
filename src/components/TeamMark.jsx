import ConfDot from './ConfDot.jsx';

// Small inline team mark for table/list rows: the team's logo when we have one, otherwise the
// conference-colored ConfDot. The fallback matters because ~48 FCS opponents in the data ship
// with hasLogo: false (no file in public/logos/) — rendering the dot instead of a broken/blank
// 18px gap keeps every row visually anchored the same way.
export default function TeamMark({ team }) {
  if (!team?.hasLogo) return <ConfDot conf={team?.conf} />;
  return (
    <picture>
      <source
        media="(prefers-color-scheme: dark)"
        srcSet={`${import.meta.env.BASE_URL}logos/${team.id}-dark.png`}
      />
      <img
        src={`${import.meta.env.BASE_URL}logos/${team.id}.png`}
        alt=""
        className="team-mark"
        width={18}
        height={18}
      />
    </picture>
  );
}
