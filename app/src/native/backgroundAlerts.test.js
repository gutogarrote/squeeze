import { vi } from 'vitest';
import { addTimeToCurrent, applyEdit, completeTask, extendDeadline, postponeTask, reactivateTask, startRun } from '../lib/engine';
import { LEVEL } from '../lib/alerts';
import { ALERTS, createBackgroundAlerts, notificationIds, pendingAlerts } from './backgroundAlerts';

const MIN = 60000;
const START = Date.UTC(2026, 10, 12, 12);
const makeRun = () => startRun({ name: 'Teste', deadlineMs: START + 40 * MIN,
  tasks: [{ name: 'Primeira', minutes: 10 }, { name: 'Segunda', minutes: 30 }] }, START);

function setup(display = 'granted', platform = 'android') {
  let now = START;
  const pending = new Map();
  const notifications = {
    cancel: vi.fn(async ({ notifications: ids }) => ids.forEach(({ id }) => pending.delete(id))),
    schedule: vi.fn(async ({ notifications: list }) => list.forEach(n => pending.set(n.id, n))),
    checkPermissions: vi.fn(async () => ({ display })),
    requestPermissions: vi.fn(async () => ({ display: 'granted' })),
    createChannel: vi.fn(async () => {}),
  };
  const play = vi.fn();
  const onAlert = vi.fn();
  const onStatus = vi.fn();
  const controller = createBackgroundAlerts({ notifications, platform, clock: () => now, play, onAlert, onStatus });
  return { controller, notifications, pending, play, onAlert, onStatus, setNow: n => { now = n; } };
}

test('schedules only the current task, using its budget and activation', () => {
  const run = makeRun();
  const notifications = pendingAlerts(run, START);
  expect(notifications.map(n => [n.id, n.schedule.at.getTime()])).toEqual([
    [5101, START + 5 * MIN], [5102, START + 9 * MIN], [5103, START + 10 * MIN],
  ]);
  expect(notifications.every(n => n.body === 'Primeira' && n.isExactNotification === false && n.schedule.allowWhileIdle)).toBe(true);
  expect(notifications.map(n => n.sound)).toEqual(['squeeze_five.wav', 'squeeze_one.wav', 'squeeze_zero.wav']);
  expect(notifications[0].extra).toEqual({ taskId: run.tasks[0].id, activation: START });
});

test('5:04 remaining schedules its first warning four seconds from now', () => {
  const run = makeRun();
  const now = START + 5 * MIN - 4000;
  expect(pendingAlerts(run, now)[0].schedule.at.getTime()).toBe(now + 4000);
  expect(pendingAlerts(run, START + 5 * MIN).map(n => n.id)).toEqual([5102, 5103]);
});

test('short, overdue, ended, fully completed and expired routines have no obsolete warnings', () => {
  const run = makeRun();
  expect(pendingAlerts(run, START + 9.5 * MIN).map(n => n.id)).toEqual([5103]);
  expect(pendingAlerts(run, START + 11 * MIN)).toEqual([]);
  expect(pendingAlerts(null, START)).toEqual([]);
  const done = completeTask(completeTask(run, run.tasks[0].id, START), run.tasks[1].id, START);
  expect(pendingAlerts(done, START)).toEqual([]);
  expect(pendingAlerts(run, run.deadlineMs + 12 * 60 * MIN)).toEqual([]);
});

test('compressed budgets determine the alert times', () => {
  const run = startRun({ name: 'Atrasado', deadlineMs: START + 20 * MIN,
    tasks: [{ name: 'A', minutes: 10 }, { name: 'B', minutes: 30 }] }, START);
  expect(pendingAlerts(run, START).map(n => [n.id, n.schedule.at.getTime()]))
    .toEqual([[5102, START + 4 * MIN], [5103, START + 5 * MIN]]);
});

test('initialization checks permission without prompting and makes three separate sound channels', async () => {
  const s = setup();
  await s.controller.initialize();
  expect(s.notifications.requestPermissions).not.toHaveBeenCalled();
  expect(s.notifications.cancel).toHaveBeenCalledWith({ notifications: notificationIds });
  expect(s.notifications.createChannel).toHaveBeenCalledTimes(3);
  expect(s.notifications.createChannel.mock.calls.map(([c]) => c.sound)).toEqual(ALERTS.map(a => `squeeze_${a.name}.wav`));
  expect(s.notifications.schedule).not.toHaveBeenCalled();
});

test('iOS does not call Android channel APIs', async () => {
  const s = setup('granted', 'ios');
  await s.controller.initialize();
  expect(s.notifications.createChannel).not.toHaveBeenCalled();
});

