// Card height for a span of time (specifications.md §12). Height grows with the minutes raised
// to 0.56: longer tasks look clearly bigger (a 40 min task is about 3.2 times a 5 min one, a
// 50 min task about 3.6 times), still well short of proportional. Short spans keep a legible
// minimum; very long ones stop growing.
export const MIN_CARD_PX = 60;
export const MAX_CARD_PX = 320;
const PX_AT_ONE_MINUTE = 27;
const EXPONENT = 0.56;

export function cardHeight(ms) {
  const minutes = Math.max(0, Number(ms) || 0) / 60000;
  const height = PX_AT_ONE_MINUTE * minutes ** EXPONENT;
  return Math.round(Math.min(MAX_CARD_PX, Math.max(MIN_CARD_PX, height)));
}
