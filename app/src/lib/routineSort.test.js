import { sortRoutines, startClock } from './routineSort';

const routine = (id, deadline, minutes, lastUsedAt) => ({ id, name: id, deadline, tasks: [{ name: 'x', minutes }], lastUsedAt });
const list = [
  routine('noite', '21:00', 120, 300),
  routine('manha', '07:30', 50, 100),
  routine('tarde', '15:00', 300),
  routine('madrugada', '00:30', 60, 200),
];
const ids = (sorted) => sorted.map((r) => r.id);

test('routines sort by last use, end time or start time; manual keeps the saved order', () => {
  expect(ids(sortRoutines(list, 'recent'))).toEqual(['noite', 'madrugada', 'manha', 'tarde']);
  expect(ids(sortRoutines(list, 'end'))).toEqual(['madrugada', 'manha', 'tarde', 'noite']);
  // Starts: noite 19:00, manha 06:40, tarde 10:00, madrugada 23:30.
  expect(ids(sortRoutines(list, 'start'))).toEqual(['manha', 'tarde', 'noite', 'madrugada']);
  expect(ids(sortRoutines(list, 'manual'))).toEqual(ids(list));
  expect(sortRoutines(list, 'recent')).not.toBe(list);
  expect(ids(list)).toEqual(['noite', 'manha', 'tarde', 'madrugada']);
});

test('the start time wraps around midnight', () => {
  expect(startClock(routine('x', '00:30', 60))).toBe('23:30');
  expect(startClock(routine('x', '07:30', 50))).toBe('06:40');
});
