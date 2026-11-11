// Squeeze time engine (specifications.md §2 and §6). Pure functions: every operation takes
// the run and `nowMs`, and returns a new run. Times are integer milliseconds.
//
// A run is { version, name, templateId, deadlineMs, startedAtMs, activatedAtMs,
// currentSinceMs, bufferMs, nextId, tasks }, and each task is
// { id, name, status: 'pending'|'done', estimateMs, consumedMs, budgetMs, absorbedMs,
//   doneLeftoverMs }.
//
// The current task is the first pending non-buffer task in array order. Its consumedMs is
// "committed" up to activatedAtMs; the time since then is added on every operation.
//
// Values kept apart (never mixed up):
//  - estimate: planned duration;
//  - consumed: time the task really was the current one;
//  - reference: estimate − consumed (min 0), what the estimate says is still missing;
//  - budget: time the plan reserves for the task in this run;
//  - claim: budget − consumed (min 0), the time still reserved ahead of us;
//  - overrun: consumed − budget (min 0); absorbedMs is the part of it already taken
//    from the buffer and the other tasks.
//
// Invariant while the deadline has not passed and fixed tasks still fit:
//   now + Σ claims of pending tasks + buffer = deadline.

import { splitCapped, splitProportional } from './split';
import { normalizeTaskTypes, taskType, typeProps } from './taskTypes';

export const MIN_MS = 60000;
export const FIVE_MIN_MS = 5 * MIN_MS;
export const AUTO_CLOSE_MS = 12 * 60 * MIN_MS;

const sum = (xs) => xs.reduce((s, x) => s + x, 0);
export const claimOf = (t) => Math.max(0, t.budgetMs - t.consumedMs);
export const referenceOf = (t) => Math.max(0, t.estimateMs - t.consumedMs);
export const overrunOf = (t) => Math.max(0, t.consumedMs - t.budgetMs);

const clone = (run) => ({ ...run, tasks: run.tasks.map((t) => ({ ...t })) });
const pendingIndexes = (run) => run.tasks.map((t, i) => (t.status === 'pending' ? i : -1)).filter((i) => i >= 0);

export function currentIndex(run) {
  return run.tasks.findIndex((t) => t.status === 'pending' && taskType(t) !== 'buffer');
}

export function currentTask(run) {
  const i = currentIndex(run);
  return i < 0 ? null : run.tasks[i];
}

function newTask(run, { name, estimateMs, type }) {
  const id = 't' + run.nextId;
  run.nextId += 1;
  return { id, name, ...typeProps({ type }), status: 'pending', estimateMs, consumedMs: 0, budgetMs: 0, absorbedMs: 0, doneLeftoverMs: 0 };
}

function storeBuffer(run, amount) {
  const buffer = run.tasks.find((t) => t.status === 'pending' && taskType(t) === 'buffer');
  if (buffer) addBudget(buffer, amount);
  else run.bufferMs += amount;
}

// Gives `ms` more to a task, counted from now: an overrun already absorbed becomes part of
// the budget, so the task gets exactly `ms` of claim more.
function addBudget(t, ms) {
  if (ms <= 0) return;
  t.budgetMs = Math.max(t.budgetMs, t.consumedMs) + ms;
  t.absorbedMs = 0;
}

// Take `ms` for someone: buffer first, then the other pending tasks in proportion to their
// claims (same percentage for everyone, nobody below zero). Returns what could not be found
// (that part becomes delay past the deadline).
function take(run, ms, exclude = []) {
  let rest = Math.max(0, Math.round(ms));
  const fromBuffer = Math.min(run.bufferMs, rest);
  run.bufferMs -= fromBuffer;
  rest -= fromBuffer;
  const buffers = pendingIndexes(run).filter((i) => taskType(run.tasks[i]) === 'buffer' && !exclude.includes(i));
  buffers.forEach((i) => {
    const amount = Math.min(rest, claimOf(run.tasks[i]));
    run.tasks[i].budgetMs -= amount;
    rest -= amount;
  });
  if (!rest) return 0;
  const idx = pendingIndexes(run).filter((i) => !exclude.includes(i) && taskType(run.tasks[i]) === 'normal');
  const caps = idx.map((i) => claimOf(run.tasks[i]));
  const parts = splitCapped(rest, caps, caps);
  idx.forEach((i, k) => { run.tasks[i].budgetMs -= parts[k]; });
  return rest - sum(parts);
}

