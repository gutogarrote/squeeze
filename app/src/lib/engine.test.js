import {
  MIN_MS, addTimeToCurrent, applyEdit, completeTask, extendDeadline, planSummary, postponeTask,
  reactivateTask, releaseBuffer, setDeadline, startRun, viewRun, claimOf,
} from './engine';

// 14:00 on an arbitrary day; times in the examples are offsets from it.
const BASE = Date.UTC(2026, 10, 4, 14, 0);
const at = (h, m = 0, s = 0) => BASE + ((h - 14) * 60 + m) * MIN_MS + s * 1000;
const min = (ms) => ms / MIN_MS;
const ABC = [{ name: 'A', minutes: 30 }, { name: 'B', minutes: 60 }, { name: 'C', minutes: 30 }];
const plan = (tasks = ABC, deadlineMs = at(16)) => ({ name: 'Teste', deadlineMs, tasks });
const remaining = (view) => Object.fromEntries(view.tasks.map((t) => [t.name, min(t.remainingMs)]));
const idOf = (run, name) => run.tasks.find((t) => t.name === name).id;

// §6.1: now + Σ claims + buffer = deadline (while the deadline has not passed).
function expectInvariant(run, nowMs) {
  const v = viewRun(run, nowMs);
  const claims = v.tasks.filter((t) => t.status === 'pending').reduce((s, t) => s + Math.max(0, t.remainingMs), 0);
  expect(nowMs + claims + v.bufferMs).toBe(run.deadlineMs);
}

describe('planning', () => {
  test('ideal start is the deadline minus the sum of estimates (12h35 example)', () => {
    const tasks = [60, 20, 25, 20, 20].map((minutes, i) => ({ name: 'T' + i, minutes }));
    const s = planSummary(tasks, at(15), at(12));
    expect(min(s.totalMs)).toBe(145);
    expect(s.idealStartMs).toBe(at(12, 35));
    expect(s.early).toBe(true);
    expect(min(s.bufferIfStartNowMs)).toBe(35);
  });
  test('when the ideal start has passed it says how much is missing', () => {
    const s = planSummary(ABC, at(16), at(14, 30));
    expect(s.early).toBe(false);
    expect(min(s.missingMs)).toBe(30);
    expect(s.factor).toBe(0.75);
  });
});

describe('§6.4 examples', () => {
  test('1. overrun without buffer squeezes the next tasks proportionally', () => {
    const run = startRun(plan(), at(14));
    expect(run.bufferMs).toBe(0);
    const v = viewRun(run, at(14, 45));
    expect(remaining(v)).toEqual({ A: -15, B: 50, C: 25 });
    expect(min(v.current.consumedMs)).toBe(45);
    expect(v.current.overrunMs).toBe(15 * MIN_MS);
    expect(min(v.deficitMs)).toBe(15);
    expectInvariant(run, at(14, 45));
  });

  test('2. overrun with buffer uses the buffer first', () => {
    const run = startRun(plan(), at(13, 40));
    expect(min(run.bufferMs)).toBe(20);
    let v = viewRun(run, at(14, 25));
    expect(min(v.bufferMs)).toBe(5);
    expect(remaining(v)).toEqual({ A: -15, B: 60, C: 30 });
    v = viewRun(run, at(14, 35));
    expect(v.bufferMs).toBe(0);
    expect(v.tasks[1].remainingMs).toBe((56 * 60 + 40) * 1000);
    expect(v.tasks[2].remainingMs).toBe((28 * 60 + 20) * 1000);
  });

  test('3. late start compresses every task, the first included', () => {
    const run = startRun(plan(), at(14, 30));
    expect(run.tasks.map((t) => min(t.budgetMs))).toEqual([22.5, 45, 22.5]);
    expect(run.bufferMs).toBe(0);
    const v = viewRun(run, at(14, 30));
    expect(v.tasks.every((t) => t.compressed)).toBe(true);
    expect(min(v.deficitMs)).toBe(30);
  });

  test('4. completing early gives the leftover to the next tasks', () => {
    let run = startRun(plan(), at(14));
    run = completeTask(run, idOf(run, 'A'), at(14, 20));
    const v = viewRun(run, at(14, 20));
    expect(v.current.name).toBe('B');
    expect(v.tasks[1].remainingMs).toBe((66 * 60 + 40) * 1000);
    expect(v.tasks[2].remainingMs).toBe((33 * 60 + 20) * 1000);
    expect(v.tasks[0].status).toBe('done');
    expect(min(v.tasks[0].remainingMs)).toBe(10);
    expectInvariant(run, at(14, 20));
  });

  test('5. postponing swaps with the next and keeps the remaining time', () => {
    let run = startRun(plan(), at(14));
    run = postponeTask(run, idOf(run, 'A'), at(14, 10));
    const v = viewRun(run, at(14, 10));
    expect(v.tasks.map((t) => t.name)).toEqual(['B', 'A', 'C']);
    expect(remaining(v)).toEqual({ B: 60, A: 20, C: 30 });
    expect(min(v.tasks[1].consumedMs)).toBe(10);
    expectInvariant(run, at(14, 10));
  });

  test('6. reactivating takes its leftover back from the others in proportion to their budgets', () => {
    let run = startRun(plan(), at(14));
    run = completeTask(run, idOf(run, 'A'), at(14, 20));
    run = reactivateTask(run, idOf(run, 'A'), at(14, 30));
    const v = viewRun(run, at(14, 30));
    expect(v.tasks.map((t) => t.name)).toEqual(['A', 'B', 'C']);
    expect(v.current.name).toBe('A');
    expect(min(v.current.remainingMs)).toBe(10);
    expect(Math.round(v.tasks[1].remainingMs / 1000)).toBe(50 * 60 + 22);
    expect(Math.round(v.tasks[2].remainingMs / 1000)).toBe(29 * 60 + 38);
    expect(min(v.tasks[1].consumedMs)).toBe(10);
    expectInvariant(run, at(14, 30));
  });
});

