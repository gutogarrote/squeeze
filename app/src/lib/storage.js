// Local persistence (localStorage only). Every read validates and falls back safely.
import { isClock } from './clock';
import { LIMITS } from './routineLink';
import { ALERT_STYLES, REMINDER_OPTIONS } from './alerts';
import { normalizeTaskTypes, typeProps } from './taskTypes';

export const KEYS = {
  draft: 'squeeze:draft',
  templates: 'squeeze:templates',
  run: 'squeeze:run',
  settings: 'squeeze:settings',
};

export const REST_OPTIONS = [2, 5, 10, 0];
export { ALERT_STYLES, REMINDER_OPTIONS };
export const ROUTINE_SORTS = ['recent', 'end', 'start', 'manual'];
export const DEFAULT_SETTINGS = { sound: true, restAfterMin: 2, reminderMin: 2, alertStyle: 'urgent', routineSort: 'recent' };

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
  const tasks = normalizeTaskTypes(value.tasks.slice(0, LIMITS.tasks)
    .filter((t) => t && isText(t.name) && isMinutes(t.minutes))
    .map((t) => ({ id: typeof t.id === 'string' ? t.id : makeId('p'), name: t.name, minutes: t.minutes, ...typeProps(t) })));
  return {
    ...(typeof value.id === 'string' ? { id: value.id } : {}),
    name: value.name || '',
    deadline: value.deadline,
    templateId: typeof value.templateId === 'string' ? value.templateId : null,
    tasks,
    ...(Number.isFinite(value.lastUsedAt) ? { lastUsedAt: value.lastUsedAt } : {}),
  };
}

const isMs = (n) => Number.isFinite(n);
function isRun(run) {
  return !!run && run.version === 1 && Array.isArray(run.tasks) && isMs(run.deadlineMs) &&
    isMs(run.activatedAtMs) && isMs(run.bufferMs) && Number.isInteger(run.nextId) &&
    run.tasks.filter((t) => t?.type === 'buffer').length <= 1 &&
    run.tasks.every((t) => t && [undefined, 'fixed', 'buffer'].includes(t.type) && typeof t.id === 'string' && typeof t.name === 'string' &&
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
    reminderMin: REMINDER_OPTIONS.includes(s.reminderMin) ? s.reminderMin : DEFAULT_SETTINGS.reminderMin,
    alertStyle: ALERT_STYLES.includes(s.alertStyle) ? s.alertStyle : DEFAULT_SETTINGS.alertStyle,
    routineSort: ROUTINE_SORTS.includes(s.routineSort) ? s.routineSort : DEFAULT_SETTINGS.routineSort,
  };
}
export const saveSettings = (settings) => write(KEYS.settings, settings);

// Saved routines are templates: saving inserts or replaces by id.
export function upsertTemplate(list, plan) {
  const id = plan.id || plan.templateId || makeId('r');
  const template = { id, name: plan.name.trim() || 'Sem nome', deadline: plan.deadline,
    tasks: normalizeTaskTypes(plan.tasks).map((t) => ({ name: t.name, minutes: t.minutes, ...typeProps(t) })) };
  const previous = list.find((t) => t.id === id);
  if (previous && Number.isFinite(previous.lastUsedAt)) template.lastUsedAt = previous.lastUsedAt;
  return { id, list: previous ? list.map((t) => (t.id === id ? template : t)) : [...list, template] };
}