// Give `ms` to the other pending tasks in proportion to their references (who still needs
// more gets more). With nobody needing anything, it becomes buffer (free time).
function give(run, ms, exclude = []) {
  const amount = Math.max(0, Math.round(ms));
  if (!amount) return;
  const idx = pendingIndexes(run).filter((i) => !exclude.includes(i) && taskType(run.tasks[i]) === 'normal');
  const weights = idx.map((i) => referenceOf(run.tasks[i]));
  if (sum(weights) <= 0) { storeBuffer(run, amount); return; }
  const parts = splitProportional(amount, weights);
  idx.forEach((i, k) => addBudget(run.tasks[i], parts[k]));
}

// Brings the run up to nowMs: the current task's elapsed time is added to its consumed
// time, and any new overrun is taken from the buffer and the other tasks.
function commit(run, nowMs) {
  const i = currentIndex(run);
  if (i < 0) return run;
  const t = run.tasks[i];
  t.consumedMs += Math.max(0, nowMs - run.activatedAtMs);
  run.activatedAtMs = Math.max(run.activatedAtMs, nowMs);
  const due = overrunOf(t) - t.absorbedMs;
  if (due > 0) {
    take(run, due, [i]);
    t.absorbedMs += due;
  }
  return run;
}

function activate(run, nowMs, previousId) {
  const cur = currentTask(run);
  run.activatedAtMs = nowMs;
  if (cur && cur.id !== previousId) run.currentSinceMs = nowMs;
}

// After a deadline change: gives the extra time to the pending tasks, or takes what is
// now missing (buffer first).
function settleSlack(run, nowMs) {
  const pending = pendingIndexes(run).map((i) => run.tasks[i]);
  const slack = run.deadlineMs - nowMs - sum(pending.map(claimOf)) - run.bufferMs;
  if (slack > 0) give(run, slack);
  else if (slack < 0 && run.deadlineMs > nowMs) take(run, -slack);
  else if (slack < 0) {
    // Deadline already passed: nothing is reserved ahead of us anymore.
    run.bufferMs = 0;
    pending.forEach((t) => { if (taskType(t) !== 'fixed' && claimOf(t) > 0) t.budgetMs = t.consumedMs; });
  }
}

// --- Start ---------------------------------------------------------------------------

// plan: { name, templateId, deadlineMs, tasks: [{ name, minutes }] }
export function startRun(plan, nowMs) {
  const run = {
    version: 1,
    name: plan.name || 'Rotina',
    templateId: plan.templateId || null,
    deadlineMs: plan.deadlineMs,
    startedAtMs: nowMs,
    activatedAtMs: nowMs,
    currentSinceMs: nowMs,
    bufferMs: 0,
    nextId: 1,
    tasks: [],
  };
  run.tasks = normalizeTaskTypes(plan.tasks || []).map((t) => newTask(run, { ...t, estimateMs: Math.round(t.minutes * MIN_MS) }));
  const estimates = run.tasks.map((t) => t.estimateMs);
  const total = sum(estimates);
  const available = Math.max(0, plan.deadlineMs - nowMs);
  if (available >= total) {
    run.tasks.forEach((t) => { t.budgetMs = t.estimateMs; });
    storeBuffer(run, available - total);
  } else {
    // Reserve fixed durations, consume the buffer first, then squeeze flexible tasks.
    run.tasks.forEach((t) => { t.budgetMs = t.estimateMs; });
    take(run, total - available);
  }
  return run;
}

// --- Gestures --------------------------------------------------------------------------

