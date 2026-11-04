import React, { useEffect, useRef, useState } from 'react';
import { registerPwa } from '../pwa/registerPwa';

const reloadPage = () => window.location.reload();
function reloadSafely(reload, onError) {
  try { reload(); }
  catch (_) { onError('Não foi possível atualizar com segurança. Suas rotinas continuam salvas; tente novamente após reabrir o app.'); }
}

export default function PwaUpdateNotice({ editing, reload = reloadPage, inline = false }) {
  const [waiting, setWaiting] = useState(null);
  const [ready, setReady] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');
  const [dismissed, setDismissed] = useState(false);
  const editingRef = useRef(editing);
  editingRef.current = editing;
  const requested = useRef(false);

  useEffect(() => registerPwa({
    enabled: import.meta.env.PROD,
    onUpdate: worker => { setWaiting(worker); setError(''); setDismissed(false); },
    onActivated: () => {
      // Initial activation and updates accepted in another tab never reload us.
      if (!requested.current) return;
      requested.current = false;
      setApplying(false);
      setWaiting(null);
      if (editingRef.current) setReady(true);
      else reloadSafely(reload, setError);
    },
    onError: () => { setError('Não foi possível preparar esta versão para uso offline. Reconecte e recarregue quando terminar a edição.'); setDismissed(false); },
  }), [reload]);

  function applyUpdate() {
    if (editingRef.current || applying) return;
    if (ready) { reloadSafely(reload, setError); return; }
    if (!waiting) return;
    if (waiting.state === 'redundant' || waiting.state === 'activated') {
      // Another tab already activated this release; reload remains explicit.
      reloadSafely(reload, setError);
      return;
    }
    requested.current = true;
    setApplying(true);
    waiting.postMessage({ type: 'APPLY_UPDATE' });
  }

  if (dismissed || (!waiting && !ready && !error)) return null;
  // `inline`: placed in the page flow instead of floating at the top.
  const position = inline ? 'relative mx-3 mt-3 md:mx-auto' : 'fixed left-3 right-3 top-3 mx-auto';
  return (
    <aside role="status" className={`${position} z-50 max-w-xl rounded-xl bg-zinc-800 p-3 text-sm text-zinc-100 shadow-xl ring-1 ring-lime-300/30`}>
      <p>{error || 'Nova versão disponível. Atualizar recarrega o app; a rotina em andamento e as rotinas salvas continuam.'}</p>
      {!error && <>
        {editing && <p>Salve ou cancele a edição antes de atualizar.</p>}
        <button type="button" disabled={editing || applying} onClick={applyUpdate} className="mt-2 rounded-lg bg-lime-300 px-4 py-2 font-semibold text-zinc-950 disabled:opacity-50">
          {applying ? 'Atualizando…' : 'Atualizar agora'}
        </button>
      </>}
      <button type="button" disabled={applying} onClick={() => setDismissed(true)} className="ml-3 mt-2 rounded-lg px-3 py-2 underline disabled:opacity-50">Depois</button>
    </aside>
  );
}
