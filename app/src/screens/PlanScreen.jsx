import React, { useEffect, useRef, useState } from 'react';
import TaskListEditor from '../components/TaskListEditor';
import { Button } from '../components/Sheet';
import { GearIcon } from './RoutinesScreen';
import DeadlineField from '../components/DeadlineField';
import FinishPreview from '../components/FinishPreview';
import RoutineNameSheet from '../components/RoutineNameSheet';
import { formatClock, formatMinutes, nextOccurrence } from '../lib/clock';
import { finishFromNow, planSummary, totalMinutes } from '../lib/engine';
import { typeProps } from '../lib/taskTypes';

function Hero({ draft, now }) {
  const deadlineMs = nextOccurrence(draft.deadline, now);
  if (!draft.tasks.length || !Number.isFinite(deadlineMs)) {
    return <p className="text-zinc-400">Adicione tarefas para saber a que horas começar.</p>;
  }
  const s = planSummary(draft.tasks, deadlineMs, now);
  return (
    <div aria-live="polite">
      <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">{s.early ? 'Comece às' : 'Deveria ter começado às'}</p>
      <p className={`mt-1 text-7xl font-semibold tabular-nums tracking-tight ${s.early ? 'text-lime-300' : 'text-amber-300'}`} data-testid="ideal-start">
        {formatClock(s.idealStartMs)}
      </p>
      {s.early ? (
        <p className="mt-2 text-zinc-300">
          Faltam {formatMinutes(s.untilStartMs)} para o início ideal. Se começar agora, sobra <strong className="text-lime-200">+{formatMinutes(s.bufferIfStartNowMs)} de folga</strong>.
        </p>
      ) : (
        <p className="mt-2 text-amber-100">
          Atrasado {formatMinutes(-s.untilStartMs)}. {s.protectedDeficitMs > 0 ? 'O tempo disponível não comporta as tarefas fixas.' : s.missingMs > 0
            ? <>Faltam <strong>{formatMinutes(s.missingMs)}</strong>: começando agora, as tarefas {draft.tasks.some((t) => t.type) ? 'flexíveis ' : ''}ficam com {Math.floor(s.factor * 100)}% da estimativa.</>
            : 'A folga absorve o atraso, sem reduzir as outras tarefas.'}
          {s.protectedDeficitMs > 0 && <span className="mt-2 block font-medium text-rose-300">As tarefas fixas ultrapassam o deadline em {formatMinutes(s.protectedDeficitMs)}. A duração delas será preservada.</span>}
        </p>
      )}
    </div>
  );
}

// Sounds on or off, decided in plain sight before starting (specifications.md §10).
function SoundToggle({ on, onChange }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label="Sons dos alertas" onClick={() => onChange(!on)}
      className={`flex shrink-0 items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold ring-1 transition active:scale-[.97] ${
        on ? 'bg-zinc-900 text-lime-200 ring-lime-300/30' : 'bg-zinc-900 text-zinc-400 ring-white/10'}`}>
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7 2.5 7h-17S6 15 6 9Z" />
        <path d="M10 19.5a2 2 0 0 0 4 0" />
        {!on && <path d="M4 4l16 16" />}
      </svg>
      <span className="leading-tight">
        <span className="block text-xs font-medium text-zinc-500">Sons</span>
        <span className="block">{on ? 'Ligados' : 'Desligados'}</span>
      </span>
    </button>
  );
}

