import { useCallback, useEffect, useRef } from 'react';
import { alertPlan, planSignature } from '../lib/nativeAlerts';

// Android app only: keeps the system alarms in step with the current task, so alerts sound
// with the screen off, and returns the `play` that useAlerts uses instead of Web Audio.
// Without a bridge (the web) it does nothing and returns undefined.
export default function useNativeAlerts(view, now, { enabled, bridge }) {
  const plan = bridge && view ? alertPlan(view, now) : [];
  const planRef = useRef(plan);
  planRef.current = plan;
  const signature = enabled ? planSignature(plan) : '';

  useEffect(() => {
    if (!bridge) return;
    Promise.resolve(bridge.sync({ alerts: signature ? planRef.current : [] })).catch(() => {});
  }, [bridge, signature]);

  const play = useCallback((level) => {
    const alert = planRef.current.find((a) => a.level === level);
    if (alert) Promise.resolve(bridge.play({ alert })).catch(() => {});
  }, [bridge]);

  return bridge ? play : undefined;
}
