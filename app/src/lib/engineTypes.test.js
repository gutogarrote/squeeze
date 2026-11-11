import {
  MIN_MS as M, startRun, viewRun, completeTask, postponeTask, reactivateTask,
  applyEdit, extendDeadline, setDeadline, addTimeToCurrent, releaseBuffer, runToPlanTasks, planSummary,
} from './engine';

const tasks = [
  { name: 'A', minutes: 10 },
  { name: 'Fixa', minutes: 20, type: 'fixed' },
  { name: 'B', minutes: 30 },
  { name: 'Reserva', minutes: 10, type: 'buffer' },
];
const start = (list = tasks, deadline = 70) => startRun({ tasks: list, deadlineMs: deadline * M }, 0);
const byName = (view, name) => view.tasks.find((t) => t.name === name);
const left = (run, time = 0) => Object.fromEntries(viewRun(run, time * M).tasks.map((t) => [t.name, t.remainingMs / M]));
const id = (run, name) => byName(run, name).id;
const edits = (run) => run.tasks.filter((t) => t.status === 'pending').map((t) => ({
  id: t.id, name: t.name, estimateMs: t.estimateMs, ...(t.type ? { type: t.type } : {}),
}));

test('an overrun spends the explicit buffer first, then only flexible tasks', () => {
  const run = start();
  expect(left(run, 15)).toEqual({ A: -5, Fixa: 20, B: 30, Reserva: 5 });
  expect(left(run, 25)).toEqual({ A: -15, Fixa: 20, B: 25, Reserva: 0 });
  expect(byName(viewRun(run, 25 * M), 'Fixa').consumedMs).toBe(0);
});

test('automatic slack joins the explicit buffer without creating a second reserve', () => {
  const run = start(tasks, 90);
  expect(run.bufferMs).toBe(0);
  expect(left(run).Reserva).toBe(30);
  expect(left(run, 35)).toEqual({ A: -25, Fixa: 20, B: 30, Reserva: 5 });
});

test('late starts consume the buffer before compressing flexible tasks and reserve every fixed duration', () => {
  expect(left(start(tasks, 65))).toEqual({ A: 10, Fixa: 20, B: 30, Reserva: 5 });
  expect(left(start(tasks, 40))).toEqual({ A: 5, Fixa: 20, B: 15, Reserva: 0 });
  const fixed = [{ name: 'X', minutes: 10, type: 'fixed' }, { name: 'Y', minutes: 20, type: 'fixed' }];
  const run = start(fixed, 5);
  expect(left(run)).toEqual({ X: 10, Y: 20 });
  expect(viewRun(run, 0).protectedDeficitMs).toBe(25 * M);
  expect(planSummary(fixed, 5 * M, 0).protectedDeficitMs).toBe(25 * M);
});

test('fixed tasks keep their time even beyond the deadline or after a deadline reduction', () => {
  let run = start();
  expect(left(run, 80).Fixa).toBe(20);
  run = setDeadline(run, 5 * M, 0);
  expect(left(run).Fixa).toBe(20);
  expect(viewRun(run, 0).protectedDeficitMs).toBe(15 * M);
});

test('a fixed task spends time only while active, including after postponing and resuming', () => {
  let run = start();
  run = completeTask(run, id(run, 'A'), 10 * M);
  run = postponeTask(run, id(run, 'Fixa'), 15 * M);
  expect(left(run, 30).Fixa).toBe(15);
  expect(byName(viewRun(run, 30 * M), 'Fixa').consumedMs).toBe(5 * M);
  run = completeTask(run, id(run, 'B'), 30 * M);
  expect(viewRun(run, 30 * M).current.name).toBe('Fixa');
  expect(left(run, 35).Fixa).toBe(10);
});

test('early completion and deadline extensions do not grow fixed tasks', () => {
  let run = start();
  run = completeTask(run, id(run, 'A'), 0);
  expect(left(run).Fixa).toBe(20);
  run = extendDeadline(run, 0);
  expect(left(run).Fixa).toBe(20);
  run = releaseBuffer(run, 0);
  expect(left(run).Fixa).toBe(20);
});

test('reactivation preserves a fixed remainder even if other tasks cannot pay it back', () => {
  let run = start([{ name: 'X', minutes: 20, type: 'fixed' }, { name: 'Y', minutes: 20, type: 'fixed' }], 40);
  run = completeTask(run, id(run, 'X'), 5 * M);
  run = reactivateTask(run, id(run, 'X'), 35 * M);
  expect(left(run, 35).X).toBe(15);
  expect(left(run, 35).Y).toBe(0);
  expect(byName(viewRun(run, 35 * M), 'Y').overrunMs).toBe(10 * M);
});