describe('tasks never end on their own', () => {
  test('the current task stays current long after its budget', () => {
    const run = startRun(plan(), at(14));
    const v = viewRun(run, at(15, 59));
    expect(v.current.name).toBe('A');
    expect(min(v.current.remainingMs)).toBe(-89);
  });
  test('other tasks do not change while the current is within its budget', () => {
    const run = startRun(plan(), at(14));
    expect(remaining(viewRun(run, at(14, 20)))).toEqual({ A: 10, B: 60, C: 30 });
  });
});

describe('completing an upcoming task', () => {
  test('its whole budget goes to the others, the current included, and the current stays', () => {
    let run = startRun(plan(), at(14));
    run = completeTask(run, idOf(run, 'C'), at(14, 10));
    const v = viewRun(run, at(14, 10));
    expect(v.current.name).toBe('A');
    // 30 min shared by reference: A needs 20, B needs 60.
    expect(remaining(v)).toEqual({ A: 27.5, B: 82.5, C: 30 });
    expect(v.tasks[2].status).toBe('done');
    expectInvariant(run, at(14, 10));
  });
});

describe('postponing', () => {
  test('an overrun task comes back with 0 and keeps showing its excess', () => {
    let run = startRun(plan(), at(14));
    run = postponeTask(run, idOf(run, 'A'), at(14, 40));
    let v = viewRun(run, at(14, 40));
    expect(remaining(v)).toEqual({ B: 160 / 3, A: 0, C: 80 / 3 });
    run = completeTask(run, idOf(run, 'B'), at(15, 30));
    v = viewRun(run, at(15, 30));
    expect(v.current.name).toBe('A');
    expect(min(v.current.remainingMs)).toBe(-10);
    expectInvariant(run, at(15, 30));
  });
  test('the last pending task bounces: nothing changes', () => {
    let run = startRun(plan([{ name: 'A', minutes: 10 }]), at(14));
    expect(postponeTask(run, idOf(run, 'A'), at(14, 5))).toBe(run);
  });
  test('postponing an upcoming task only changes the order', () => {
    let run = startRun(plan(), at(14));
    const before = remaining(viewRun(run, at(14, 5)));
    run = postponeTask(run, idOf(run, 'B'), at(14, 5));
    const v = viewRun(run, at(14, 5));
    expect(v.tasks.map((t) => t.name)).toEqual(['A', 'C', 'B']);
    expect(remaining(v)).toEqual(before);
    expect(v.current.name).toBe('A');
  });
  test('the new current task gets a new currentSinceMs, the old one does not change by commit', () => {
    let run = startRun(plan(), at(14));
    run = completeTask(run, idOf(run, 'C'), at(14, 5));
    expect(run.currentSinceMs).toBe(at(14));
    run = postponeTask(run, idOf(run, 'A'), at(14, 6));
    expect(run.currentSinceMs).toBe(at(14, 6));
  });
});

