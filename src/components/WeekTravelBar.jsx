import { useWeekStore } from '../store/useWeekStore.js';
import { WEEK_IDX_MIN, WEEK_IDX_MAX } from '../data/teams.js';

const WEEK_OPTIONS = [];
for (let w = WEEK_IDX_MIN; w <= WEEK_IDX_MAX; w++) WEEK_OPTIONS.push(w);

export default function WeekTravelBar() {
  const weekIdx = useWeekStore((s) => s.weekIdx);
  const setWeekIdx = useWeekStore((s) => s.setWeekIdx);
  const jumpToCurrent = useWeekStore((s) => s.jumpToCurrent);

  return (
    <>
      <div className="week-bar">
        <span>Viewing snapshot:</span>
        <select value={weekIdx} onChange={(e) => setWeekIdx(+e.target.value)} aria-label="Select week to view">
          {WEEK_OPTIONS.map((w) => (
            <option key={w} value={w}>
              Week {w + 1}{w === WEEK_IDX_MAX ? ' (latest)' : ''}
            </option>
          ))}
        </select>
        <span className="hint">
          Time travel reorders the Top 25 &amp; bracket only — team pages always show the full season.
        </span>
      </div>
      {weekIdx !== WEEK_IDX_MAX && (
        <div className="hist-banner">
          <span>You're viewing a past snapshot — not the latest rankings.</span>
          <button type="button" onClick={jumpToCurrent}>Jump to current week</button>
        </div>
      )}
    </>
  );
}
