import React from 'react';

export default function DeadlineField({ value, onChange }) {
  return (
    <label className="mt-4 flex items-center justify-between gap-4 rounded-2xl bg-zinc-900 px-4 py-4 ring-1 ring-white/10">
      <span className="text-sm font-medium uppercase tracking-widest text-zinc-400">Deadline</span>
      <input type="time" aria-label="Deadline" value={value} required
        onChange={(event) => event.target.value && onChange(event.target.value)}
        className="min-w-0 rounded-lg bg-transparent text-xl font-medium tabular-nums text-zinc-100 focus:outline-none focus:ring-1 focus:ring-lime-300/60 [color-scheme:dark]" />
    </label>
  );
}