export default function PlanScreen({
  draft, onChange, now, templates, onStart, onSave, onSaveAsNew, onRoutines, onShare, onSettings, sound, onToggleSound, focusDeadline = false,
}) {
  const [savingAs, setSavingAs] = useState(false);
  const deadlineRef = useRef(null);
  // "Recomeçar com novo deadline" lands here: show the deadline and its suggestion.
  useEffect(() => {
    if (focusDeadline) deadlineRef.current?.scrollIntoView?.({ block: 'end', behavior: 'smooth' });
  }, [focusDeadline]);
  const items = draft.tasks.map((t) => ({ key: t.id, ...t }));
  const setItems = (next) => onChange({ ...draft, tasks: next.map((t) => ({ id: t.key, name: t.name, minutes: t.minutes, ...typeProps(t) })) });
  const saved = templates.some((t) => t.id === draft.templateId);

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col px-4 pb-safe-bar pt-safe">
      <header className="flex min-h-14 items-center gap-2">
        <span className="mr-auto text-base font-semibold tracking-[0.3em] text-zinc-400">SQUEEZE</span>
        <button type="button" onClick={onRoutines}
          className="flex h-12 items-center gap-2 rounded-xl px-4 text-base font-semibold text-zinc-100 ring-1 ring-white/10 hover:bg-white/10">
          <span aria-hidden="true" className="text-lg leading-none">‹</span> Rotinas
        </button>
        <button type="button" onClick={onSettings} aria-label="Ajustes"
          className="grid h-12 w-12 place-items-center rounded-xl text-zinc-200 hover:bg-white/10">
          <GearIcon />
        </button>
      </header>

      <label className="mt-4 flex items-center gap-3 rounded-2xl bg-zinc-900 px-4 py-3 ring-1 ring-white/15 transition focus-within:ring-2 focus-within:ring-lime-300/70 hover:ring-white/25">
        <input
          aria-label="Nome da rotina"
          value={draft.name}
          maxLength={80}
          placeholder="Nome da rotina"
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
          className="min-w-0 flex-1 bg-transparent text-2xl font-semibold text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
        />
        {/* Pencil: the title is a field, tap to rename. */}
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-zinc-500" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
          <path d="M13.5 6.5l4 4" />
        </svg>
      </label>

      <section className="mt-5 rounded-3xl bg-zinc-900/80 p-5 ring-1 ring-white/5">
        <Hero draft={draft} now={now} />
        <div className="mt-5 border-t border-white/5 pt-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-zinc-500">Total</p>
            <p className="text-xl font-medium tabular-nums text-zinc-100">{formatMinutes(totalMinutes(draft.tasks) * 60000)}</p>
          </div>
        </div>
      </section>

      <h2 className="mb-2 mt-7 text-sm font-medium uppercase tracking-widest text-zinc-500">Tarefas</h2>
      <TaskListEditor items={items} onChange={setItems} />
      <div ref={deadlineRef} className="scroll-mb-40">
      {draft.tasks.length > 0 && (
        <FinishPreview
          label="Começando agora, termina às"
          finishMs={finishFromNow(draft.tasks.map((t) => ({ estimateMs: (Number(t.minutes) || 0) * 60000 })), now)}
          deadlineMs={nextOccurrence(draft.deadline, now)}
          deadlineClock={draft.deadline}
          onUse={(deadline) => onChange({ ...draft, deadline })}
        />
      )}
      <DeadlineField value={draft.deadline} onChange={(deadline) => onChange({ ...draft, deadline })} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onSave} disabled={!draft.tasks.length}>{saved ? 'Salvar alterações' : 'Salvar rotina'}</Button>
        {saved && <Button variant="ghost" onClick={() => setSavingAs(true)} disabled={!draft.tasks.length}>Salvar como…</Button>}
        <Button variant="ghost" onClick={onShare} disabled={!draft.tasks.length}>Copiar link</Button>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-zinc-950 via-zinc-950/95 to-transparent px-4 pb-safe-bottom pt-8">
        <div className="mx-auto max-w-xl">
          <div className="flex items-stretch gap-2">
            <SoundToggle on={sound} onChange={onToggleSound} />
            <Button variant="primary" className="min-w-0 flex-1 py-4 text-lg" disabled={!draft.tasks.length} onClick={onStart}>Começar</Button>
          </div>
        </div>
      </div>

      {savingAs && (
        <RoutineNameSheet initialName={draft.name} mode="copy" onCancel={() => setSavingAs(false)}
          onSave={(name) => { onSaveAsNew(name); setSavingAs(false); }} />
      )}
    </div>
  );
}
