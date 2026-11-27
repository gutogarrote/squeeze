import React from 'react';
import Sheet, { Button } from './Sheet';
import { formatClock, formatMinutes } from '../lib/clock';

// Ending a run (specifications.md §8), from the Encerrar button or by completing the last
// task: the same window either way; completing everything only adds the celebration.
// "Salvar alterações" appears only when the run changed a saved routine.
export default function EndSheet({ view, now, canSave, onEnd, onEdit, onClose }) {
  const tasks = view.tasks.filter((t) => t.type !== 'buffer');
  const done = tasks.filter((t) => t.status === 'done');
  const margin = view.deadlineMs - now;
  const spent = formatMinutes(Math.max(0, now - view.startedAtMs));
  return (
    <Sheet title="Encerrar rotina" onClose={onClose}>
      <div className={`mb-5 rounded-2xl p-4 text-center ring-1 ${view.allDone ? 'animate-pop-in bg-lime-300/10 ring-lime-300/30' : 'bg-zinc-900 ring-white/10'}`}>
        {view.allDone && (
          <>
            <p aria-hidden="true" className="text-4xl">🎉</p>
            <p className="mt-1 text-xl font-semibold text-lime-200">Tudo feito!</p>
          </>
        )}
        <p className="mt-1 text-sm text-zinc-300">
          {view.allDone
            ? `${done.length} ${done.length === 1 ? 'tarefa' : 'tarefas'} em ${spent}, às ${formatClock(now)}.`
            : `${done.length} de ${tasks.length} tarefas feitas em ${spent}.`}
        </p>
        <p className={`mt-1 text-sm font-medium ${margin >= 0 ? 'text-lime-300' : 'text-amber-300'}`}>
          {margin >= 0 ? `${formatMinutes(margin)} antes do deadline` : `${formatMinutes(-margin)} depois do deadline`}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Button variant="primary" onClick={() => onEnd({})}>Encerrar</Button>
        <Button variant="secondary" onClick={() => onEnd({ restart: true })}>Recomeçar com novo deadline</Button>
        <Button variant="secondary" onClick={onEdit}>Editar rotina</Button>
        {canSave && <Button variant="secondary" onClick={() => onEnd({ save: true })}>Salvar alterações na rotina</Button>}
      </div>
    </Sheet>
  );
}
