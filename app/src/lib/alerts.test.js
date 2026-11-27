import { LEVEL, alertLevel, nextAlert, remindersDue, tickMark } from './alerts';

const M = 60000;

function play(sequence, options) {
  let state = null;
  return sequence.map(([key, remaining], i) => {
    const out = nextAlert(state, key, remaining, i === 0 ? options : undefined);
    state = out.state;
    return out.play;
  });
}

test('levels', () => {
  expect(alertLevel(6 * M)).toBe(LEVEL.none);
  expect(alertLevel(5 * M)).toBe(LEVEL.five);
  expect(alertLevel(M)).toBe(LEVEL.one);
  expect(alertLevel(0)).toBe(LEVEL.zero);
  expect(alertLevel(-M)).toBe(LEVEL.zero);
});

test('each threshold plays once as it is reached', () => {
  expect(play([['a', 6 * M], ['a', 5 * M], ['a', 4 * M], ['a', M], ['a', 30000], ['a', 0], ['a', -M]]))
    .toEqual([0, LEVEL.five, 0, LEVEL.one, 0, LEVEL.zero, 0]);
});

test('a 3-min task plays the 5-min alert when it starts, then the 1-min one', () => {
  expect(play([['a', 21 * M], ['b', 3 * M], ['b', M]])).toEqual([0, LEVEL.five, LEVEL.one]);
});

test('an overrun task that becomes current again plays the intense alert right away', () => {
  expect(play([['a', 11 * M], ['b', -2 * M]])).toEqual([0, LEVEL.zero]);
});

test('levels that coincide play a single sound', () => {
  expect(play([['a', 11 * M], ['a', 30000]])).toEqual([0, LEVEL.one]);
});

test('+5 min re-arms the thresholds it goes back above', () => {
  expect(play([['a', 4 * M], ['a', 9 * M], ['a', 5 * M]])).toEqual([LEVEL.five, 0, LEVEL.five]);
});

test('opening the app mid-task does not play what already happened', () => {
  expect(play([['a', -3 * M], ['a', -4 * M]], { silent: true })).toEqual([0, 0]);
});

test('after the time runs out a soft reminder plays every interval, once each', () => {
  const opts = { reminderMs: 2 * M };
  let state = null;
  const seq = [M, 0, -M, -2 * M, -2 * M - 1000, -3 * M, -4 * M, -9 * M].map((remaining) => {
    const out = nextAlert(state, 'a', remaining, opts);
    state = out.state;
    return out.play;
  });
  expect(seq).toEqual([LEVEL.one, LEVEL.zero, 0, LEVEL.reminder, 0, 0, LEVEL.reminder, LEVEL.reminder]);
});

test('reminders are off with interval 0, re-arm after +5 min and never replay on activation', () => {
  expect(remindersDue(-10 * M, 0)).toBe(0);
  expect(remindersDue(30000, 2 * M)).toBe(0);
  expect(remindersDue(-5 * M, 2 * M)).toBe(2);
  let state = nextAlert(null, 'a', -5 * M, { reminderMs: 2 * M }).state;
  expect(nextAlert(state, 'a', -5 * M - 1000, { reminderMs: 2 * M }).play).toBe(0);
  state = nextAlert(state, 'a', 3 * M, { reminderMs: 2 * M }).state;
  state = nextAlert(state, 'a', 0, { reminderMs: 2 * M }).state;
  expect(nextAlert(state, 'a', -2 * M, { reminderMs: 2 * M }).play).toBe(LEVEL.reminder);
  expect(nextAlert(state, 'a', -20 * M).play).toBe(0);
});

test('above the last 5 minutes a tick marks every 5 minutes left', () => {
  // A 15-min task: 15 at the start, then 10, then the 5, 1 and 0 thresholds.
  expect(play([['a', 31 * M], ['b', 15 * M], ['b', 12 * M], ['b', 10 * M], ['b', 9 * M], ['b', 5 * M], ['b', M], ['b', 0]]))
    .toEqual([0, LEVEL.tick, 0, LEVEL.tick, 0, LEVEL.five, LEVEL.one, LEVEL.zero]);
  // A 6-min task starts silent and sounds at 5; a 17-min one starts silent and ticks at 15 and 10.
  expect(play([['a', 31 * M], ['b', 6 * M], ['b', 5 * M]])).toEqual([0, 0, LEVEL.five]);
  expect(play([['a', 31 * M], ['b', 17 * M], ['b', 15 * M], ['b', 10 * M]])).toEqual([0, 0, LEVEL.tick, LEVEL.tick]);
  // Starting a moment after the mark still counts as starting on it.
  expect(play([['a', 31 * M], ['b', 15 * M - 800]])).toEqual([0, LEVEL.tick]);
  // +5 min moves back above a mark and re-arms it.
  expect(play([['a', 11 * M], ['a', 10 * M], ['a', 14 * M], ['a', 10 * M]])).toEqual([0, LEVEL.tick, 0, LEVEL.tick]);
  expect(tickMark(15 * M)).toBe(3);
  expect(tickMark(10 * M + 1)).toBe(3);
  expect(tickMark(4 * M)).toBe(1);
});
