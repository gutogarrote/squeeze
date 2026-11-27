import { alertAt, alertPlan, planSignature } from './nativeAlerts';
import { LEVEL } from './alerts';
import { SOFT_TONES, TONES } from './sound';

const M = 60000;
const view = (remainingMs, since = 1000) => ({ current: { id: 'a', name: 'Banho', remainingMs }, currentSinceMs: since });

test('each threshold of the current task becomes an absolute time with its tones', () => {
  const now = 10 * M;
  const plan = alertPlan(view(20 * M), now).filter((a) => a.level !== LEVEL.tick);
  expect(plan.map((a) => [a.level, a.atMs])).toEqual([[LEVEL.five, 25 * M], [LEVEL.one, 29 * M], [LEVEL.zero, 30 * M]]);
  expect(plan.map((a) => a.title)).toEqual(['Faltam 5 min', 'Falta 1 min', 'O tempo da tarefa acabou']);
  plan.forEach((a) => {
    expect(a.body).toBe('Banho');
    expect(a.tones).toBe(TONES[a.level]);
  });
});

test('keys stay the same while time passes and change when the task gets more time', () => {
  const before = alertPlan(view(20 * M), 10 * M);
  const later = alertPlan(view(17 * M), 13 * M);
  expect(planSignature(later)).toBe(planSignature(before));
  const extended = alertPlan(view(22 * M), 13 * M);
  expect(extended.map((a) => a.key)).not.toEqual(before.map((a) => a.key));
  // The same task activated again is a different crossing, even ending at the same time.
  expect(alertPlan(view(20 * M, 2000), 10 * M)[0].key).not.toBe(before[0].key);
});

test('thresholds already crossed stay in the plan with past times; no current task, no plan', () => {
  const plan = alertPlan(view(-2 * M), 50 * M);
  expect(plan.every((a) => a.atMs <= 50 * M)).toBe(true);
  expect(alertPlan({ current: null }, 0)).toEqual([]);
  expect(alertPlan(null, 0)).toEqual([]);
});

test('overrun reminders follow the end of the task, for about an hour', () => {
  const now = 10 * M;
  const plan = alertPlan(view(20 * M), now, { reminderMs: 2 * M });
  const reminders = plan.filter((a) => a.level === LEVEL.reminder);
  expect(reminders).toHaveLength(30);
  expect(reminders.slice(0, 3).map((a) => a.atMs)).toEqual([32 * M, 34 * M, 36 * M]);
  expect(reminders[0].tones).toBe(TONES[LEVEL.reminder]);
  expect(new Set(plan.map((a) => a.key)).size).toBe(plan.length);
  expect(alertPlan(view(20 * M), now, { reminderMs: 5 * M }).filter((a) => a.level === LEVEL.reminder)).toHaveLength(12);
  expect(alertPlan(view(20 * M), now).filter((a) => a.level === LEVEL.reminder)).toHaveLength(0);
});

test('the web view plays the reminder that is due, with its alarm key', () => {
  const plan = alertPlan(view(-3 * M), 50 * M, { reminderMs: 2 * M });
  // The task ended at 47 min: reminders at 49, 51, 53...
  expect(alertAt(plan, LEVEL.reminder, 51 * M).atMs).toBe(51 * M);
  expect(alertAt(plan, LEVEL.reminder, 52 * M).atMs).toBe(51 * M);
  expect(alertAt(plan, LEVEL.reminder, 40 * M).atMs).toBe(49 * M);
  expect(alertAt(plan, LEVEL.zero, 50 * M).atMs).toBe(47 * M);
  expect(alertAt([], LEVEL.one, 0)).toBeUndefined();
});

test('5-minute ticks are scheduled from the activation on, and follow the alert style', () => {
  // A 20-min task that started now: ticks at 15 and 10 min left (5 is the threshold).
  const now = 100 * M;
  const start = { current: { id: 'a', name: 'Banho', remainingMs: 20 * M }, currentSinceMs: now };
  const ticks = (plan) => plan.filter((a) => a.level === LEVEL.tick).map((a) => (a.atMs - now) / M);
  expect(ticks(alertPlan(start, now))).toEqual([10, 5, 0]);
  expect(alertPlan(start, now).filter((a) => a.level === LEVEL.tick).map((a) => a.title)).toEqual(['Faltam 10 min', 'Faltam 15 min', 'Faltam 20 min']);
  // Later on, past ticks drop out except the latest one due.
  const later = { ...start, current: { ...start.current, remainingMs: 8 * M } };
  expect(ticks(alertPlan(later, now + 12 * M))).toEqual([10]);
  // A task resumed mid-way does not get ticks from before it became current.
  const resumed = { current: { id: 'a', name: 'Banho', remainingMs: 12 * M }, currentSinceMs: now };
  expect(ticks(alertPlan(resumed, now))).toEqual([2]);
  const soft = alertPlan(start, now, { style: 'soft' });
  expect(soft[0].tones).toBe(SOFT_TONES[LEVEL.five]);
  expect(soft.find((a) => a.level === LEVEL.tick).tones).toBe(SOFT_TONES[LEVEL.tick]);
});
