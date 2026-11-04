import React from 'react';
import Sheet, { Button } from './Sheet';

// Ending a run (specifications.md §8): optionally updating the template, or restarting the
// same tasks with a new deadline.
export default function EndSheet({ hasTemplate, onEnd, onClose }) {
  return (
    <Sheet title="Encerrar rotina" onClose={onClose}>
      <p className="mb-4 text-zinc-400">
        Os ajustes desta execução não mudam a rotina salva, a não ser que você escolha atualizá-la.
      </p>
      <div className="flex flex-col gap-2">
        <Button variant="primary" onClick={() => onEnd({ save: false })}>Encerrar</Button>
        <Button variant="secondary" onClick={() => onEnd({ save: true })}>
          {hasTemplate ? 'Encerrar e atualizar a rotina salva' : 'Encerrar e salvar como rotina'}
        </Button>
        <Button variant="secondary" onClick={() => onEnd({ restart: true })}>Recomeçar com novo deadline</Button>
        <Button variant="ghost" onClick={onClose}>Continuar a rotina</Button>
      </div>
    </Sheet>
  );
}
