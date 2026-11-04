import { useEffect, useState } from 'react';

// Wall-clock time, refreshed every second and whenever the page becomes visible again.
export default function useNow(clock = Date.now) {
  const [now, setNow] = useState(clock);
  useEffect(() => {
    const tick = () => setNow(clock());
    const timer = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
  }, [clock]);
  return now;
}
