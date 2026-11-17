import { cardHeight, MAX_CARD_PX, MIN_CARD_PX } from './cardSize';

const M = 60000;

test('longer tasks are taller, but far less than proportionally', () => {
  const minutes = [5, 10, 20, 30, 50, 60, 90];
  const heights = minutes.map((m) => cardHeight(m * M));
  heights.slice(1).forEach((h, i) => expect(h).toBeGreaterThan(heights[i]));
  const ratio = cardHeight(50 * M) / cardHeight(5 * M);
  expect(ratio).toBeGreaterThan(2);
  expect(ratio).toBeLessThan(3);
  // Neighbouring durations remain distinguishable.
  expect(cardHeight(10 * M) - cardHeight(5 * M)).toBeGreaterThanOrEqual(12);
  expect(cardHeight(60 * M) - cardHeight(50 * M)).toBeGreaterThanOrEqual(12);
});

test('there is a minimum and a maximum size', () => {
  [0, -5 * M, 30000, M, 2 * M, NaN, undefined].forEach((ms) => expect(cardHeight(ms)).toBe(MIN_CARD_PX));
  expect(cardHeight(5 * M)).toBeGreaterThan(MIN_CARD_PX);
  expect(cardHeight(3 * 60 * M)).toBe(MAX_CARD_PX);
  expect(cardHeight(12 * 60 * M)).toBe(MAX_CARD_PX);
});
