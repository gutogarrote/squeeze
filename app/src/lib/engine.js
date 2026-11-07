// Squeeze time engine (specifications.md §2 and §6). Pure functions: every operation takes
// the run and `nowMs`, and returns a new run. Times are integer milliseconds.
//
// A run is { version, name, templateId, deadlineMs, startedAtMs, activatedAtMs,
// currentSinceMs, bufferMs, nextId, tasks }, and each task is
// { id, name, status: 'pending'|'done', estimateMs, consumedMs, budgetMs, absorbedMs,
//   doneLeftoverMs }.
//
// The current task is always the first pending task in array order. Its consumedMs is
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
// Invariant while the deadline has not passed:
//   now + Σ claims of pending tasks + buffer = deadline.

import { splitCapped, splitProportional } from './split';

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
  return run.tasks.findIndex((t) => t.status === 'pending');
}

export function currentTask(run) {
  const i = currentIndex(run);
  return i < 0 ? null : run.tasks[i];
}

function newTask(run, { name, estimateMs }) {
  const id = 't' + run.nextId;
  run.nextId += 1;
  return { id, name, status: 'pending', estimateMs, consumedMs: 0, budgetMs: 0, absorbedMs: 0, doneLeftoverMs: 0 };
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
  if (!rest) return 0;
  const idx = pendingIndexes(run).filter((i) => !exclude.includes(i));
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
  const idx = pendingIndexes(run).filter((i) => !exclude.includes(i));
  const weights = idx.map((i) => referenceOf(run.tasks[i]));
  if (sum(weights) <= 0) { run.bufferMs += amount; return; }
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
    pending.forEach((t) => { if (claimOf(t) > 0) t.budgetMs = t.consumedMs; });
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
  run.tasks = (plan.tasks || []).map((t) => newTask(run, { name: t.name, estimateMs: Math.round(t.minutes * MIN_MS) }));
  const estimates = run.tasks.map((t) => t.estimateMs);
  const total = sum(estimates);
  const available = Math.max(0, plan.deadlineMs - nowMs);
  if (available >= total) {
    run.tasks.forEach((t) => { t.budgetMs = t.estimateMs; });
    run.bufferMs = available - total;
  } else {
    // Late start: every task, the first included, is compressed by the same factor.
    const budgets = splitProportional(available, estimates);
    run.tasks.forEach((t, i) => { t.budgetMs = budgets[i]; });
  }
  return run;
}

// --- Gestures --------------------------------------------------------------------------

// Swipe left on the current or on an upcoming task.
export function completeTask(run, id, nowMs) {
  const r = commit(clone(run), nowMs);
  const i = r.tasks.findIndex((t) => t.id === id);
  if (i < 0 || r.tasks[i].status !== 'pending') return run;
  const previous = currentTask(r).id;
  const t = r.tasks[i];
  const leftover = claimOf(t);
  t.status = 'done';
  t.doneLeftoverMs = leftover;
  give(r, leftover);
  activate(r, nowMs, previous);
  return r;
}

// Swipe right on a pending task: it swaps places with the following pending task and keeps
// its remaining time. On the last pending task nothing changes (returns the same run).
export function postponeTask(run, id, nowMs) {
  const pending = pendingIndexes(run);
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
  t.budgetMs -= Math.min(missing, claimOf(t));
  activate(r, nowMs, previous);
  return r;
}

// Swipe left on the buffer card: the buffer goes to every pending task, the current included.
export function releaseBuffer(run, nowMs) {
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
  const byId = new Map(oldPending.map((t) => [t.id, t]));
  const oldEstimate = new Map(oldPending.map((t) => [t.id, t.estimateMs]));
  const used = new Set();
  const nextPending = (edit.tasks || []).map((e) => {
    const estimateMs = Math.max(MIN_MS, Math.round(e.estimateMs));
    const existing = e.id && byId.get(e.id);
    if (existing && !used.has(e.id)) {
      used.add(e.id);
      existing.name = e.name;
      existing.estimateMs = estimateMs;
      return existing;
    }
    return newTask(r, { name: e.name, estimateMs });
  });
  const removed = oldPending.filter((t) => !used.has(t.id));
  const keepCurrent = previous && nextPending[0] && nextPending[0].id === previous.id;
  const sameSet = !removed.length && nextPending.every((t) => oldEstimate.has(t.id));
  const sameEstimates = sameSet && nextPending.every((t) => oldEstimate.get(t.id) === t.estimateMs);

  r.tasks = [...done, ...nextPending];

  // Only reordering (same tasks, same estimates) moves no time, like a postponement.
  if (!sameEstimates) {
    const poolMembers = keepCurrent ? nextPending.slice(1) : nextPending;
    const oldPoolMembers = oldPending.filter((t) => !(keepCurrent && t.id === previous.id));
    let pool = sum(oldPoolMembers.map(claimOf));
    const oldNeed = sum(oldPoolMembers.map((t) => Math.max(0, oldEstimate.get(t.id) - t.consumedMs)));

    if (keepCurrent) {
      const cur = nextPending[0];
      const delta = cur.estimateMs - oldEstimate.get(cur.id);
      if (delta > 0) {
        addBudget(cur, delta);
        const fromBuffer = Math.min(r.bufferMs, delta);
        r.bufferMs -= fromBuffer;
        pool -= Math.min(pool, delta - fromBuffer);
      } else if (delta < 0) {
        // Never below what was already consumed: reducing the estimate does not erase time.
        const freed = Math.min(-delta, claimOf(cur));
        cur.budgetMs -= freed;
        pool += freed;
      }
    }

    const need = sum(poolMembers.map(referenceOf));
    const extraNeed = need - oldNeed;
    if (extraNeed > 0) {
      // The buffer always covers an increase first.
      const fromBuffer = Math.min(r.bufferMs, extraNeed);
      r.bufferMs -= fromBuffer;
      pool += fromBuffer;
    }
    const weights = poolMembers.map(referenceOf);
    if (sum(weights) <= 0) r.bufferMs += pool;
    else {
      const parts = splitProportional(pool, weights);
      poolMembers.forEach((t, k) => {
        if (parts[k] > 0) { t.budgetMs = t.consumedMs + parts[k]; t.absorbedMs = 0; }
        else if (claimOf(t) > 0) t.budgetMs = t.consumedMs;
      });
    }
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
    deficitMs: Math.max(0, sum(pending.map(referenceOf)) - Math.max(0, untilDeadlineMs)),
    expired: nowMs >= r.deadlineMs + AUTO_CLOSE_MS,
  };
}

// Tasks of a run as a plan (for "restart with a new deadline" and "update the template").
export function runToPlanTasks(run) {
  return run.tasks.map((t) => ({ name: t.name, minutes: Math.max(1, Math.round(t.estimateMs / MIN_MS)) }));
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
  return {
    totalMs,
    idealStartMs,
    deadlineMs,
    early: nowMs < idealStartMs,
    untilStartMs: idealStartMs - nowMs,
    bufferIfStartNowMs: Math.max(0, availableMs - totalMs),
    missingMs: Math.max(0, totalMs - availableMs),
    factor: totalMs > 0 ? Math.min(1, availableMs / totalMs) : 1,
  };
}
