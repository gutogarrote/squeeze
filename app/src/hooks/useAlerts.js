import { useEffect, useRef } from 'react';
import { LEVEL, nextAlert } from '../lib/alerts';
import { playSound } from '../lib/sound';

// Plays the current task's alerts (specifications.md §10). `onAlert` runs whenever a sound
// would play (even muted), so the rest screen can wake up.
export default function useAlerts(view, { enabled, onAlert, play = playSound }) {
  const state = useRef(null);
  const first = useRef(true);
  const current = view?.current;
  const key = current ? `${current.id}:${view.currentSinceMs}` : null;
  const remaining = current ? current.remainingMs : null;

  useEffect(() => {
    if (!key) { state.current = null; return; }
    const out = nextAlert(state.current, key, remaining, { silent: first.current });
    first.current = false;
    state.current = out.state;
    if (out.play !== LEVEL.none) {
      if (enabled) play(out.play);
      onAlert?.(out.play);
    }
  }, [key, remaining, enabled, onAlert, play]);
}