// Swipe left on the current or on an upcoming task.
export function completeTask(run, id, nowMs) {
  const r = commit(clone(run), nowMs);
  const i = r.tasks.findIndex((t) => t.id === id);
  if (i < 0 || r.tasks[i].status !== 'pending') return run;
  const previous = currentTask(r)?.id;
  const t = r.tasks[i];
  const leftover = claimOf(t);
  t.status = 'done';
  t.doneLeftoverMs = leftover;
  // Freed fixed time first pays any shortfall caused by protected durations.
  const slack = r.deadlineMs - nowMs - sum(r.tasks.filter((task) => task.status === 'pending').map(claimOf)) - r.bufferMs;
  give(r, Math.min(leftover, Math.max(0, slack)));
  activate(r, nowMs, previous);
  return r;
}

// Swipe right on a pending task: it swaps places with the following pending task and keeps
// its remaining time. On the last pending task nothing changes (returns the same run).
export function postponeTask(run, id, nowMs) {
  const pending = pendingIndexes(run).filter((i) => taskType(run.tasks[i]) !== 'buffer');
  const k = pending.findIndex((i) => run.tasks[i].id === id);
  if (k < 0 || k === pending.length - 1) return run;
  const r = commit(clone(run), nowMs);
  const previous = currentTask(r).id;
  const a = pending[k];
  const b = pending[k + 1];
  [r.tasks[a], r.tasks[b]] = [r.tasks[b], r.tasks[a]];
  activate(r, nowMs, previous);
  return r;
}

// Swipe right on a done task: it becomes the current one again with the time it had left
// when it was completed; the previous current task becomes the next one.
export function reactivateTask(run, id, nowMs) {
  const r = commit(clone(run), nowMs);
  const i = r.tasks.findIndex((t) => t.id === id);
  if (i < 0 || r.tasks[i].status !== 'done') return run;
  const previous = currentTask(r)?.id;
  const [t] = r.tasks.splice(i, 1);
  const cur = currentIndex(r);
  const at = cur < 0 ? r.tasks.length : cur;
  r.tasks.splice(at, 0, t);
  t.status = 'pending';
  t.doneLeftoverMs = 0;
  // Its claim is still budget − consumed, i.e. what it had left when it was completed.
  const missing = take(r, claimOf(t), [at]);
  if (taskType(t) !== 'fixed') t.budgetMs -= Math.min(missing, claimOf(t));
  if (taskType(t) === 'buffer' && r.bufferMs > 0) {
    addBudget(t, r.bufferMs);
    r.bufferMs = 0;
  }
  activate(r, nowMs, previous);
  return r;
}

// Swipe left on the buffer card: the buffer goes to every pending task, the current included.
export function releaseBuffer(run, nowMs) {
  const explicit = run.tasks.find((t) => t.status === 'pending' && taskType(t) === 'buffer');
  if (explicit) return completeTask(run, explicit.id, nowMs);
  if (run.bufferMs <= 0) return run;
  const r = commit(clone(run), nowMs);
  const amount = r.bufferMs;
  r.bufferMs = 0;
  give(r, amount);
  return r;
}

// --- Adjustments -----------------------------------------------------------------------

// +5 min on the current task: it gets 5 more minutes from now (if it had overrun, 5 minutes
// from now), taken from the buffer first and then from the other pending tasks.
export function addTimeToCurrent(run, nowMs, ms = FIVE_MIN_MS) {
  const r = commit(clone(run), nowMs);
  const i = currentIndex(r);
  if (i < 0) return run;
  addBudget(r.tasks[i], ms);
  if (taskType(r.tasks[i]) === 'fixed') r.tasks[i].estimateMs = r.tasks[i].budgetMs;
  take(r, ms, [i]);
  return r;
}

export function setDeadline(run, deadlineMs, nowMs) {
  const r = commit(clone(run), nowMs);
  r.deadlineMs = deadlineMs;
  settleSlack(r, nowMs);
  return r;
}

