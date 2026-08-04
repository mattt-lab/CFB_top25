import { create } from 'zustand';
import { WEEK_IDX_MIN, WEEK_IDX_MAX } from '../data/teams.js';

// Time-travel state, shared between the Top 25 Tracker and Playoff Watch pages only —
// team drilldowns intentionally always show the full season regardless of this.
export const useWeekStore = create((set) => ({
  weekIdx: WEEK_IDX_MAX,
  setWeekIdx: (idx) => set({ weekIdx: Math.max(WEEK_IDX_MIN, Math.min(WEEK_IDX_MAX, idx)) }),
  jumpToCurrent: () => set({ weekIdx: WEEK_IDX_MAX }),
}));
