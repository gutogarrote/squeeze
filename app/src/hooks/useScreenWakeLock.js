import { useEffect, useRef, useState } from 'react';

export const WAKE_LOCK_KEY = 'squeeze:keep-screen-on';
const readPreference = () => {
  try { return localStorage.getItem(WAKE_LOCK_KEY) === 'true'; } catch (_) { return false; }
};
const release = async (lock) => {
  try { await lock.release(); } catch (_) { /* The browser may already have released it. */ }
};

export default function useScreenWakeLock(eligible, completed) {
  const [enabled, setEnabled] = useState(readPreference);
  const [storageFailed, setStorageFailed] = useState(false);
  const [visible, setVisible] = useState(() => document.visibilityState !== 'hidden');
  const [restore, setRestore] = useState(0);
  const [status, setStatus] = useState('idle');
  // Serialize requests and releases, including across effect cleanup / StrictMode replay.
  const pending = useRef(Promise.resolve());
  const stop = useRef(null);

  useEffect(() => {
    const hide = () => { stop.current?.(); setVisible(false); };
    const visibility = () => {
      if (document.visibilityState === 'hidden') hide();
      else { setVisible(true); setRestore((n) => n + 1); }
    };
    const show = () => { visibility(); setRestore((n) => n + 1); };
    const storage = (e) => {
      if (e.key === WAKE_LOCK_KEY || e.key === null) {
        const preference = readPreference();
        if (!preference) stop.current?.();
        setEnabled(preference);
        setStorageFailed(false);
      }
    };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', hide);
    window.addEventListener('pageshow', show);
    window.addEventListener('storage', storage);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', hide);
      window.removeEventListener('pageshow', show);
      window.removeEventListener('storage', storage);
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    let held = null;
    const onRelease = () => {
      held?.removeEventListener('release', onRelease);
      held = null;
      if (!disposed) setStatus('suspended');
    };
    const wanted = enabled && eligible && visible;
    if (wanted && window.isSecureContext && navigator.wakeLock?.request) {
      setStatus('requesting');
      const previous = pending.current;
      pending.current = (async () => {
        await previous;
        if (disposed) return;
        try {
          const lock = await navigator.wakeLock.request('screen');
          // Check the document directly too: an event can precede React's cleanup.
          if (disposed || document.visibilityState === 'hidden') { await release(lock); return; }
          if (lock.released) { setStatus('suspended'); return; }
          held = lock;
          lock.addEventListener('release', onRelease);
          setStatus('active');
        } catch (_) {
          if (!disposed) setStatus('error');
        }
      })();
    } else setStatus('idle');
    const cleanup = () => {
      disposed = true;
      if (held) {
        const lock = held;
        held = null;
        lock.removeEventListener('release', onRelease);
        pending.current = Promise.all([pending.current, release(lock)]).then(() => {});
      }
    };
    stop.current = cleanup;
    return cleanup;
  }, [enabled, eligible, visible, restore]);

  const toggle = (value) => {
    if (!value) stop.current?.();
    setEnabled(value);
    try { localStorage.setItem(WAKE_LOCK_KEY, String(value)); setStorageFailed(false); }
    catch (_) { setStorageFailed(true); }
  };
  let message = 'Desativado: a tela pode apagar.';
  if (enabled) {
    if (!window.isSecureContext) message = 'Indisponível: requer HTTPS ou localhost.';
    else if (!navigator.wakeLock?.request) message = 'Indisponível: navegador sem suporte.';
    else if (completed) message = 'Suspenso: todas as tarefas foram marcadas como feitas.';
    else if (!eligible) message = 'Suspenso: fora da tela da rotina.';
    else if (!visible) message = 'Suspenso: página fora de vista.';
    else if (status === 'active') message = 'Ativo: bloqueio de tela adquirido.';
    else if (status === 'error') message = 'Não adquirido: o navegador recusou ou falhou. Desative e ative para tentar novamente.';
    else if (status === 'suspended') message = 'Suspenso: o navegador liberou o bloqueio. Desative e ative para tentar novamente.';
    else message = 'Solicitando bloqueio de tela…';
  }
  return { enabled, toggle, message, storageFailed };
}