describe('+5 min on the current task', () => {
  test('within the budget it adds 5 min, taken from the buffer first', () => {
    let run = startRun(plan(), at(13, 50));
    run = addTimeToCurrent(run, at(14, 16));
    const v = viewRun(run, at(14, 16));
    expect(min(v.current.remainingMs)).toBe(9);
    expect(min(v.bufferMs)).toBe(5);
    expect(remaining(v)).toEqual({ A: 9, B: 60, C: 30 });
  });
  test('after an overrun it gives 5 min from now, taken from the next tasks', () => {
    let run = startRun(plan(), at(14));
    run = addTimeToCurrent(run, at(14, 33));
    const v = viewRun(run, at(14, 33));
    expect(min(v.current.remainingMs)).toBe(5);
    // 3 min of overrun + 5 min, taken 2:1 from B and C.
    expect(remaining(v)).toEqual({ A: 5, B: 60 - 8 * 2 / 3, C: 30 - 8 / 3 });
    expectInvariant(run, at(14, 33));
  });
});

describe('buffer', () => {
  test('releasing it gives everything to the pending tasks, current included', () => {
    let run = startRun(plan(), at(13, 40));
    run = releaseBuffer(run, at(13, 40));
    const v = viewRun(run, at(13, 40));
    expect(v.bufferMs).toBe(0);
    expect(remaining(v)).toEqual({ A: 35, B: 70, C: 35 });
    expectInvariant(run, at(13, 40));
  });
  test('when everything is done, the leftover becomes free time', () => {
    let run = startRun(plan([{ name: 'A', minutes: 30 }]), at(14));
    run = completeTask(run, idOf(run, 'A'), at(14, 10));
    const v = viewRun(run, at(14, 10));
    expect(v.allDone).toBe(true);
    expect(min(v.bufferMs)).toBe(20 + 120 - 30);
  });
  test('a 0-min postponed overrun task gets nothing from a leftover', () => {
    let run = startRun(plan([{ name: 'A', minutes: 10 }, { name: 'B', minutes: 10 }, { name: 'C', minutes: 10 }], at(14, 30)), at(14));
    run = postponeTask(run, idOf(run, 'A'), at(14, 12));
    run = completeTask(run, idOf(run, 'B'), at(14, 13));
    const v = viewRun(run, at(14, 13));
    expect(v.current.name).toBe('A');
    expect(min(v.current.remainingMs)).toBe(-2);
    expectInvariant(run, at(14, 13));
  });
});

describe('deadline', () => {
  test('+5 min on the deadline gives the time to the pending tasks', () => {
    let run = startRun(plan(), at(14, 30));
    run = extendDeadline(run, at(14, 30));
    expect(run.deadlineMs).toBe(at(16, 5));
    expectInvariant(run, at(14, 30));
    expect(min(viewRun(run, at(14, 30)).tasks[0].remainingMs)).toBeCloseTo(23.75, 5);
  });
  test('moving the deadline earlier takes from the buffer first', () => {
    let run = startRun(plan(), at(13, 40));
    run = setDeadline(run, at(15, 50), at(13, 40));
    expect(min(run.bufferMs)).toBe(10);
    expect(remaining(viewRun(run, at(13, 40)))).toEqual({ A: 30, B: 60, C: 30 });
  });
  test('after the deadline, pending tasks have 0 and the delay counts in real time', () => {
    const run = startRun(plan(), at(14));
    const v = viewRun(run, at(16, 5, 20));
    expect(v.late).toBe(true);
    expect(v.untilDeadlineMs).toBe(-(5 * 60 + 20) * 1000);
    expect(remaining(v)).toEqual({ A: -(95 + 20 / 60), B: 0, C: 0 });
    expect(viewRun(run, at(16) + 12 * 60 * MIN_MS).expired).toBe(true);
  });
  test('starting after the deadline gives 0 to everybody', () => {
    const run = startRun(plan(), at(16, 10));
    expect(run.tasks.every((t) => t.budgetMs === 0)).toBe(true);
  });
  test('extending a passed deadline into the future gives the new time', () => {
    let run = startRun(plan(), at(14));
    run = setDeadline(run, at(16, 30), at(16, 10));
    const v = viewRun(run, at(16, 10));
    expect(v.late).toBe(false);
    expectInvariant(run, at(16, 10));
  });
});

describe('persistence by timestamps', () => {
  test('reopening 20 minutes later counts those minutes', () => {
    const run = JSON.parse(JSON.stringify(startRun(plan(), at(14))));
    const v = viewRun(run, at(14, 20));
    expect(v.current.name).toBe('A');
    expect(min(v.current.remainingMs)).toBe(10);
    expect(v.deadlineMs).toBe(at(16));
  });
  test('viewRun never changes the stored run', () => {
    const run = startRun(plan(), at(14));
    const copy = JSON.stringify(run);
    viewRun(run, at(15));
    expect(JSON.stringify(run)).toBe(copy);
  });
});

