// Card height for a span of time (specifications.md §12). Height grows with the square root
// of the minutes: longer tasks look clearly bigger, but a 50 min task is about 2.4 times a
// 5 min one, not 10 times. Short spans keep a legible minimum; very long ones stop growing.
export const MIN_CARD_PX = 60;
export const MAX_CARD_PX = 240;
const BASE_PX = 24;
const PX_PER_ROOT_MINUTE = 20;

export function cardHeight(ms) {
  const minutes = Math.max(0, Number(ms) || 0) / 60000;
  const height = BASE_PX + PX_PER_ROOT_MINUTE * Math.sqrt(minutes);
  return Math.round(Math.min(MAX_CARD_PX, Math.max(MIN_CARD_PX, height)));
}