export function extendDeadline(run, nowMs, ms = FIVE_MIN_MS) {
  return setDeadline(run, run.deadlineMs + ms, nowMs);
}

// Edit mode during a run (specifications.md §7.2).
// edit: { tasks: [{ id?, name, estimateMs }] — pending tasks in their new order (tasks
// without id, or with an unknown id, are new); deadlineMs?, name? }
export function applyEdit(run, edit, nowMs) {
  const r = commit(clone(run), nowMs);
  if (typeof edit.name === 'string') r.name = edit.name.trim() || 'Rotina';
  const previous = currentTask(r);
  const done = r.tasks.filter((t) => t.status === 'done');
  const oldPending = r.tasks.filter((t) => t.status === 'pending');
  const old = new Map(oldPending.map((t) => [t.id, { ...t }]));
  const total = Math.min(sum(oldPending.map(claimOf)) + r.bufferMs, Math.max(0, r.deadlineMs - nowMs));
  const used = new Set();
  const entries = normalizeTaskTypes(edit.tasks || [], done.some((t) => taskType(t) === 'buffer'));
  const nextPending = entries.map((e) => {
    const estimateMs = Math.max(MIN_MS, Math.round(e.estimateMs));
    const existing = oldPending.find((t) => t.id === e.id);
    if (existing && !used.has(e.id)) {
      used.add(e.id);
      existing.name = e.name;
      existing.estimateMs = estimateMs;
      delete existing.type;
      Object.assign(existing, typeProps(e));
      return existing;
    }
    return newTask(r, { ...e, estimateMs });
  });
  const nextCurrent = nextPending.find((t) => taskType(t) !== 'buffer');
  const keepCurrent = previous && nextCurrent?.id === previous.id;
  const unchanged = used.size === oldPending.length && nextPending.length === oldPending.length &&
    nextPending.every((t) => old.get(t.id)?.estimateMs === t.estimateMs && taskType(old.get(t.id)) === taskType(t));
  r.tasks = [...done, ...nextPending];

  if (!unchanged) {
    nextPending.forEach((t) => {
      const before = old.get(t.id);
      if (taskType(t) === 'fixed') {
        t.budgetMs = t.estimateMs;
      } else if (keepCurrent && t.id === previous.id && before) {
        const delta = t.estimateMs - before.estimateMs;
        if (delta > 0) addBudget(t, delta);
        else t.budgetMs -= Math.min(-delta, claimOf(t));
      } else if (taskType(t) === 'buffer' && before && taskType(before) === 'buffer') {
        t.budgetMs = t.consumedMs + Math.max(0, claimOf(before) + t.estimateMs - before.estimateMs);
      } else {
        t.budgetMs = referenceOf(t) > 0 ? t.estimateMs : (before?.budgetMs ?? t.consumedMs);
      }
      t.absorbedMs = overrunOf(t);
    });
    // An explicit buffer and automatically generated slack are the same reserve.
    const explicitBuffer = nextPending.find((t) => taskType(t) === 'buffer');
    if (explicitBuffer && r.bufferMs > 0) {
      addBudget(explicitBuffer, r.bufferMs);
      r.bufferMs = 0;
    }
    const slack = total - sum(nextPending.map(claimOf)) - r.bufferMs;
    const excluded = keepCurrent ? [r.tasks.findIndex((t) => t.id === previous.id)] : [];
    if (slack < 0) take(r, -slack, excluded);
    else if (slack > 0) give(r, slack, excluded);
  }
  activate(r, nowMs, previous?.id);
  if (edit.deadlineMs !== undefined && edit.deadlineMs !== r.deadlineMs) {
    r.deadlineMs = edit.deadlineMs;
    settleSlack(r, nowMs);
  }
  return r;
}

// --- Reading ---------------------------------------------------------------------------

