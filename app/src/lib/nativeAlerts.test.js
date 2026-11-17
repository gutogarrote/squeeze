import { alertPlan, planSignature } from './nativeAlerts';
import { LEVEL } from './alerts';
import { TONES } from './sound';

const M = 60000;
const view = (remainingMs, since = 1000) => ({ current: { id: 'a', name: 'Banho', remainingMs }, currentSinceMs: since });

test('each threshold of the current task becomes an absolute time with its tones', () => {
  const now = 10 * M;
  const plan = alertPlan(view(20 * M), now);
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
