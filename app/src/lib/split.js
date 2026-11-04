// Integer splitting helpers (milliseconds). Inherited from Ver o Tempo's schedule.js.

const sum = (xs) => xs.reduce((s, x) => s + x, 0);

// Split totalMs into integer parts proportional to weights, summing exactly to totalMs
// (largest-remainder rounding). If every weight is zero/invalid nothing is allocated.
export function splitProportional(totalMs, weights) {
  const w = (weights || []).map((x) => (Number.isFinite(x) && x > 0 ? x : 0));
  const W = sum(w);
  const total = Number.isFinite(totalMs) ? Math.max(0, Math.round(totalMs)) : 0;
  if (!w.length || W <= 0) return w.map(() => 0);
  const exact = w.map((x) => (total * x) / W);
  const out = exact.map(Math.floor);
  let rest = total - sum(out);
  const order = exact
    .map((x, i) => [x - out[i], i])
    .filter(([, i]) => w[i] > 0)
    .sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; rest > 0 && order.length; k++, rest--) out[order[k % order.length][1]]++;
  // Guard against floating-point overshoot.
  for (let k = 0; rest < 0 && order.length; k++) {
    const i = order[order.length - 1 - (k % order.length)][1];
    if (out[i] > 0) { out[i]--; rest++; }
  }
  return out;
}

// Like splitProportional, but part i never exceeds caps[i] (water-filling: parts that hit
// their cap are frozen and the rest is shared again among the others). Returns integer
// parts summing to min(totalMs, what the caps allow among positive weights).
export function splitCapped(totalMs, weights, caps) {
  const out = weights.map(() => 0);
  let rest = Math.max(0, Math.round(totalMs) || 0);
  let active = weights.map((_, k) => k).filter((k) => weights[k] > 0 && caps[k] > 0);
  while (rest > 0 && active.length) {
    const parts = splitProportional(rest, active.map((k) => weights[k]));
    let given = 0;
    active.forEach((k, j) => {
      const g = Math.min(parts[j], caps[k] - out[k]);
      out[k] += g;
      given += g;
    });
    rest -= given;
    if (!given) break;
    active = active.filter((k) => out[k] < caps[k]);
  }
  return out;
}
