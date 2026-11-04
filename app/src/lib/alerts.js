// Sound alerts for the current task (specifications.md §10). Pure logic; the hook plays.

export const MIN_MS = 60000;
export const LEVEL = { none: 0, five: 1, one: 2, zero: 3 };

export function alertLevel(remainingMs) {
  if (remainingMs <= 0) return LEVEL.zero;
  if (remainingMs <= MIN_MS) return LEVEL.one;
  if (remainingMs <= 5 * MIN_MS) return LEVEL.five;
  return LEVEL.none;
}

// state: { key, level } | null. key identifies one activation of a task.
// - A new activation already past a threshold plays the most severe one right away.
// - Each threshold plays once per activation; going back above it (+5 min) re-arms it.
// - `silent` (first evaluation after opening the app) records the level without playing.
export function nextAlert(state, key, remainingMs, { silent = false } = {}) {
  const level = alertLevel(remainingMs);
  if (!state || state.key !== key) {
    return { state: { key, level }, play: silent ? LEVEL.none : level };
  }
  if (level > state.level) return { state: { key, level }, play: level };
  return { state: { key, level }, play: LEVEL.none };
}
