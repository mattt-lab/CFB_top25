import { usePinnedStore } from '../store/usePinnedStore.js';

export default function PinButton({ teamId }) {
  const isPinned = usePinnedStore((s) => s.isPinned(teamId));
  const togglePin = usePinnedStore((s) => s.togglePin);
  return (
    <button
      type="button"
      className="pin-btn"
      aria-pressed={isPinned}
      title={`${isPinned ? 'Unpin' : 'Pin'} team`}
      onClick={(e) => { e.stopPropagation(); togglePin(teamId); }}
    >
      {isPinned ? '★' : '☆'}
    </button>
  );
}
