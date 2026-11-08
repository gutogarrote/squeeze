import React from 'react';
import { Button } from './Sheet';
import { formatClock, formatMinutes } from '../lib/clock';

// "If I start now, when do I finish?" next to the deadline field, with a button that makes
// that time the deadline. Past midnight it shows only the time (the deadline is the next
// occurrence of a time of day anyway).
export default function FinishPreview({ finishMs, deadlineMs, deadlineClock, label, onUse }) {
  const clock = formatClock(finishMs);
  const diff = Number.isFinite(deadlineMs) ? deadlineMs - finishMs : NaN;
  let status = '';
  if (diff === 0) status = 'exatamente no deadline';
  else if (diff > 0) status = `sobra ${formatMinutes(diff)} antes do deadline`;
  else if (diff < 0) status = `passa ${formatMinutes(-diff)} do deadline`;
  return (
    <section aria-label="Término começando agora" aria-live="polite"
      className="mt-4 rounded-2xl bg-zinc-900/60 px-4 py-3 ring-1 ring-white/5">
      <p className="text-sm text-zinc-400">
        {label} <strong className="text-lg tabular-nums text-zinc-100" data-testid="finish-time">{clock}</strong>
      </p>
      {status && <p className={`text-sm ${diff >= 0 ? 'text-lime-300' : 'text-amber-300'}`}>{status}</p>}
      {clock !== deadlineClock && (
        <Button variant="secondary" className="mt-2 w-full" onClick={() => onUse(clock)}>Usar {clock} como deadline</Button>
      )}
    </section>
  );
}
