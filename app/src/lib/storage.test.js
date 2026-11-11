import { startRun } from './engine';
import {
  DEFAULT_SETTINGS, KEYS, loadDraft, loadRun, loadSettings, loadTemplates, normalizePlan,
  saveRun, saveSettings, saveTemplates, upsertTemplate,
} from './storage';

beforeEach(() => localStorage.clear());

test('plans are validated: bad tasks are dropped, bad deadlines rejected', () => {
  expect(normalizePlan({ name: 'X', deadline: '25:00', tasks: [] })).toBeNull();
  const plan = normalizePlan({ name: 'X', deadline: '09:00', tasks: [{ name: 'ok', minutes: 5 }, { name: 'zero', minutes: 0 }, null] });
  expect(plan.tasks.map((t) => t.name)).toEqual(['ok']);
  expect(typeof plan.tasks[0].id).toBe('string');
});

test('corrupt storage falls back without throwing', () => {
  localStorage.setItem(KEYS.draft, '{bad json');
  localStorage.setItem(KEYS.run, JSON.stringify({ version: 1, tasks: 'no' }));
  localStorage.setItem(KEYS.templates, JSON.stringify({}));
  expect(loadDraft()).toBeNull();
  expect(loadRun()).toBeNull();
  expect(loadTemplates()).toEqual([]);
  expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
});

test('a run survives a round trip', () => {
  const run = startRun({ name: 'T', deadlineMs: 3_600_000, tasks: [{ name: 'A', minutes: 10 }] }, 0);
  saveRun(run);
  expect(loadRun()).toEqual(run);
  saveRun(null);
  expect(loadRun()).toBeNull();
});

test('settings keep only known values', () => {
  saveSettings({ sound: false, restAfterMin: 3 });
  expect(loadSettings()).toEqual({ sound: false, restAfterMin: 2 });
});

test('upsertTemplate inserts, then replaces by id', () => {
  const plan = { name: 'Manhã', deadline: '08:00', tasks: [{ id: 'p1', name: 'Café', minutes: 10 }] };
  const first = upsertTemplate([], plan);
  expect(first.list).toHaveLength(1);
  const second = upsertTemplate(first.list, { ...plan, id: first.id, name: 'Manhã cedo' });
  expect(second.list).toEqual([{ id: first.id, name: 'Manhã cedo', deadline: '08:00', tasks: [{ name: 'Café', minutes: 10 }] }]);
  saveTemplates(second.list);
  expect(loadTemplates()[0].name).toBe('Manhã cedo');
});

test('fixed and buffer types persist in templates, drafts and active runs', () => {
  const plan = { name: 'Tipos', deadline: '09:00', tasks: [
    { name: 'A', minutes: 20, type: 'fixed' }, { name: 'Reserva', minutes: 10, type: 'buffer' },
  ] };
  const saved = upsertTemplate([], plan);
  saveTemplates(saved.list);
  expect(loadTemplates()[0].tasks.map((t) => t.type)).toEqual(['fixed', 'buffer']);
  localStorage.setItem(KEYS.draft, JSON.stringify(plan));
  expect(loadDraft().tasks.map((t) => t.type)).toEqual(['fixed', 'buffer']);
  const run = startRun({ ...plan, deadlineMs: 40 * 60000 }, 0);
  saveRun(run);
  expect(loadRun()).toEqual(run);
});

test('old tasks remain flexible and duplicate buffer flags do not create multiple reserves', () => {
  const plan = normalizePlan({ name: 'X', deadline: '09:00', tasks: [
    { name: 'A', minutes: 5 }, { name: 'B', minutes: 5, type: 'buffer' },
    { name: 'C', minutes: 5, type: 'buffer' }, { name: 'D', minutes: 5, type: 'unknown' },
  ] });
  expect(plan.tasks.map((t) => t.type)).toEqual([undefined, 'buffer', undefined, undefined]);
});
