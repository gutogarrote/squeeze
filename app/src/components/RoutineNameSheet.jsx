import React, { useEffect, useId, useRef, useState } from 'react';
import Sheet, { Button } from './Sheet';
import { LIMITS } from '../lib/routineLink';

export default function RoutineNameSheet({ initialName, mode, onSave, onCancel }) {
  const [name, setName] = useState(initialName);
  const inputRef = useRef(null);
  const formId = useId();
  const copying = mode === 'copy';

  useEffect(() => {
    const previous = document.activeElement;
    inputRef.current?.focus();
    inputRef.current?.select();
    return () => previous?.focus?.();
  }, []);

  function submit(event) {
    event.preventDefault();
    if (name.trim()) onSave(name.trim());
  }

  return (
    <Sheet title={copying ? 'Salvar como' : 'Renomear rotina'} onClose={onCancel}
      footer={(
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={onCancel}>Cancelar</Button>
          <Button variant="primary" className="flex-1" type="submit" form={formId} disabled={!name.trim()}>
            {copying ? 'Salvar nova rotina' : 'Renomear'}
          </Button>
        </div>
      )}>
      <p className="mb-4 text-sm text-zinc-400">
        {copying ? 'Escolha um nome para a nova rotina. A original será preservada.' : 'Mude o nome desta rotina salva.'}
      </p>
      <form id={formId} onSubmit={submit}>
        <label className="block text-sm text-zinc-400">
          Nome da rotina
          <input ref={inputRef} value={name} maxLength={LIMITS.nameLength} required
            onChange={(event) => setName(event.target.value)}
            className="mt-2 block w-full rounded-xl bg-zinc-900 px-4 py-3 text-base text-zinc-100 ring-1 ring-white/10 focus:outline-none focus:ring-lime-300/60" />
        </label>
      </form>
    </Sheet>
  );
}
