import React from 'react';
import { formatClock, formatCountdown } from '../lib/clock';

// Fixed card at the top of the run screen: start, now and deadline, with a colored line for
// the time left. The line starts full and shrinks toward the right as time passes; the time
// left rides along the current point.
export default function TimelineCard({ startMs, deadlineMs, now, late, squeezed }) {
  const span = deadlineMs - startMs;
  const progress = span > 0 ? Math.min(1, Math.max(0, (now - startMs) / span)) : 1;
  const pct = progress * 100;
  const tone = late ? 'bg-rose-500' : squeezed ? 'bg-amber-300' : 'bg-lime-300';
  const text = late ? 'text-rose-300' : squeezed ? 'text-amber-200' : 'text-lime-200';
  const left = deadlineMs - now;

  return (
    <section aria-label="Linha do tempo da rotina"
      className={`rounded-2xl px-4 pb-3 pt-3 ring-1 ${late ? 'bg-rose-950/80 ring-rose-500/60' : 'bg-zinc-900 ring-white/10'}`}>
      <div className="grid grid-cols-3 items-baseline text-sm tabular-nums">
        <span className="text-zinc-500" aria-label={`Início ${formatClock(startMs)}`}>{formatClock(startMs)}</span>
        <span className="text-center text-base font-semibold text-zinc-50" aria-label={`Agora ${formatClock(now)}`}>{formatClock(now)}</span>
        <span className={`text-right ${late ? 'font-semibold text-rose-300' : 'text-zinc-300'}`} aria-label={`Deadline ${formatClock(deadlineMs)}`}>
          {formatClock(deadlineMs)}
        </span>
      </div>
      <div className="relative mt-2 h-2 rounded-full bg-white/10" role="progressbar" aria-label="Tempo restante"
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(100 - pct)}>
        <div className={`absolute inset-y-0 right-0 rounded-full ${tone} transition-[left] duration-1000 ease-linear`} style={{ left: `${pct}%` }} />
        <div className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-50 ring-2 ring-zinc-950 transition-[left] duration-1000 ease-linear"
          style={{ left: `${pct}%` }} />
      </div>
      <div className="relative mt-1 h-4">
        {/* The label follows the current point but never leaves the card. */}
        <span data-testid="time-left" className={`absolute whitespace-nowrap text-xs font-medium tabular-nums ${text} transition-[left] duration-1000 ease-linear`}
          style={{ left: `${pct}%`, transform: `translateX(-${pct}%)` }}>
          {late ? `${formatCountdown(left)} atrasado` : `${formatCountdown(left)} restantes`}
        </span>
      </div>
    </section>
  );
}
