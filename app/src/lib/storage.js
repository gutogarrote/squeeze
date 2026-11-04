// Local persistence (localStorage only). Every read validates and falls back safely.
import { isClock } from './clock';
import { LIMITS } from './routineLink';

export const KEYS = {
  draft: 'squeeze:draft',
  templates: 'squeeze:templates',
  run: 'squeeze:run',
  settings: 'squeeze:settings',
};

export const REST_OPTIONS = [2, 5, 10, 0];
export const DEFAULT_SETTINGS = { sound: true, restAfterMin: 2 };

export const EXAMPLE_PLAN = {
  name: 'Tarde',
  deadline: '15:00',
  templateId: null,
  tasks: [
    { name: 'Orçamento', minutes: 60 },
    { name: 'Guardar equipamentos', minutes: 20 },
    { name: 'Banho e troca de roupa', minutes: 25 },
    { name: 'Almoço', minutes: 20 },
    { name: 'Preparar saída', minutes: 20 },
  ],
};

export function makeId(prefix = 'r') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

function write(key, value) {
  try {
    if (value === null || value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (_) { return false; }
}

const isText = (s, max = LIMITS.nameLength) => typeof s === 'string' && s.length <= max;
const isMinutes = (m) => Number.isInteger(m) && m >= 1 && m <= LIMITS.taskMinutes;

// Plans are drafts and saved routines: { id?, name, deadline, templateId?, tasks }.
export function normalizePlan(value) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.tasks)) return null;
  if (!isClock(value.deadline) || !isText(value.name ?? '')) return null;
  const tasks = value.tasks.slice(0, LIMITS.tasks)
    .filter((t) => t && isText(t.name) && isMinutes(t.minutes))
    .map((t) => ({ id: typeof t.id === 'string' ? t.id : makeId('p'), name: t.name, minutes: t.minutes }));
  return {
    ...(typeof value.id === 'string' ? { id: value.id } : {}),
    name: value.name || '',
    deadline: value.deadline,
    templateId: typeof value.templateId === 'string' ? value.templateId : null,
    tasks,
  };
}

const isMs = (n) => Number.isFinite(n);
function isRun(run) {
  return !!run && run.version === 1 && Array.isArray(run.tasks) && isMs(run.deadlineMs) &&
    isMs(run.activatedAtMs) && isMs(run.bufferMs) && Number.isInteger(run.nextId) &&
    run.tasks.every((t) => t && typeof t.id === 'string' && typeof t.name === 'string' &&
      (t.status === 'pending' || t.status === 'done') &&
      ['estimateMs', 'consumedMs', 'budgetMs', 'absorbedMs', 'doneLeftoverMs'].every((k) => isMs(t[k])));
}

export const loadDraft = () => normalizePlan(read(KEYS.draft));
export const saveDraft = (plan) => write(KEYS.draft, plan);

export function loadTemplates() {
  const list = read(KEYS.templates);
  if (!Array.isArray(list)) return [];
  return list.map(normalizePlan).filter((t) => t && t.id);
}
export const saveTemplates = (list) => write(KEYS.templates, list);

export function loadRun() {
  const run = read(KEYS.run);
  return isRun(run) ? run : null;
}
export const saveRun = (run) => write(KEYS.run, run);

export function loadSettings() {
  const s = read(KEYS.settings) || {};
  return {
    sound: typeof s.sound === 'boolean' ? s.sound : DEFAULT_SETTINGS.sound,
    restAfterMin: REST_OPTIONS.includes(s.restAfterMin) ? s.restAfterMin : DEFAULT_SETTINGS.restAfterMin,
  };
}
export const saveSettings = (settings) => write(KEYS.settings, settings);

// Saved routines are templates: saving inserts or replaces by id.
export function upsertTemplate(list, plan) {
  const id = plan.id || plan.templateId || makeId('r');
  const template = { id, name: plan.name.trim() || 'Sem nome', deadline: plan.deadline,
    tasks: plan.tasks.map(({ name, minutes }) => ({ name, minutes })) };
  const exists = list.some((t) => t.id === id);
  return { id, list: exists ? list.map((t) => (t.id === id ? template : t)) : [...list, template] };
}
