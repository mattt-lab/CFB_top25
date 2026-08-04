import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const usePinnedStore = create(
  persist(
    (set, get) => ({
      pinned: [],
      isPinned: (id) => get().pinned.includes(id),
      togglePin: (id) =>
        set((state) => ({
          pinned: state.pinned.includes(id)
            ? state.pinned.filter((p) => p !== id)
            : [...state.pinned, id],
        })),
    }),
    { name: 'cfbhq-pinned-teams' }
  )
);
