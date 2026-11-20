import { stepMinutes } from './TaskListEditor';

test('minus and plus move by 1 minute up to 10 and by 5 from there, on multiples of 5', () => {
  const up = (m) => stepMinutes(m, 1);
  const down = (m) => stepMinutes(m, -1);
  expect([1, 5, 9, 10, 12, 15, 58].map(up)).toEqual([2, 6, 10, 15, 15, 20, 60]);
  expect([2, 9, 10, 11, 12, 15, 20, 58].map(down)).toEqual([1, 8, 9, 10, 10, 10, 15, 55]);
  expect(down(1)).toBe(1);
  expect(up(720)).toBe(720);
  expect(up('')).toBe(2);
});
