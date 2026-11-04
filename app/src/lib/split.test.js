import { splitCapped, splitProportional } from './split';

const MIN_MS = 60000;

describe('splitProportional', () => {
  test('uses the weights and keeps the exact total', () => {
    expect(splitProportional(50 * MIN_MS, [20, 10, 10])).toEqual([25, 12.5, 12.5].map((m) => m * MIN_MS));
    const parts = splitProportional(1000, [1, 1, 1]);
    expect(parts.reduce((a, b) => a + b)).toBe(1000);
    expect(Math.max(...parts) - Math.min(...parts)).toBeLessThanOrEqual(1);
  });
  test('handles odd totals, empty, zero and invalid weights without NaN', () => {
    const parts = splitProportional(7 * MIN_MS + 3, [7, 3, 0, NaN, -2]);
    expect(parts.reduce((a, b) => a + b)).toBe(7 * MIN_MS + 3);
    expect(parts.slice(2)).toEqual([0, 0, 0]);
    expect(splitProportional(1000, [])).toEqual([]);
    expect(splitProportional(1000, [0, NaN])).toEqual([0, 0]);
    expect(splitProportional(-5, [1, 2])).toEqual([0, 0]);
    expect(splitProportional(NaN, [1, 2])).toEqual([0, 0]);
  });
});

describe('splitCapped', () => {
  test('respects caps and re-shares the excess, exact integers', () => {
    expect(splitCapped(100, [1, 1, 1], [10, 1000, 1000])).toEqual([10, 45, 45]);
    expect(splitCapped(100, [1, 1], [10, 20])).toEqual([10, 20]);
    expect(splitCapped(7, [2, 1, 0], [100, 100, 100])).toEqual([5, 2, 0]);
    expect(splitCapped(0, [1], [5])).toEqual([0]);
  });
});