describe('edit mode during a run', () => {
  const editOf = (run, changes = {}) => run.tasks.filter((t) => t.status === 'pending')
    .map((t) => ({ id: t.id, name: t.name, estimateMs: (changes[t.name] ?? min(t.estimateMs)) * MIN_MS }));

  test('only reordering moves no time', () => {
    let run = startRun(plan(), at(14));
    const tasks = editOf(run);
    run = applyEdit(run, { tasks: [tasks[0], tasks[2], tasks[1]] }, at(14, 5));
    expect(remaining(viewRun(run, at(14, 5)))).toEqual({ A: 25, C: 30, B: 60 });
  });
  test('increasing the current estimate takes from the next tasks', () => {
    let run = startRun(plan(), at(14));
    run = applyEdit(run, { tasks: editOf(run, { A: 39 }) }, at(14, 10));
    const v = viewRun(run, at(14, 10));
    expect(remaining(v)).toEqual({ A: 29, B: 54, C: 27 });
    expectInvariant(run, at(14, 10));
  });
  test('reducing an estimate never erases consumed time', () => {
    let run = startRun(plan(), at(14));
    run = applyEdit(run, { tasks: editOf(run, { A: 5 }) }, at(14, 10));
    const v = viewRun(run, at(14, 10));
    expect(min(v.current.consumedMs)).toBe(10);
    expect(v.current.remainingMs).toBe(0);
    // The 20 min A still had go to B and C (2:1).
    expect(remaining(v)).toEqual({ A: 0, B: 220 / 3, C: 110 / 3 });
    expectInvariant(run, at(14, 10));
  });
  test('a new task uses the buffer first', () => {
    let run = startRun(plan(), at(13, 40));
    run = applyEdit(run, { tasks: [...editOf(run), { name: 'D', estimateMs: 15 * MIN_MS }] }, at(13, 40));
    const v = viewRun(run, at(13, 40));
    expect(min(v.bufferMs)).toBe(5);
    expect(remaining(v)).toEqual({ A: 30, B: 60, C: 30, D: 15 });
  });
  test('a new task shares the remaining time with the tasks still to do', () => {
    let run = startRun(plan(), at(14));
    run = completeTask(run, idOf(run, 'A'), at(14));
    // B (current) and C expanded to 80 and 40. The current keeps its time; adding D (30)
    // divides C's 40 min between C and D by reference.
    run = applyEdit(run, { tasks: [...editOf(run), { name: 'D', estimateMs: 30 * MIN_MS }] }, at(14));
    const v = viewRun(run, at(14));
    expect(remaining(v)).toEqual({ A: 30, B: 80, C: 20, D: 20 });
    run = applyEdit(run, { tasks: [...editOf(run), { name: 'E', estimateMs: 30 * MIN_MS }] }, at(14));
    expect(remaining(viewRun(run, at(14)))).toEqual({ A: 30, B: 80, C: 40 / 3, D: 40 / 3, E: 40 / 3 });
    expectInvariant(run, at(14));
  });
  test('removing a task frees its time for the others', () => {
    let run = startRun(plan(), at(14));
    run = applyEdit(run, { tasks: editOf(run).filter((t) => t.name !== 'C') }, at(14));
    expect(remaining(viewRun(run, at(14)))).toEqual({ A: 30, B: 90 });
  });
  test('moving another task to the top makes it current; the old current is paused', () => {
    let run = startRun(plan(), at(14));
    const tasks = editOf(run);
    run = applyEdit(run, { tasks: [tasks[1], tasks[0], tasks[2]] }, at(14, 10));
    const v = viewRun(run, at(14, 20));
    expect(v.current.name).toBe('B');
    expect(min(v.current.consumedMs)).toBe(10);
    expect(min(v.tasks.find((t) => t.name === 'A').consumedMs)).toBe(10);
  });
  test('changing the deadline in the editor gives or takes time', () => {
    let run = startRun(plan(), at(14));
    run = applyEdit(run, { tasks: editOf(run), deadlineMs: at(16, 12) }, at(14));
    expect(viewRun(run, at(14)).bufferMs).toBe(0);
    expectInvariant(run, at(14));
    expect(claimOf(run.tasks[1])).toBe(66 * MIN_MS);
  });
  test('when everything is done, new tasks use the free time', () => {
    let run = startRun(plan([{ name: 'A', minutes: 30 }], at(15)), at(14));
    run = completeTask(run, idOf(run, 'A'), at(14, 10));
    run = applyEdit(run, { tasks: [{ name: 'Extra', estimateMs: 20 * MIN_MS }] }, at(14, 10));
    const v = viewRun(run, at(14, 10));
    expect(v.current.name).toBe('Extra');
    expect(min(v.current.remainingMs)).toBe(20);
    expect(min(v.bufferMs)).toBe(30);
    expectInvariant(run, at(14, 10));
  });
});
