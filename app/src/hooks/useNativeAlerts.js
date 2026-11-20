import { useCallback, useEffect, useRef } from 'react';
import { alertAt, alertPlan, planSignature } from '../lib/nativeAlerts';

// Android app only: keeps the system alarms in step with the current task, so alerts sound
// with the screen off, and returns the `play` that useAlerts uses instead of Web Audio.
// Without a bridge (the web) it does nothing and returns undefined.
export default function useNativeAlerts(view, now, { enabled, bridge, reminderMs = 0 }) {
  const plan = bridge && view ? alertPlan(view, now, { reminderMs }) : [];
  const planRef = useRef(plan);
  const nowRef = useRef(now);
  planRef.current = plan;
  nowRef.current = now;
  const signature = enabled ? planSignature(plan) : '';

  useEffect(() => {
    if (!bridge) return;
    Promise.resolve(bridge.sync({ alerts: signature ? planRef.current : [] })).catch(() => {});
  }, [bridge, signature]);

  const play = useCallback((level) => {
    const alert = alertAt(planRef.current, level, nowRef.current);
    if (alert) Promise.resolve(bridge.play({ alert })).catch(() => {});
  }, [bridge]);

  return bridge ? play : undefined;
}
