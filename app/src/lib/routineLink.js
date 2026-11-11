// Routine links, version 3 (specifications.md §14, docs/url-rotina-v3.md):
//   ?rotina=3.HHMM.Task-min.Task-min...&nome=Routine_name
// Name grammar inherited from Ver o Tempo's v2: `_` is a space, ASCII punctuation is
// escaped as `~XX` (uppercase hex), other Unicode (accents, emoji) may be literal or
// percent-encoded. Literal underscores are not supported.
import { taskType, typeProps } from './taskTypes';

export const LINK_ERROR = 'Não foi possível abrir a rotina do link. Nada foi alterado.';
export const NAME_ERROR = 'O link reserva _ para espaços. Remova underscores dos nomes.';
export const LIMITS = { tasks: 40, taskMinutes: 720, totalMinutes: 1440, nameLength: 80, valueLength: 6000 };

const ESCAPABLE = new Set(Array.from({ length: 95 }, (_, i) => String.fromCharCode(i + 32))
  .filter((char) => !/[A-Za-z0-9_ -]/.test(char)));

function fail(reason) {
  throw Object.assign(new Error(LINK_ERROR), { reason });
}

export function validName(name) {
  return typeof name === 'string' && !!name.trim() && name.length <= LIMITS.nameLength &&
    !Array.from(name).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) &&
    name.isWellFormed();
}

export function encodeName(name) {
  if (name.includes('_') || !name.isWellFormed()) throw Object.assign(new Error(NAME_ERROR), { reason: 'underscore' });
  return Array.from(name, (char) => {
    if (char === ' ') return '_';
    if (ESCAPABLE.has(char)) return '~' + char.charCodeAt(0).toString(16).toUpperCase();
    return char;
  }).join('');
}

// Validates before expanding: an escaped character never becomes syntax.
function decodeName(wire) {
  let name = '';
  for (let i = 0; i < wire.length; i++) {
    const char = wire[i];
    if (char === '~') {
      const hex = wire.slice(i + 1, i + 3);
      const decoded = String.fromCharCode(parseInt(hex, 16));
      if (!/^[0-9A-F]{2}$/.test(hex) || !ESCAPABLE.has(decoded)) fail('invalid-escape');
      name += decoded;
      i += 2;
    } else if (char === '_') name += ' ';
    else if (/[A-Za-z0-9-]/.test(char) || char.charCodeAt(0) >= 128) name += char;
    else fail('invalid-name-character');
  }
  if (!validName(name)) fail('invalid-name');
  return name;
}

// One bounded UTF-8 pass: percent bytes may only encode non-ASCII characters, so no value
// is ever decoded twice.
function decodeValue(raw) {
  const value = raw.replace(/(?:%[0-9a-fA-F]{2})+/g, (bytes) => {
    let decoded;
    try { decoded = decodeURIComponent(bytes); } catch (_) { fail('malformed-percent'); }
    if (Array.from(decoded).some((char) => char.charCodeAt(0) < 128)) fail('encoded-ascii');
    return decoded;
  });
  if (value.includes('%')) fail('malformed-percent');
  if (!value.isWellFormed()) fail('invalid-unicode');
  return value;
}

function rawParams(search) {
  const params = {};
  for (const pair of String(search || '').replace(/^\?/, '').split('&')) {
    if (!pair) continue;
    const separator = pair.indexOf('=');
    const key = separator < 0 ? pair : pair.slice(0, separator);
    const value = separator < 0 ? '' : pair.slice(separator + 1);
    (params[key] = params[key] || []).push(value);
  }
  return params;
}

export function parseRoutineLink(search) {
  const params = rawParams(search);
  if (!params.rotina) return { status: 'absent' };
  try {
    if (params.rotina.length !== 1 || (params.nome && params.nome.length !== 1) || (params.tipos && params.tipos.length !== 1)) fail('duplicate-parameter');
    const raw = params.rotina[0];
    if (raw.length > LIMITS.valueLength) fail('too-long');
    const parts = decodeValue(raw).split('.');
    if (parts[0] !== '3') fail('unsupported-version');
    const time = parts[1] || '';
    if (!/^\d{4}$/.test(time) || Number(time.slice(0, 2)) > 23 || Number(time.slice(2)) > 59) fail('invalid-deadline');
    const entries = parts.slice(2);
    if (!entries.length) fail('missing-tasks');
    if (entries.length > LIMITS.tasks) fail('too-many-tasks');
    let total = 0;
    const tasks = entries.map((entry) => {
      const dash = entry.lastIndexOf('-');
      if (dash <= 0) fail('invalid-task');
      const minutesText = entry.slice(dash + 1);
      if (!/^[1-9]\d{0,3}$/.test(minutesText)) fail('invalid-minutes');
      const minutes = Number(minutesText);
      if (minutes > LIMITS.taskMinutes) fail('task-too-long');
      total += minutes;
      if (total > LIMITS.totalMinutes) fail('routine-too-long');
      return { name: decodeName(entry.slice(0, dash)), minutes };
    });
    if (params.tipos) {
      const types = params.tipos[0].split(',');
      if (types.length !== tasks.length || types.some((type) => !['normal', 'fixo', 'folga'].includes(type)) ||
        types.filter((type) => type === 'folga').length > 1) fail('invalid-task-types');
      tasks.forEach((task, i) => Object.assign(task, typeProps({ type: { fixo: 'fixed', folga: 'buffer' }[types[i]] })));
    }
    const deadline = `${time.slice(0, 2)}:${time.slice(2)}`;
    const name = params.nome ? decodeName(decodeValue(params.nome[0])) : `Rotina fim ${deadline}`;
    return { status: 'valid', plan: { name, deadline, tasks } };
  } catch (error) {
    return { status: 'invalid', error: LINK_ERROR, reason: error.reason || 'unexpected-input' };
  }
}

// plan: { name, deadline: 'HH:MM', tasks: [{ name, minutes }] }
export function serializeRoutineLink(baseUrl, plan) {
  if (!plan || !/^\d{2}:\d{2}$/.test(plan.deadline || '') || !Array.isArray(plan.tasks) || !plan.tasks.length) {
    throw new Error(LINK_ERROR);
  }
  const entries = plan.tasks.map((task) => {
    if (!validName(task?.name) || !Number.isInteger(task.minutes)) throw new Error(LINK_ERROR);
    return `${encodeName(task.name)}-${task.minutes}`;
  });
  const url = new URL(baseUrl);
  url.searchParams.delete('rotina');
  url.searchParams.delete('nome');
  url.searchParams.delete('tipos');
  const other = url.searchParams.toString();
  const name = plan.name && validName(plan.name) ? `&nome=${encodeName(plan.name)}` : '';
  const types = plan.tasks.some((t) => taskType(t) !== 'normal')
    ? '&tipos=' + plan.tasks.map((t) => ({ normal: 'normal', fixed: 'fixo', buffer: 'folga' })[taskType(t)]).join(',') : '';
  url.search = `${other ? other + '&' : ''}rotina=3.${plan.deadline.replace(':', '')}.${entries.join('.')}${name}${types}`;
  if (parseRoutineLink(url.search).status !== 'valid') throw new Error(LINK_ERROR);
  return url.href;
}
