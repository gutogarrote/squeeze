import React, { useEffect, useRef } from 'react';
import { makeId } from '../lib/storage';
import { LIMITS } from '../lib/routineLink';

const clampMinutes = (m) => Math.min(LIMITS.taskMinutes, Math.max(1, Math.round(m) || 1));

function IconButton({ label, onClick, disabled, children, className = '' }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled}
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-lg text-zinc-300 hover:bg-white/10 disabled:opacity-25 ${className}`}>
      {children}
    </button>
  );
}

// Editable list of tasks: [{ key, id?, name, minutes }]. Used by the planner and by the
// edit mode during a run.
export default function TaskListEditor({ items, onChange, newMinutes = 15 }) {
  const focusKey = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (!focusKey.current) return;
    const input = listRef.current?.querySelector(`[data-key="${focusKey.current}"]`);
    focusKey.current = null;
    input?.focus();
  });

  const update = (key, patch) => onChange(items.map((t) => (t.key === key ? { ...t, ...patch } : t)));
  const move = (index, by) => {
    const next = items.slice();
    const [t] = next.splice(index, 1);
    next.splice(index + by, 0, t);
    onChange(next);
  };
  const remove = (key) => onChange(items.filter((t) => t.key !== key));
  const add = () => {
    const key = makeId('k');
    focusKey.current = key;
    onChange([...items, { key, name: '', minutes: newMinutes }]);
  };

  return (
    <div>
      <ol ref={listRef} className="space-y-2">
        {items.map((t, i) => {
          const label = t.name.trim() || `tarefa ${i + 1}`;
          return (
            <li key={t.key} className="rounded-xl bg-zinc-900 px-2 pb-1 pt-1 ring-1 ring-white/5">
              <input
                data-key={t.key}
                aria-label={`Nome da tarefa ${i + 1}`}
                value={t.name}
                maxLength={LIMITS.nameLength}
                placeholder="Nome da tarefa"
                onChange={(e) => update(t.key, { name: e.target.value })}
                className="w-full rounded-lg bg-transparent px-2 py-2 text-base text-zinc-100 placeholder:text-zinc-600 focus:bg-white/5 focus:outline-none"
              />
              <div className="flex items-center gap-1">
                <IconButton label={`Subir ${label}`} disabled={i === 0} onClick={() => move(i, -1)} className="text-sm">▲</IconButton>
                <IconButton label={`Descer ${label}`} disabled={i === items.length - 1} onClick={() => move(i, 1)} className="text-sm">▼</IconButton>
                <span className="flex-1" />
                <IconButton label={`Menos 5 minutos em ${label}`} onClick={() => update(t.key, { minutes: clampMinutes(t.minutes - 5) })}>−</IconButton>
                <label className="flex items-baseline gap-1 tabular-nums">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={LIMITS.taskMinutes}
                    aria-label={`Minutos de ${label}`}
                    value={t.minutes}
                    onChange={(e) => update(t.key, { minutes: e.target.value === '' ? '' : Number(e.target.value) })}
                    onBlur={() => update(t.key, { minutes: clampMinutes(t.minutes) })}
                    className="w-14 rounded-lg bg-white/5 py-1.5 text-center text-base text-zinc-100 focus:outline-none focus:ring-1 focus:ring-lime-300/60"
                  />
                  <span className="text-xs text-zinc-500">min</span>
                </label>
                <IconButton label={`Mais 5 minutos em ${label}`} onClick={() => update(t.key, { minutes: clampMinutes((Number(t.minutes) || 0) + 5) })}>+</IconButton>
                <IconButton label={`Remover ${label}`} onClick={() => remove(t.key)} className="ml-1 text-zinc-500 hover:text-rose-300">×</IconButton>
              </div>
            </li>
          );
        })}
      </ol>
      <button type="button" onClick={add} disabled={items.length >= LIMITS.tasks}
        className="mt-3 w-full rounded-xl border border-dashed border-white/15 py-3 text-sm font-medium text-zinc-400 hover:border-lime-300/50 hover:text-lime-200 disabled:opacity-40">
        + Adicionar tarefa
      </button>
    </div>
  );
}

// Final, valid tasks from editor items.
export function cleanItems(items) {
  return items.map((t, i) => ({ ...t, name: t.name.trim() || `Tarefa ${i + 1}`, minutes: clampMinutes(Number(t.minutes)) }));
}