// Everything the screens need at nowMs, without changing the stored run.
export function viewRun(run, nowMs) {
  const r = commit(clone(run), nowMs);
  // A buffer is a reserve, never the active task; display it at the end of the timeline.
  r.tasks = [...r.tasks.filter((t) => taskType(t) !== 'buffer'), ...r.tasks.filter((t) => taskType(t) === 'buffer')];
  const cur = currentIndex(r);
  const pending = r.tasks.filter((t) => t.status === 'pending');
  const untilDeadlineMs = r.deadlineMs - nowMs;
  const tasks = r.tasks.map((t, i) => {
    const isCurrent = i === cur;
    const done = t.status === 'done';
    const referenceMs = done ? 0 : referenceOf(t);
    const remainingMs = done ? t.doneLeftoverMs : isCurrent ? t.budgetMs - t.consumedMs : claimOf(t);
    return {
      id: t.id,
      name: t.name,
      ...typeProps(t),
      status: t.status,
      isCurrent,
      estimateMs: t.estimateMs,
      consumedMs: t.consumedMs,
      budgetMs: t.budgetMs,
      referenceMs,
      remainingMs,
      overrunMs: overrunOf(t),
      compressed: !done && claimOf(t) < referenceMs,
    };
  });
  return {
    name: r.name,
    deadlineMs: r.deadlineMs,
    startedAtMs: r.startedAtMs,
    currentSinceMs: r.currentSinceMs,
    untilDeadlineMs,
    late: untilDeadlineMs <= 0,
    bufferMs: r.bufferMs,
    current: cur < 0 ? null : tasks[cur],
    tasks,
    allDone: cur < 0,
    deficitMs: Math.max(0, sum(pending.filter((t) => taskType(t) !== 'buffer').map(referenceOf)) - Math.max(0, untilDeadlineMs)),
    protectedDeficitMs: pending.some((t) => taskType(t) === 'fixed')
      ? Math.max(0, sum(pending.map(claimOf)) + r.bufferMs - Math.max(0, untilDeadlineMs)) : 0,
    expired: nowMs >= r.deadlineMs + AUTO_CLOSE_MS,
  };
}

// Tasks of a run as a plan (for "restart with a new deadline" and "update the template").
export function runToPlanTasks(run) {
  return run.tasks.map((t) => ({ name: t.name, minutes: Math.max(1, Math.round(t.estimateMs / MIN_MS)), ...typeProps(t) }));
}

// --- Planning --------------------------------------------------------------------------

export function totalMinutes(tasks) {
  return sum((tasks || []).map((t) => (Number.isFinite(t.minutes) && t.minutes > 0 ? t.minutes : 0)));
}

// Before starting: ideal start and, if it has passed, how much will be compressed.
export function planSummary(tasks, deadlineMs, nowMs) {
  const totalMs = totalMinutes(tasks) * MIN_MS;
  const idealStartMs = deadlineMs - totalMs;
  const availableMs = Math.max(0, deadlineMs - nowMs);
  const fixedMs = totalMinutes(tasks.filter((t) => taskType(t) === 'fixed')) * MIN_MS;
  const flexibleMs = totalMinutes(tasks.filter((t) => taskType(t) === 'normal')) * MIN_MS;
  return {
    totalMs,
    idealStartMs,
    deadlineMs,
    early: nowMs < idealStartMs,
    untilStartMs: idealStartMs - nowMs,
    bufferIfStartNowMs: Math.max(0, availableMs - totalMs),
    missingMs: Math.max(0, fixedMs + flexibleMs - availableMs),
    protectedDeficitMs: Math.max(0, fixedMs - availableMs),
    factor: flexibleMs > 0 ? Math.min(1, Math.max(0, availableMs - fixedMs) / flexibleMs) : 1,
  };
}

// When everything would end if the tasks took exactly their estimates from now on
// (minus what each already consumed), rounded up to the whole minute a deadline can hold.
// tasks: [{ estimateMs, consumedMs? }]
export function finishFromNow(tasks, nowMs) {
  const needed = sum((tasks || []).map((t) => Math.max(0, (Number(t.estimateMs) || 0) - (t.consumedMs || 0))));
  return Math.ceil((nowMs + needed) / MIN_MS) * MIN_MS;
}
