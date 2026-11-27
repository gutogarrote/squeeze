import React, { useState } from 'react';
import { Button } from '../components/Sheet';
import RoutineNameSheet from '../components/RoutineNameSheet';
import { formatMinutes } from '../lib/clock';
import { totalMinutes } from '../lib/engine';
import { ROUTINE_SORTS } from '../lib/storage';
import { SORT_LABELS, sortRoutines, startClock } from '../lib/routineSort';

// Home screen (specifications.md §13): pick a saved routine, start a new one or go back to
// the draft. The saved order can be shown by last use, end time, start time or by hand.
export default function RoutinesScreen({
  templates, currentId, draft, sort, onSort, onOpen, onDelete, onRename, onMove, onNew, onContinue, onSettings,
}) {
  const [confirming, setConfirming] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const sorted = sortRoutines(templates, sort);
  const draftOpen = draft?.tasks?.length > 0;

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col px-4 pb-safe-bar pt-safe">
      <header className="flex min-h-14 items-center gap-2">
        <span className="mr-auto text-base font-semibold tracking-[0.3em] text-zinc-400">SQUEEZE</span>
        <button type="button" onClick={onSettings} aria-label="Ajustes"
          className="grid h-12 w-12 place-items-center rounded-xl text-zinc-200 hover:bg-white/10">
          <GearIcon />
        </button>
      </header>

      <h1 className="mt-4 text-3xl font-semibold text-zinc-50">Rotinas</h1>

      {draftOpen && (
        <button type="button" onClick={onContinue}
          className="mt-5 flex items-center justify-between gap-3 rounded-2xl bg-lime-300/10 px-4 py-3 text-left ring-1 ring-lime-300/30 hover:bg-lime-300/15">
          <span className="min-w-0">
            <span className="block text-xs uppercase tracking-widest text-lime-300/80">Continuar editando</span>
            <span className="block truncate text-lg font-medium text-zinc-100">{draft.name.trim() || 'Rotina sem nome'}</span>
          </span>
          <span aria-hidden="true" className="text-2xl text-lime-200">›</span>
        </button>
      )}

      {templates.length > 1 && (
        <label className="mt-6 flex items-center justify-between gap-3 text-sm text-zinc-400">
          Ordenar por
          <select aria-label="Ordenar rotinas" value={sort} onChange={(e) => onSort(e.target.value)}
            className="rounded-lg bg-white/10 px-3 py-2 text-base text-zinc-100 [color-scheme:dark]">
            {ROUTINE_SORTS.map((s) => <option key={s} value={s}>{SORT_LABELS[s]}</option>)}
          </select>
        </label>
      )}

      {!templates.length && (
        <p className="mt-6 rounded-2xl bg-zinc-900 p-4 text-zinc-400 ring-1 ring-white/5">
          Nenhuma rotina salva ainda. Crie uma nova e use “Salvar rotina” no planejamento.
        </p>
      )}

      <ul className="mt-3 space-y-2" aria-label="Rotinas salvas">
        {sorted.map((t) => {
          const index = templates.findIndex((x) => x.id === t.id);
          return (
            <li key={t.id} className={`rounded-2xl p-3 ring-1 ${t.id === currentId ? 'bg-lime-300/10 ring-lime-300/30' : 'bg-zinc-900 ring-white/5'}`}>
              <div className="flex items-start gap-2">
                <button type="button" onClick={() => onOpen(t)} aria-label={`Abrir ${t.name}`} className="min-w-0 flex-1 rounded-xl px-1 py-1 text-left">
                  <span className="block truncate text-lg font-medium text-zinc-100">{t.name}</span>
                  <span className="block text-sm tabular-nums text-zinc-500">
                    {startClock(t)} → {t.deadline} · {t.tasks.length} {t.tasks.length === 1 ? 'tarefa' : 'tarefas'} · {formatMinutes(totalMinutes(t.tasks) * 60000)}
                  </span>
                </button>
                {sort === 'manual' && (
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" className="px-3" aria-label={`Subir rotina ${t.name}`}
                      disabled={index === 0} onClick={() => onMove(t.id, -1)}>↑</Button>
                    <Button variant="ghost" className="px-3" aria-label={`Descer rotina ${t.name}`}
                      disabled={index === templates.length - 1} onClick={() => onMove(t.id, 1)}>↓</Button>
                  </div>
                )}
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {confirming === t.id ? (
                  <>
                    <Button variant="danger" onClick={() => { onDelete(t.id); setConfirming(null); }}>Excluir</Button>
                    <Button variant="ghost" onClick={() => setConfirming(null)}>Não</Button>
                  </>
                ) : (
                  <>
                    <Button variant="secondary" onClick={() => onOpen(t)}>Abrir</Button>
                    <Button variant="ghost" aria-label={`Renomear ${t.name}`} onClick={() => setRenaming(t)}>Renomear</Button>
                    <Button variant="ghost" aria-label={`Excluir ${t.name}`} onClick={() => setConfirming(t.id)}>×</Button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-zinc-950 via-zinc-950/95 to-transparent px-4 pb-safe-bottom pt-8">
        <div className="mx-auto max-w-xl">
          <Button variant="primary" className="w-full py-4 text-lg" onClick={onNew}>Nova rotina</Button>
        </div>
      </div>

      {renaming && (
        <RoutineNameSheet initialName={renaming.name} mode="rename" onCancel={() => setRenaming(null)}
          onSave={(name) => { onRename(renaming.id, name); setRenaming(null); }} />
      )}
    </div>
  );
}

export function GearIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  );
}