test('freed fixed time pays a protected shortfall before being redistributed', () => {
  const list = [{ name: 'X', minutes: 20, type: 'fixed' }, { name: 'Y', minutes: 20, type: 'fixed' }, { name: 'Z', minutes: 10 }];
  let run = start(list, 15);
  run = completeTask(run, id(run, 'X'), 0);
  expect(left(run).Y).toBe(20);
  expect(left(run).Z).toBe(0);
  expect(run.bufferMs).toBe(0);
});

test('the reserve is not an active task and does not block the next task when empty', () => {
  let run = start([tasks[3], tasks[0], tasks[1]], 40);
  expect(viewRun(run, 0).current.name).toBe('A');
  run = completeTask(run, id(run, 'A'), 20 * M);
  expect(viewRun(run, 20 * M).current.name).toBe('Fixa');
  expect(left(run, 20).Reserva).toBe(0);
});

test('changing types during execution preserves consumed time and adjusts only eligible budgets', () => {
  let run = start();
  const edit = edits(run).map((t) => t.name === 'B' ? { ...t, type: 'fixed' } : t);
  run = applyEdit(run, { tasks: edit }, 25 * M);
  expect(left(run, 25).B).toBe(30);
  expect(left(run, 25).Fixa).toBe(20);
  expect(viewRun(run, 25 * M).current.consumedMs).toBe(25 * M);
  run = applyEdit(run, { tasks: edits(run) }, 26 * M);
  expect(left(run, 26).B).toBe(30);
});

test('new fixed tasks added in editing use the reserve before flexible tasks', () => {
  let run = start();
  run = applyEdit(run, { tasks: [...edits(run), { name: 'Nova fixa', type: 'fixed', estimateMs: 5 * M }] }, 0);
  expect(left(run)).toEqual({ A: 10, Fixa: 20, B: 30, Reserva: 5, 'Nova fixa': 5 });
  const edit = edits(run).filter((t) => t.name !== 'Nova fixa');
  run = applyEdit(run, { tasks: edit }, 0);
  expect(left(run).Fixa).toBe(20);
});

test('turning a fixed task flexible lets it squeeze again', () => {
  let run = start();
  run = applyEdit(run, { tasks: edits(run).map((t) => t.name === 'Fixa' ? { ...t, type: undefined } : t) }, 0);
  expect(left(run, 30).Fixa).toBe(16);
});

test('a buffer-only routine can finish and be edited without an active task', () => {
  let run = start([tasks[3]], 20);
  expect(viewRun(run, 0).allDone).toBe(true);
  run = releaseBuffer(run, 0);
  expect(viewRun(run, 0).allDone).toBe(true);
  expect(run.bufferMs).toBe(20 * M);
});

test('types survive restart/export and duplicate buffers are normalized', () => {
  const run = start([...tasks, { name: 'Duplicada', minutes: 5, type: 'buffer' }], 75);
  expect(run.tasks.filter((t) => t.type === 'buffer')).toHaveLength(1);
  expect(runToPlanTasks(run).slice(0, 4)).toEqual(tasks);
});

test('adding five minutes to a fixed task is an explicit duration edit', () => {
  let run = start([tasks[1], tasks[0]], 30);
  run = addTimeToCurrent(run, 18 * M);
  expect(left(run, 18).Fixa).toBe(7);
  expect(byName(run, 'Fixa').estimateMs).toBe(25 * M);
});

test('editing another task does not erase a paused task overrun', () => {
  let run = start();
  run = postponeTask(run, id(run, 'A'), 15 * M);
  run = applyEdit(run, { tasks: edits(run).map((t) => t.name === 'B' ? { ...t, estimateMs: 35 * M } : t) }, 15 * M);
  expect(byName(viewRun(run, 15 * M), 'A').overrunMs).toBe(5 * M);
});

test('an explicit time extension reports a shortfall when fixed tasks cannot surrender time', () => {
  let run = start([tasks[0], tasks[1]], 30);
  run = addTimeToCurrent(run, 8 * M);
  expect(left(run, 8)).toEqual({ A: 7, Fixa: 20 });
  expect(viewRun(run, 8 * M).protectedDeficitMs).toBe(5 * M);
});