test('backgrounding hands future warnings to native notifications; returning cancels them without replay', async () => {
  const s = setup();
  const run = makeRun();
  s.controller.update(run, true);
  await s.controller.initialize();
  s.controller.setActive(false);
  await s.controller.flush();
  expect(s.pending.size).toBe(3);
  s.setNow(START + 9.5 * MIN);
  s.controller.update(run, true); // Some WebViews keep ticking briefly while hidden.
  expect(s.play).not.toHaveBeenCalled();
  s.controller.setActive(true);
  s.controller.update(run, true); // Even if the React UI has not refreshed its clock.
  await s.controller.flush();
  expect(s.pending.size).toBe(0);
  expect(s.play).not.toHaveBeenCalled();
  s.setNow(START + 10 * MIN);
  s.controller.update(run, true);
  expect(s.play).toHaveBeenCalledExactlyOnceWith(LEVEL.zero);
});

test('foreground thresholds play once and do not schedule native notifications', async () => {
  const s = setup();
  const run = makeRun();
  s.controller.update(run, true);
  await s.controller.initialize();
  for (const minutes of [5, 5.5, 9, 9.5, 10, 11]) {
    s.setNow(START + minutes * MIN);
    s.controller.update(run, true);
  }
  expect(s.play.mock.calls).toEqual([[LEVEL.five], [LEVEL.one], [LEVEL.zero]]);
  expect(s.notifications.schedule).not.toHaveBeenCalled();
});

test('starting a short task after opening the planner plays only its most severe current warning', async () => {
  const s = setup();
  s.controller.update(null, true);
  await s.controller.initialize();
  const short = startRun({ name: 'Curta', deadlineMs: START + 30000, tasks: [{ name: 'A', minutes: 1 }] }, START);
  s.controller.update(short, true);
  expect(s.play).toHaveBeenCalledExactlyOnceWith(LEVEL.one);
});

test('restoring an already running task silently records thresholds that already passed', async () => {
  const s = setup();
  s.setNow(START + 9.5 * MIN);
  s.controller.update(makeRun(), true);
  await s.controller.initialize();
  expect(s.play).not.toHaveBeenCalled();
});

test('switching tasks at 5:04 cancels the old warning before scheduling the new task', async () => {
  const s = setup();
  const run = makeRun();
  s.controller.update(run, true);
  await s.controller.initialize();
  const now = START + 5 * MIN - 4000;
  s.setNow(now);
  s.controller.setActive(false);
  await s.controller.flush();
  const oldAt = s.pending.get(5101).schedule.at.getTime();
  s.controller.update(postponeTask(run, run.tasks[0].id, now), true);
  await s.controller.flush();
  expect(s.pending.get(5101).body).toBe('Segunda');
  expect(s.pending.get(5101).schedule.at.getTime()).not.toBe(oldAt);
  const lastSchedule = s.notifications.schedule.mock.invocationCallOrder.at(-1);
  expect(s.notifications.cancel.mock.invocationCallOrder.at(-1)).toBeLessThan(lastSchedule);
});

test('adding minutes at 5:04 replaces the four-second warning with one five minutes later', async () => {
  const s = setup();
  const run = makeRun();
  s.controller.update(run, true);
  await s.controller.initialize();
  const now = START + 5 * MIN - 4000;
  s.setNow(now);
  s.controller.setActive(false);
  await s.controller.flush();
  s.controller.update(addTimeToCurrent(run, now), true);
  await s.controller.flush();
  expect(s.pending.get(5101).schedule.at.getTime()).toBe(now + 5 * MIN + 4000);
});

test.each(['mute', 'end', 'all done'])('%s cancels every pending warning', async action => {
  const s = setup();
  const run = makeRun();
  s.controller.update(run, true);
  await s.controller.initialize();
  s.controller.setActive(false);
  await s.controller.flush();
  const done = completeTask(completeTask(run, run.tasks[0].id, START), run.tasks[1].id, START);
  s.controller.update(action === 'end' ? null : action === 'all done' ? done : run, action !== 'mute');
  await s.controller.flush();
  expect(s.pending.size).toBe(0);
});

test('deadline edits, task edits, completion and reactivation use the updated engine budget', async () => {
  const s = setup();
  let run = makeRun();
  s.controller.update(run, true);
  await s.controller.initialize();
  s.controller.setActive(false);
  for (const operation of [
    r => extendDeadline(r, START),
    r => applyEdit(r, { name: r.name, deadlineMs: r.deadlineMs,
      tasks: r.tasks.map(t => ({ id: t.id, name: t.name, minutes: t.estimateMs / MIN + 2 })) }, START),
    r => completeTask(r, r.tasks[0].id, START),
    r => reactivateTask(r, r.tasks[0].id, START),
  ]) {
    run = operation(run);
    s.controller.update(run, true);
    await s.controller.flush();
    expect([...s.pending.values()]).toEqual(pendingAlerts(run, START));
  }
});

