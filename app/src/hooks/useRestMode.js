import { useCallback, useEffect, useState } from 'react';

// Rest screen (specifications.md §11): after `restAfterMin` minutes without touches while
// a routine runs. Any touch or key resets the timer; wake() leaves the rest screen.
export default function useRestMode({ active, restAfterMin, now, clock = Date.now }) {
  const [lastActivity, setLastActivity] = useState(clock);
  const wake = useCallback(() => setLastActivity(clock()), [clock]);

  useEffect(() => {
    // Touches on the rest screen itself are handled by it (its click wakes), so the first
    // tap never reaches the cards underneath.
    const onActivity = (event) => { if (!event.target?.closest?.('[data-rest-screen]')) wake(); };
    window.addEventListener('pointerdown', onActivity, true);
    window.addEventListener('keydown', onActivity, true);
    return () => {
      window.removeEventListener('pointerdown', onActivity, true);
      window.removeEventListener('keydown', onActivity, true);
    };
  }, [wake]);

  // Starting (or resuming) a routine counts as activity.
  useEffect(() => { if (active) wake(); }, [active, wake]);

  const resting = !!active && restAfterMin > 0 && now - lastActivity >= restAfterMin * 60000;
  return { resting, wake };
}
