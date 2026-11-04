import React, { useState } from 'react';
import Sheet, { Button } from './Sheet';
import TaskListEditor, { cleanItems } from './TaskListEditor';
import { formatClock, nextOccurrence } from '../lib/clock';

const MIN_MS = 60000;

// Edit mode during a run (specifications.md §7.2): pending tasks and the deadline.
export default function RunEditor({ view, now, onSave, onCancel }) {
  const initialClock = formatClock(view.deadlineMs);
  const [clock, setClock] = useState(initialClock);
  const [items, setItems] = useState(() => view.tasks
    .filter((t) => t.status === 'pending')
    .map((t) => ({ key: t.id, id: t.id, name: t.name, minutes: Math.max(1, Math.round(t.estimateMs / MIN_MS)) })));

  function save() {
    const tasks = cleanItems(items).map((t) => ({ id: t.id, name: t.name, estimateMs: t.minutes * MIN_MS }));
    onSave({ tasks, deadlineMs: clock !== initialClock ? nextOccurrence(clock, now) : undefined });
  }

  return (
    <Sheet title="Editar rotina" onClose={onCancel} wide
      footer={(
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={onCancel}>Cancelar</Button>
          <Button variant="primary" className="flex-1" onClick={save}>Salvar</Button>
        </div>
      )}>
      <label className="mb-4 flex items-center justify-between rounded-xl bg-zinc-900 px-4 py-3 ring-1 ring-white/5">
        <span className="text-sm text-zinc-400">Deadline</span>
        <input type="time" aria-label="Deadline" value={clock} onChange={(e) => e.target.value && setClock(e.target.value)}
          className="bg-transparent text-lg tabular-nums text-zinc-100 focus:outline-none [color-scheme:dark]" />
      </label>
      <p className="mb-3 text-sm text-zinc-500">
        Tarefas pendentes, na ordem. A primeira é a atual. Concluídas não aparecem aqui: reative-as na timeline.
      </p>
      <TaskListEditor items={items} onChange={setItems} />
    </Sheet>
  );
}
