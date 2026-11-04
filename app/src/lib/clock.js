// Clock helpers: deadline interpretation and display formats.

export const MIN_MS = 60000;

export function isClock(value) {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

// A deadline is a time of day and means its next occurrence: if that time already passed
// today, it is tomorrow (specifications.md §3).
export function nextOccurrence(clock, nowMs) {
  if (!isClock(clock)) return NaN;
  const [h, m] = clock.split(':').map(Number);
  const d = new Date(nowMs);
  d.setHours(h, m, 0, 0);
  if (d.getTime() <= nowMs) d.setDate(d.getDate() + 1);
  return d.getTime();
}

const pad = (n) => String(n).padStart(2, '0');

export function formatClock(ms) {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Live counter: "12:05", "1:02:03", "-5:20". Remaining time rounds up (it reaches 0:00
// exactly at zero); delay rounds down.
export function formatCountdown(ms) {
  const negative = ms < 0;
  const total = negative ? Math.floor(-ms / 1000) : Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const body = h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  return negative && total > 0 ? `-${body}` : body;
}

// Durations in whole minutes: "45 min", "1h", "1h 05".
export function formatMinutes(ms) {
  const negative = ms < 0;
  const total = Math.round(Math.abs(ms) / MIN_MS);
  const h = Math.floor(total / 60);
  const m = total % 60;
  const body = h ? (m ? `${h}h ${pad(m)}` : `${h}h`) : `${m} min`;
  return negative && total > 0 ? `-${body}` : body;
}
