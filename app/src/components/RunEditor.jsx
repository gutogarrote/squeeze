import React, { useState } from 'react';
import Sheet, { Button } from './Sheet';
import TaskListEditor, { cleanItems } from './TaskListEditor';
import DeadlineField from './DeadlineField';
import FinishPreview from './FinishPreview';
import { formatClock, nextOccurrence } from '../lib/clock';
import { LIMITS } from '../lib/routineLink';
import { finishFromNow } from '../lib/engine';

const MIN_MS = 60000;

// Edit mode during a run (specifications.md §7.2): pending tasks and the deadline.
export default function RunEditor({ view, now, onSave, onCancel }) {
  const initialClock = formatClock(view.deadlineMs);
  const [clock, setClock] = useState(initialClock);
  const [name, setName] = useState(view.name);
  const [items, setItems] = useState(() => view.tasks
    .filter((t) => t.status === 'pending')
    .map((t) => ({ key: t.id, id: t.id, name: t.name, minutes: Math.max(1, Math.round(t.estimateMs / MIN_MS)) })));

  // Time already spent on each pending task does not need to be done again.
  const consumed = Object.fromEntries(view.tasks.map((t) => [t.id, t.consumedMs]));
  const finishMs = finishFromNow(items.map((t) => ({ estimateMs: (Number(t.minutes) || 0) * MIN_MS, consumedMs: consumed[t.id] || 0 })), now);
  const deadlineMs = clock !== initialClock ? nextOccurrence(clock, now) : view.deadlineMs;

  function save() {
    const tasks = cleanItems(items).map((t) => ({ id: t.id, name: t.name, estimateMs: t.minutes * MIN_MS }));
    onSave({ name: name.trim() || 'Rotina', tasks, deadlineMs: clock !== initialClock ? nextOccurrence(clock, now) : undefined });
  }

  return (
    <Sheet title="Editar rotina" onClose={onCancel} wide
      footer={(
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={onCancel}>Cancelar</Button>
          <Button variant="primary" className="flex-1" onClick={save}>Salvar</Button>
        </div>
      )}>
      <label className="mb-4 block text-sm text-zinc-400">
        Nome da rotina
        <input value={name} maxLength={LIMITS.nameLength} onChange={(event) => setName(event.target.value)}
          className="mt-2 block w-full rounded-xl bg-zinc-900 px-4 py-3 text-base text-zinc-100 ring-1 ring-white/10 focus:outline-none focus:ring-lime-300/60" />
      </label>
      <p className="mb-3 text-sm text-zinc-500">
        Tarefas pendentes, na ordem. A primeira é a atual. Concluídas não aparecem aqui: reative-as na timeline.
      </p>
      <TaskListEditor items={items} onChange={setItems} />
      {items.length > 0 && (
        <FinishPreview label="Seguindo as estimativas a partir de agora, termina às" finishMs={finishMs}
          deadlineMs={deadlineMs} deadlineClock={clock} onUse={setClock} />
      )}
      <DeadlineField value={clock} onChange={setClock} />
    </Sheet>
  );
}
