// Time rail of the run screen (specifications.md §12): where each card sits in clock time.
// Cards are not proportional to their duration, so a linear ruler beside the list shows the
// real times and lines connect each card's edges to it. Pure logic; TimeRail draws.

const MIN_MS = 60000;
const STEPS_MIN = [1, 5, 10, 15, 30, 60, 120, 240];

// One span per list item, in list order: { id, startMs, endMs }. The current task spans from
// the time already spent to its projected end; completed tasks before it stack backwards by
// the time each took; the following ones are projected forwards; a task completed ahead of its
// turn takes no time there. `nowFraction` is where the present falls inside the current card.
export function railSpans(view, nowMs) {
  const tasks = view?.tasks || [];
  const index = tasks.findIndex((t) => t.isCurrent);
  const current = index < 0 ? null : tasks[index];
  const left = current ? Math.max(0, current.remainingMs) : 0;
  const spent = current ? Math.max(0, current.consumedMs) : 0;
  const spans = new Array(tasks.length);

  let back = nowMs - spent;
  let lastDone = index < 0 ? tasks.length - 1 : index - 1;
  // Without a current task everything done stacks back from now.
  if (index < 0) while (lastDone >= 0 && tasks[lastDone].status !== 'done') lastDone -= 1;
  for (let i = lastDone; i >= 0; i -= 1) {
    const took = tasks[i].status === 'done' ? Math.max(0, tasks[i].consumedMs) : 0;
    spans[i] = { id: tasks[i].id, startMs: back - took, endMs: back };
    back -= took;
  }
  let cursor = nowMs + left;
  if (current) spans[index] = { id: current.id, startMs: nowMs - spent, endMs: cursor };
  for (let i = lastDone + 1; i < tasks.length; i += 1) {
    if (i === index) continue;
    const length = tasks[i].status === 'pending' ? Math.max(0, tasks[i].remainingMs) : 0;
    spans[i] = { id: tasks[i].id, startMs: cursor, endMs: cursor + length };
    cursor += length;
  }
  if (view?.bufferMs > 0) spans.push({ id: 'buffer', startMs: cursor, endMs: cursor + view.bufferMs });
  return {
    spans,
    currentId: current ? current.id : null,
    nowFraction: current ? (spent + left > 0 ? spent / (spent + left) : 1) : null,
  };
}

export function railRange(spans) {
  if (!spans.length) return null;
  const startMs = Math.min(...spans.map((s) => s.startMs));
  const endMs = Math.max(...spans.map((s) => s.endMs));
  return endMs > startMs ? { startMs, endMs } : null;
}

// Linear position of a time on a ruler of `height` px, with `pad` px free at both ends.
export function railY(ms, range, height, pad = 0) {
  const usable = Math.max(0, height - 2 * pad);
  return pad + ((ms - range.startMs) / (range.endMs - range.startMs)) * usable;
}

// Tick times at round clock values (local time), at least `minGapPx` apart on the ruler.
export function railTicks(range, height, { minGapPx = 9, offsetMin = new Date(range.startMs).getTimezoneOffset(), limit = 240 } = {}) {
  const msPerPx = (range.endMs - range.startMs) / Math.max(1, height);
  const stepMin = STEPS_MIN.find((m) => (m * MIN_MS) / msPerPx >= minGapPx) || STEPS_MIN[STEPS_MIN.length - 1];
  const step = stepMin * MIN_MS;
  const shift = offsetMin * MIN_MS;
  const ticks = [];
  for (let t = Math.ceil((range.startMs - shift) / step) * step + shift; t <= range.endMs && ticks.length < limit; t += step) ticks.push(t);
  return ticks;
}

// Keeps the labels that fit: earlier entries win, so pass the most important first.
// points: [{ y, ... }]; returns the kept ones, in the given order.
export function placeLabels(points, minGapPx = 12) {
  const kept = [];
  points.forEach((point) => {
    if (kept.every((other) => Math.abs(other.y - point.y) >= minGapPx)) kept.push(point);
  });
  return kept;
}
