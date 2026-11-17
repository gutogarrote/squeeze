// Alerts of the current task as absolute times, for the Android app: the system fires them as
// exact alarms, so they sound with the screen off (specifications.md §10). Pure logic.
import { LEVEL, MIN_MS } from './alerts';
import { TONES } from './sound';

const THRESHOLDS = [
  { level: LEVEL.five, beforeMs: 5 * MIN_MS, title: 'Faltam 5 min' },
  { level: LEVEL.one, beforeMs: MIN_MS, title: 'Falta 1 min' },
  { level: LEVEL.zero, beforeMs: 0, title: 'O tempo da tarefa acabou' },
];

// One entry per threshold, past or future. The key identifies one crossing of one activation:
// the alarm and the web view both use it, and whichever comes second stays silent. Giving
// the task more time moves the crossing and so re-arms the alert.
export function alertPlan(view, nowMs) {
  const current = view?.current;
  if (!current) return [];
  const endMs = nowMs + current.remainingMs;
  return THRESHOLDS.map(({ level, beforeMs, title }) => {
    const atMs = endMs - beforeMs;
    return {
      key: `${current.id}:${view.currentSinceMs}:${level}:${atMs}`,
      level,
      atMs,
      title,
      body: current.name,
      tones: TONES[level],
    };
  });
}

export const planSignature = (plan) => plan.map((a) => `${a.key}|${a.body}`).join('\n');
