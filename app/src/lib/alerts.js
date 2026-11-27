// Sound alerts for the current task (specifications.md §10). Pure logic; the hook plays.

export const MIN_MS = 60000;
// `reminder` and `tick` are not thresholds: the reminder repeats while a task runs over, the
// tick marks every 5 minutes left above the last 5 (15, 10...).
export const LEVEL = { none: 0, five: 1, one: 2, zero: 3, reminder: 4, tick: 5 };
export const ALERT_STYLES = ['urgent', 'soft'];
const FIVE_MS = 5 * MIN_MS;
// How close to a 5-minute mark a task must start for the mark to sound right away.
const MARK_SLACK_MS = 1500;
export const REMINDER_OPTIONS = [2, 5, 0];

export function alertLevel(remainingMs) {
  if (remainingMs <= 0) return LEVEL.zero;
  if (remainingMs <= MIN_MS) return LEVEL.one;
  if (remainingMs <= 5 * MIN_MS) return LEVEL.five;
  return LEVEL.none;
}

// Which 5-minute mark the time left is in: 15:00 down to 10:00:01 is mark 3.
export function tickMark(remainingMs) {
  return remainingMs > FIVE_MS ? Math.ceil(remainingMs / FIVE_MS) : 1;
}

// True when a task starts on a 5-minute mark (a 15-min task at 15:00).
function onMark(remainingMs) {
  if (remainingMs <= FIVE_MS) return false;
  const off = remainingMs % FIVE_MS;
  return off < MARK_SLACK_MS || FIVE_MS - off < MARK_SLACK_MS;
}

// How many overrun reminders are due: one every `reminderMs` after the time ran out.
export function remindersDue(remainingMs, reminderMs) {
  if (!(reminderMs > 0) || remainingMs >= 0) return 0;
  return Math.floor(-remainingMs / reminderMs);
}

// state: { key, level, mark, reminders } | null. key identifies one activation of a task.
// - A new activation already past a threshold plays the most severe one right away; one
//   that starts on a 5-minute mark plays the tick.
// - Above the last 5 minutes, a tick plays at each 5-minute mark (15, 10...).
// - Each threshold plays once per activation; going back above it (+5 min) re-arms it.
// - After the time runs out, a soft reminder plays every `reminderMs` (0: never).
// - `silent` (first evaluation after opening the app) records the level without playing.
export function nextAlert(state, key, remainingMs, { silent = false, reminderMs = 0 } = {}) {
  const level = alertLevel(remainingMs);
  const reminders = remindersDue(remainingMs, reminderMs);
  const mark = tickMark(remainingMs);
  const next = { key, level, mark, reminders };
  if (!state || state.key !== key) {
    if (silent) return { state: next, play: LEVEL.none };
    return { state: next, play: level !== LEVEL.none ? level : onMark(remainingMs) ? LEVEL.tick : LEVEL.none };
  }
  if (level > state.level) return { state: next, play: level };
  if (level === LEVEL.none && mark < (state.mark ?? mark)) return { state: next, play: LEVEL.tick };
  if (level === LEVEL.zero && reminders > (state.reminders || 0)) return { state: next, play: LEVEL.reminder };
  return { state: next, play: LEVEL.none };
}