test('a foreground time extension re-arms the relevant threshold', async () => {
  const s = setup();
  let run = makeRun();
  s.controller.update(run, true);
  await s.controller.initialize();
  s.setNow(START + 5 * MIN);
  s.controller.update(run, true);
  run = addTimeToCurrent(run, START + 5 * MIN);
  s.controller.update(run, true);
  s.setNow(START + 10 * MIN);
  s.controller.update(run, true);
  expect(s.play.mock.calls).toEqual([[LEVEL.five], [LEVEL.five]]);
});

test('denied permission leaves foreground sounds working and can be retried explicitly', async () => {
  const s = setup('denied');
  const run = makeRun();
  s.controller.update(run, true);
  await s.controller.initialize();
  s.setNow(START + 5 * MIN);
  s.controller.update(run, true);
  expect(s.play).toHaveBeenCalledWith(LEVEL.five);
  s.controller.setActive(false);
  await s.controller.flush();
  expect(s.pending.size).toBe(0);
  await s.controller.requestPermission();
  expect(s.pending.size).toBe(2);
});

test('a stale async schedule cannot survive a task change', async () => {
  const s = setup();
  const run = makeRun();
  s.controller.update(run, true);
  await s.controller.initialize();
  let release;
  const scheduled = new Promise(resolve => { release = resolve; });
  s.notifications.schedule.mockImplementationOnce(async ({ notifications }) => {
    await scheduled;
    notifications.forEach(n => s.pending.set(n.id, n));
  });
  s.controller.setActive(false);
  const first = s.controller.flush();
  await Promise.resolve();
  await Promise.resolve();
  s.controller.update(postponeTask(run, run.tasks[0].id, START), true);
  release();
  await first;
  await s.controller.flush();
  expect([...s.pending.values()].every(n => n.body === 'Segunda')).toBe(true);
  expect(s.pending.size).toBe(3);
});

test('scheduling failures are visible and a later retry recovers', async () => {
  const s = setup();
  s.controller.update(makeRun(), true);
  await s.controller.initialize();
  s.notifications.schedule.mockRejectedValueOnce(new Error('OS failure'));
  s.controller.setActive(false);
  await s.controller.flush();
  expect(s.onStatus).toHaveBeenLastCalledWith(expect.objectContaining({ error: expect.stringContaining('Não foi possível') }));
  await s.controller.requestPermission();
  expect(s.pending.size).toBe(3);
  expect(s.onStatus).toHaveBeenLastCalledWith({ permission: 'granted', error: '' });
});

test('an older permission check cannot overwrite permission granted by a user prompt', async () => {
  const s = setup();
  let releaseCheck;
  const oldCheck = new Promise(resolve => { releaseCheck = resolve; });
  s.notifications.checkPermissions.mockReturnValueOnce(oldCheck);
  s.controller.update(makeRun(), true);
  const initialization = s.controller.initialize();
  // Wait until initialization has actually issued the passive check.
  while (!s.notifications.checkPermissions.mock.calls.length) await Promise.resolve();
  await s.controller.requestPermission();
  releaseCheck({ display: 'denied' });
  await initialization;
  s.controller.setActive(false);
  await s.controller.flush();
  expect(s.pending.size).toBe(3);
  expect(s.onStatus).toHaveBeenLastCalledWith({ permission: 'granted', error: '' });
});

test('a failed Android channel initialization is retried before scheduling any sound', async () => {
  const s = setup();
  s.controller.update(makeRun(), true);
  s.notifications.createChannel.mockRejectedValueOnce(new Error('Temporary channel error'));
  await s.controller.initialize();
  expect(s.onStatus).toHaveBeenLastCalledWith(expect.objectContaining({ error: expect.stringContaining('sons') }));
  s.controller.setActive(false);
  await s.controller.requestPermission();
  await s.controller.flush();
  expect(s.pending.size).toBe(3);
  expect(s.notifications.createChannel).toHaveBeenCalledTimes(4);
});

test('cleanup cancels alarms and never schedules more notifications', async () => {
  const s = setup();
  s.controller.update(makeRun(), true);
  await s.controller.initialize();
  s.controller.setActive(false);
  await s.controller.flush();
  await s.controller.dispose();
  s.controller.update(makeRun(), true);
  s.controller.setActive(false);
  expect(s.pending.size).toBe(0);
});
