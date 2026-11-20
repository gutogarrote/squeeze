import React from 'react';
import Sheet, { Button } from './Sheet';
import { formatClock, formatMinutes } from '../lib/clock';

// The last task was completed (specifications.md §8): the routine is over. Closing the sheet
// keeps the finished timeline on screen, where a task can still be reactivated.
export default function FinishedSheet({ view, now, hasTemplate, onEnd, onEdit, onClose }) {
  const done = view.tasks.filter((t) => t.status === 'done' && t.type !== 'buffer');
  const margin = view.deadlineMs - now;
  return (
    <Sheet title="Rotina concluída" onClose={onClose}>
      <div className="mb-5 animate-pop-in rounded-2xl bg-lime-300/10 p-4 text-center ring-1 ring-lime-300/30">
        <p aria-hidden="true" className="text-4xl">🎉</p>
        <p className="mt-1 text-xl font-semibold text-lime-200">Tudo feito!</p>
        <p className="mt-1 text-sm text-zinc-300">
          {done.length} {done.length === 1 ? 'tarefa' : 'tarefas'} em {formatMinutes(Math.max(0, now - view.startedAtMs))}, às {formatClock(now)}.
        </p>
        <p className={`mt-1 text-sm font-medium ${margin >= 0 ? 'text-lime-300' : 'text-amber-300'}`}>
          {margin >= 0 ? `${formatMinutes(margin)} antes do deadline` : `${formatMinutes(-margin)} depois do deadline`}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Button variant="primary" onClick={() => onEnd({ save: true })}>
          {hasTemplate ? 'Salvar alterações na rotina' : 'Salvar como rotina'}
        </Button>
        <Button variant="secondary" onClick={() => onEnd({ restart: true })}>Recomeçar com novo deadline</Button>
        <Button variant="secondary" onClick={onEdit}>Editar a rotina</Button>
        <Button variant="ghost" onClick={() => onEnd({ save: false })}>Encerrar sem salvar</Button>
      </div>
    </Sheet>
  );
}
