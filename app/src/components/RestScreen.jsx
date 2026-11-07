import React from 'react';
import { formatCountdown } from '../lib/clock';

// Rest screen (specifications.md §11): black, with only the current task in very dark gray,
// slowly changing position so it does not mark the screen. A tap returns to the app.
export default function RestScreen({ view, now, onWake }) {
  const step = Math.floor(now / 60000);
  const top = 15 + ((step * 37) % 60);
  const left = 6 + ((step * 23) % 24);
  const current = view.current;
  return (
    <button
      type="button"
      data-rest-screen
      aria-label="Modo descanso. Toque para voltar."
      onClick={onWake}
      className="fixed inset-0 z-50 h-full w-full cursor-default bg-black text-left"
    >
      <span className="absolute block text-zinc-800 transition-all duration-1000" style={{ top: `${top}%`, left: `${left}%`, maxWidth: `${94 - left}%` }}>
        <span className="block truncate text-lg">{current ? current.name : 'Tudo feito'}</span>
        {current && <span className="block text-5xl font-semibold tabular-nums">{formatCountdown(current.remainingMs)}</span>}
        {view.late && <span className="block text-sm">Tempo esgotado {formatCountdown(view.untilDeadlineMs)}</span>}
      </span>
    </button>
  );
}
