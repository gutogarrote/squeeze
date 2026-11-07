import React, { useEffect } from 'react';

// Bottom sheet / dialog. Escape and the backdrop close it.
export default function Sheet({ title, onClose, children, footer, wide = false }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-black/70" />
      <section role="dialog" aria-modal="true" aria-label={title}
        className={`relative flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-zinc-950 ring-1 ring-white/10 sm:rounded-3xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}>
        <header className="flex items-center justify-between px-5 pb-2 pt-5">
          <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="grid h-9 w-9 place-items-center rounded-full text-xl text-zinc-400 hover:bg-white/10">×</button>
        </header>
        <div className="overflow-y-auto px-5 pb-5">{children}</div>
        {footer && <footer className="border-t border-white/5 px-5 py-4">{footer}</footer>}
      </section>
    </div>
  );
}

export function Button({ variant = 'secondary', className = '', ...props }) {
  const styles = {
    primary: 'bg-lime-300 text-zinc-950 hover:bg-lime-200',
    secondary: 'bg-white/10 text-zinc-100 hover:bg-white/15',
    danger: 'bg-rose-500/90 text-white hover:bg-rose-500',
    ghost: 'text-zinc-300 hover:bg-white/10',
  };
  return <button type="button" className={`rounded-xl px-4 py-3 text-sm font-semibold transition disabled:opacity-40 ${styles[variant]} ${className}`} {...props} />;
}
