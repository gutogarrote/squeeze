// Order of the saved routines on the home screen. Pure; `manual` keeps the stored order.
import { totalMinutes } from './engine';

export const SORT_LABELS = { recent: 'Última usada', end: 'Horário final', start: 'Horário inicial', manual: 'Manual' };

const minutesOfDay = (clock) => {
  const [h, m] = clock.split(':').map(Number);
  return h * 60 + m;
};

// Ideal start of a routine as a time of day: deadline minus the total of its tasks.
export function startClock(template) {
  const minutes = ((minutesOfDay(template.deadline) - totalMinutes(template.tasks)) % 1440 + 1440) % 1440;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export function sortRoutines(templates, sort) {
  const indexed = templates.map((template, index) => ({ template, index }));
  const byIndex = (a, b) => a.index - b.index;
  const compare = {
    recent: (a, b) => (b.template.lastUsedAt || 0) - (a.template.lastUsedAt || 0) || byIndex(a, b),
    end: (a, b) => minutesOfDay(a.template.deadline) - minutesOfDay(b.template.deadline) || byIndex(a, b),
    start: (a, b) => minutesOfDay(startClock(a.template)) - minutesOfDay(startClock(b.template)) || byIndex(a, b),
  }[sort];
  return compare ? indexed.sort(compare).map((x) => x.template) : templates.slice();
}
