// Alerts of the current task as absolute times, for the Android app: the system fires them as
// exact alarms, so they sound with the screen off (specifications.md §10). Pure logic.
import { LEVEL, MIN_MS } from './alerts';
import { TONES } from './sound';

const THRESHOLDS = [
  { level: LEVEL.five, beforeMs: 5 * MIN_MS, title: 'Faltam 5 min' },
  { level: LEVEL.one, beforeMs: MIN_MS, title: 'Falta 1 min' },
  { level: LEVEL.zero, beforeMs: 0, title: 'O tempo da tarefa acabou' },
];
// Overrun reminders scheduled ahead: enough for an hour, never more than this many alarms.
export const MAX_REMINDERS = 30;
const REMINDER_HORIZON_MS = 60 * MIN_MS;

// One entry per threshold, past or future, then the overrun reminders. The key identifies one
// crossing of one activation: the alarm and the web view both use it, and whichever comes
// second stays silent. Giving the task more time moves the crossing and so re-arms the alert.
export function alertPlan(view, nowMs, { reminderMs = 0 } = {}) {
  const current = view?.current;
  if (!current) return [];
  const endMs = nowMs + current.remainingMs;
  const base = `${current.id}:${view.currentSinceMs}`;
  const plan = THRESHOLDS.map(({ level, beforeMs, title }) => {
    const atMs = endMs - beforeMs;
    return { key: `${base}:${level}:${atMs}`, level, atMs, title, body: current.name, tones: TONES[level] };
  });
  if (reminderMs > 0) {
    const count = Math.min(MAX_REMINDERS, Math.ceil(REMINDER_HORIZON_MS / reminderMs));
    for (let k = 1; k <= count; k += 1) {
      const atMs = endMs + k * reminderMs;
      plan.push({
        key: `${base}:r${k}:${atMs}`, level: LEVEL.reminder, atMs,
        title: 'Tarefa ainda em andamento', body: current.name, tones: TONES[LEVEL.reminder],
      });
    }
  }
  return plan;
}

// The entry the web view means when it plays `level` at `nowMs`: for reminders, the latest one
// already due.
export function alertAt(plan, level, nowMs) {
  const matching = plan.filter((a) => a.level === level);
  const due = matching.filter((a) => a.atMs <= nowMs + 1000);
  return due.length ? due[due.length - 1] : matching[0];
}

export const planSignature = (plan) => plan.map((a) => `${a.key}|${a.body}`).join('\n');
