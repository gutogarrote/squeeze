// Sound alerts for the current task (specifications.md §10). Pure logic; the hook plays.

export const MIN_MS = 60000;
// `reminder` is not a threshold: it is the soft tone repeated while a task runs over.
export const LEVEL = { none: 0, five: 1, one: 2, zero: 3, reminder: 4 };
export const REMINDER_OPTIONS = [2, 5, 0];

export function alertLevel(remainingMs) {
  if (remainingMs <= 0) return LEVEL.zero;
  if (remainingMs <= MIN_MS) return LEVEL.one;
  if (remainingMs <= 5 * MIN_MS) return LEVEL.five;
  return LEVEL.none;
}

// How many overrun reminders are due: one every `reminderMs` after the time ran out.
export function remindersDue(remainingMs, reminderMs) {
  if (!(reminderMs > 0) || remainingMs >= 0) return 0;
  return Math.floor(-remainingMs / reminderMs);
}

// state: { key, level, reminders } | null. key identifies one activation of a task.
// - A new activation already past a threshold plays the most severe one right away.
// - Each threshold plays once per activation; going back above it (+5 min) re-arms it.
// - After the time runs out, a soft reminder plays every `reminderMs` (0: never).
// - `silent` (first evaluation after opening the app) records the level without playing.
export function nextAlert(state, key, remainingMs, { silent = false, reminderMs = 0 } = {}) {
  const level = alertLevel(remainingMs);
  const reminders = remindersDue(remainingMs, reminderMs);
  const next = { key, level, reminders };
  if (!state || state.key !== key) return { state: next, play: silent ? LEVEL.none : level };
  if (level > state.level) return { state: next, play: level };
  if (level === LEVEL.zero && reminders > (state.reminders || 0)) return { state: next, play: LEVEL.reminder };
  return { state: next, play: LEVEL.none };
}
