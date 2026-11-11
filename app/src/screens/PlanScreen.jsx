import React, { useState } from 'react';
import TaskListEditor from '../components/TaskListEditor';
import Sheet, { Button } from '../components/Sheet';
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

function RoutinesSheet({ templates, currentId, onOpen, onDelete, onRename, onMove, onNew, onClose }) {
  const [confirming, setConfirming] = useState(null);
  const [renaming, setRenaming] = useState(null);
  if (renaming) {
    return <RoutineNameSheet initialName={renaming.name} mode="rename" onCancel={() => setRenaming(null)}
      onSave={(name) => { onRename(renaming.id, name); setRenaming(null); }} />;
  }
  return (
    <Sheet title="Rotinas salvas" onClose={onClose}
      footer={<Button variant="secondary" className="w-full" onClick={onNew}>Nova rotina</Button>}>
      {!templates.length && <p className="py-4 text-zinc-400">Nenhuma rotina salva ainda. Use “Salvar” no planejamento.</p>}
      <ul className="space-y-2" aria-label="Rotinas salvas">
        {templates.map((t, index) => (
          <li key={t.id} className={`rounded-xl p-3 ring-1 ${t.id === currentId ? 'bg-lime-300/10 ring-lime-300/30' : 'bg-zinc-900 ring-white/5'}`}>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-zinc-100">{t.name}</p>
                <p className="text-sm text-zinc-500">{t.tasks.length} tarefas · {formatMinutes(totalMinutes(t.tasks) * 60000)} · até {t.deadline}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" className="px-3" aria-label={`Subir rotina ${t.name}`}
                  disabled={index === 0} onClick={() => onMove(t.id, -1)}>↑</Button>
                <Button variant="ghost" className="px-3" aria-label={`Descer rotina ${t.name}`}
                  disabled={index === templates.length - 1} onClick={() => onMove(t.id, 1)}>↓</Button>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {confirming === t.id ? (
                <>
                  <Button variant="danger" onClick={() => { onDelete(t.id); setConfirming(null); }}>Excluir</Button>
                  <Button variant="ghost" onClick={() => setConfirming(null)}>Não</Button>
                </>
              ) : (
                <>
                  <Button variant="secondary" aria-label={`Abrir ${t.name}`} onClick={() => onOpen(t)}>Abrir</Button>
                  <Button variant="ghost" aria-label={`Renomear ${t.name}`} onClick={() => setRenaming(t)}>Renomear</Button>
                  <Button variant="ghost" aria-label={`Excluir ${t.name}`} onClick={() => setConfirming(t.id)}>×</Button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

export default function PlanScreen({
  draft, onChange, now, templates, onStart, onSave, onSaveAsNew, onOpenTemplate, onDeleteTemplate, onRenameTemplate, onMoveTemplate, onNew, onShare, onSettings,
}) {
  const [routinesOpen, setRoutinesOpen] = useState(false);
  const [savingAs, setSavingAs] = useState(false);
  const items = draft.tasks.map((t) => ({ key: t.id, ...t }));
  const setItems = (next) => onChange({ ...draft, tasks: next.map((t) => ({ id: t.key, name: t.name, minutes: t.minutes, ...typeProps(t) })) });
  const saved = templates.some((t) => t.id === draft.templateId);

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col px-4 pb-32 pt-4">
      <header className="flex items-center gap-2">
        <span className="mr-auto text-sm font-semibold tracking-[0.3em] text-zinc-500">SQUEEZE</span>
        <Button variant="ghost" onClick={() => setRoutinesOpen(true)}>Rotinas</Button>
        <Button variant="ghost" onClick={onSettings} aria-label="Ajustes">⚙︎</Button>
      </header>

      <input
        aria-label="Nome da rotina"
        value={draft.name}
        maxLength={80}
        placeholder="Nome da rotina"
        onChange={(e) => onChange({ ...draft, name: e.target.value })}
        className="mt-6 w-full bg-transparent text-3xl font-semibold text-zinc-100 placeholder:text-zinc-700 focus:outline-none"
      />

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

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onSave} disabled={!draft.tasks.length}>{saved ? 'Salvar alterações' : 'Salvar rotina'}</Button>
        {saved && <Button variant="ghost" onClick={() => setSavingAs(true)} disabled={!draft.tasks.length}>Salvar como…</Button>}
        <Button variant="ghost" onClick={onShare} disabled={!draft.tasks.length}>Copiar link</Button>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-zinc-950 via-zinc-950/95 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-8">
        <div className="mx-auto max-w-xl">
          <Button variant="primary" className="w-full py-4 text-lg" disabled={!draft.tasks.length} onClick={onStart}>Começar</Button>
        </div>
      </div>

      {routinesOpen && (
        <RoutinesSheet
          templates={templates}
          currentId={draft.templateId}
          onClose={() => setRoutinesOpen(false)}
          onOpen={(t) => { onOpenTemplate(t); setRoutinesOpen(false); }}
          onDelete={onDeleteTemplate}
          onRename={onRenameTemplate}
          onMove={onMoveTemplate}
          onNew={() => { onNew(); setRoutinesOpen(false); }}
        />
      )}
      {savingAs && (
        <RoutineNameSheet initialName={draft.name} mode="copy" onCancel={() => setSavingAs(false)}
          onSave={(name) => { onSaveAsNew(name); setSavingAs(false); }} />
      )}
    </div>
  );
}
