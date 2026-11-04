import { LEVEL, alertLevel, nextAlert } from './alerts';

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
  expect(play([['a', 20 * M], ['b', 3 * M], ['b', M]])).toEqual([0, LEVEL.five, LEVEL.one]);
});

test('an overrun task that becomes current again plays the intense alert right away', () => {
  expect(play([['a', 10 * M], ['b', -2 * M]])).toEqual([0, LEVEL.zero]);
});

test('levels that coincide play a single sound', () => {
  expect(play([['a', 10 * M], ['a', 30000]])).toEqual([0, LEVEL.one]);
});

test('+5 min re-arms the thresholds it goes back above', () => {
  expect(play([['a', 4 * M], ['a', 9 * M], ['a', 5 * M]])).toEqual([LEVEL.five, 0, LEVEL.five]);
});

test('opening the app mid-task does not play what already happened', () => {
  expect(play([['a', -3 * M], ['a', -4 * M]], { silent: true })).toEqual([0, 0]);
});
