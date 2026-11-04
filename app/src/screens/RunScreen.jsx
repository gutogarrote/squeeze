import React, { useEffect, useRef, useState } from 'react';
import SwipeCard from '../components/SwipeCard';
import { Button } from '../components/Sheet';
import { formatClock, formatCountdown, formatMinutes } from '../lib/clock';

const MIN_MS = 60000;
const FIVE_MIN_MS = 5 * MIN_MS;
const MIN_H = 64;
const MAX_H = 144;

// Card height follows the time reserved for the task (specifications.md §12).
const heightFor = (ms) => Math.round(MIN_H + (Math.min(Math.max(ms, 0), 60 * MIN_MS) / (60 * MIN_MS)) * (MAX_H - MIN_H));

function Bar({ value, total, tone }) {
  const pct = total > 0 ? Math.max(0, Math.min(100, (value / total) * 100)) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function Actions({ children }) {
  return <div className="mt-2 flex flex-wrap justify-end gap-2">{children}</div>;
}

function CurrentCard({ task, onAddFive, expanded, onToggle, onComplete, onPostpone, canPostpone }) {
  const remaining = task.remainingMs;
  const over = remaining < 0;
  const warn = !over && remaining <= FIVE_MIN_MS;
  const tone = over ? 'text-rose-400' : warn ? 'text-amber-300' : 'text-zinc-50';
  const ring = over ? 'ring-rose-500/50 bg-rose-950/40' : warn ? 'ring-amber-400/40 bg-amber-950/30' : 'ring-lime-300/30 bg-zinc-900';
  return (
    <div>
      <SwipeCard
        label={`Tarefa atual: ${task.name}`}
        onSwipeLeft={onComplete}
        onSwipeRight={onPostpone}
        leftHint="Concluir ✓"
        rightHint={canPostpone ? 'Adiar ↓' : ''}
        onTap={onToggle}
        className={`rounded-2xl p-5 ring-1 ${ring}`}
      >
        <p className="text-xs font-medium uppercase tracking-widest text-lime-300/80">Agora</p>
        <h2 className="mt-1 text-2xl font-semibold leading-tight text-zinc-50">{task.name}</h2>
        <div className="mt-3 flex items-end justify-between gap-3">
          <p className={`${Math.abs(remaining) >= 3600000 ? 'text-5xl' : 'text-6xl'} font-semibold tabular-nums tracking-tight ${tone}`} aria-label={over ? `Excedeu ${formatCountdown(-remaining).replace('-', '')}` : `Restam ${formatCountdown(remaining)}`}>
            {formatCountdown(remaining)}
          </p>
          {remaining <= FIVE_MIN_MS && (
            <button type="button" onClick={onAddFive}
              className="mb-2 shrink-0 whitespace-nowrap rounded-full bg-white/10 px-4 py-2 text-base font-semibold text-zinc-50 ring-1 ring-white/15 hover:bg-white/20">
              +5 min
            </button>
          )}
        </div>
        <div className="mt-3">
          <Bar value={task.consumedMs} total={Math.max(task.budgetMs, task.consumedMs, 1)} tone={over ? 'bg-rose-400' : warn ? 'bg-amber-300' : 'bg-lime-300'} />
        </div>
        <p className="mt-2 text-sm text-zinc-400">
          {formatMinutes(task.consumedMs)} feitos · estimativa {formatMinutes(task.estimateMs)}
          {task.budgetMs !== task.estimateMs && !over && <> · reservado {formatMinutes(task.budgetMs)}</>}
          {over && <> · <span className="text-rose-300">excedeu {formatMinutes(-remaining).replace('-', '')}</span></>}
        </p>
      </SwipeCard>
      {expanded && (
        <Actions>
          <Button variant="secondary" onClick={onPostpone} disabled={!canPostpone}>Adiar</Button>
          <Button variant="primary" onClick={onComplete}>Concluir</Button>
        </Actions>
      )}
    </div>
  );
}

function UpcomingCard({ task, startMs, expanded, onToggle, onComplete, onPostpone, canPostpone }) {
  const compressed = task.compressed;
  const expandedTime = task.remainingMs > task.referenceMs && task.referenceMs > 0;
  return (
    <div>
      <SwipeCard
        label={`Próxima: ${task.name}`}
        onSwipeLeft={onComplete}
        onSwipeRight={onPostpone}
        leftHint="Concluir ✓"
        rightHint={canPostpone ? 'Adiar ↓' : ''}
        onTap={onToggle}
        style={{ height: heightFor(task.remainingMs) }}
        className="flex flex-col justify-center rounded-2xl bg-zinc-900/70 px-4 py-2 ring-1 ring-white/5 transition-[height] duration-500"
      >
        <div className="flex items-baseline justify-between gap-3">
          <p className="min-w-0 truncate text-base font-medium text-zinc-100">{task.name}</p>
          <p className="shrink-0 tabular-nums text-zinc-100">
            {formatMinutes(task.remainingMs)}
            {compressed && <span className="text-sm text-amber-300/90"> de {formatMinutes(task.referenceMs)}</span>}
            {expandedTime && <span className="text-sm text-lime-300/90"> +{formatMinutes(task.remainingMs - task.referenceMs)}</span>}
          </p>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <span className="w-11 shrink-0 text-xs tabular-nums text-zinc-500">{formatClock(startMs)}</span>
          {task.referenceMs > 0
            ? <Bar value={task.remainingMs} total={Math.max(task.referenceMs, task.remainingMs)} tone={compressed ? 'bg-amber-300/80' : 'bg-zinc-400/60'} />
            : <span className="text-xs text-rose-300">{task.overrunMs > 0 ? `excedeu ${formatMinutes(task.overrunMs)}` : 'sem tempo'}</span>}
        </div>
      </SwipeCard>
      {expanded && (
        <Actions>
          <Button variant="secondary" onClick={onPostpone} disabled={!canPostpone}>Adiar</Button>
          <Button variant="primary" onClick={onComplete}>Concluir</Button>
        </Actions>
      )}
    </div>
  );
}

function DoneCard({ task, expanded, onToggle, onReactivate }) {
  return (
    <div>
      <SwipeCard
        label={`Concluída: ${task.name}`}
        onSwipeLeft={() => false}
        onSwipeRight={onReactivate}
        rightHint="Reativar ↺"
        onTap={onToggle}
        style={{ height: MIN_H }}
        className="flex items-center justify-between gap-3 rounded-2xl bg-zinc-900/30 px-4 ring-1 ring-white/5"
      >
        <p className="min-w-0 truncate text-zinc-500 line-through decoration-zinc-600">
          <span aria-hidden="true" className="mr-2 text-lime-300/70 no-underline">✓</span>{task.name}
        </p>
        <p className="shrink-0 text-sm tabular-nums text-zinc-600">{formatMinutes(task.consumedMs)}</p>
      </SwipeCard>
      {expanded && (
        <Actions><Button variant="secondary" onClick={onReactivate}>Reativar</Button></Actions>
      )}
    </div>
  );
}

function BufferCard({ bufferMs, startMs, freeTime, expanded, onToggle, onRelease }) {
  return (
    <div>
      <SwipeCard
        label={freeTime ? 'Tempo livre' : 'Folga'}
        onSwipeLeft={freeTime ? () => false : onRelease}
        onSwipeRight={() => false}
        leftHint={freeTime ? '' : 'Distribuir'}
        onTap={onToggle}
        style={{ height: heightFor(bufferMs) }}
        className="flex flex-col justify-center rounded-2xl border border-dashed border-lime-300/30 px-4 transition-[height] duration-500"
      >
        <div className="flex items-baseline justify-between">
          <p className="font-medium text-lime-200">{freeTime ? 'Tempo livre' : 'Folga'}</p>
          <p className="tabular-nums text-lime-200">+{formatMinutes(bufferMs)}</p>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          <span className="tabular-nums">{formatClock(startMs)}</span> · {freeTime ? 'Inclua tarefas na edição para aproveitar.' : 'Usada primeiro quando algo atrasa.'}
        </p>
      </SwipeCard>
      {expanded && !freeTime && (
        <Actions><Button variant="secondary" onClick={onRelease}>Distribuir folga</Button></Actions>
      )}
    </div>
  );
}

export default function RunScreen({
  view, now, onComplete, onPostpone, onReactivate, onReleaseBuffer, onAddFive, onExtendDeadline, onEdit, onEnd, onSettings,
}) {
  const [expanded, setExpanded] = useState(null);
  const currentRef = useRef(null);
  const currentId = view.current?.id;

  useEffect(() => {
    setExpanded(null);
    currentRef.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }, [currentId]);

  const toggle = (id) => setExpanded((e) => (e === id ? null : id));
  const act = (fn) => () => { setExpanded(null); return fn(); };
  const pending = view.tasks.filter((t) => t.status === 'pending');
  const lastPendingId = pending[pending.length - 1]?.id;

  // Projected start times of the upcoming tasks (time blocking).
  let cursor = now + Math.max(0, view.current?.remainingMs ?? 0);
  const starts = {};
  view.tasks.forEach((t) => {
    if (t.status !== 'pending' || t.isCurrent) return;
    starts[t.id] = cursor;
    cursor += Math.max(0, t.remainingMs);
  });

  return (
    <div className="mx-auto min-h-screen max-w-xl px-4 pb-24 pt-4">
      <header className="sticky top-0 z-20 -mx-4 bg-zinc-950/90 px-4 pb-3 pt-1 backdrop-blur">
        <div className="flex items-center gap-2">
          <p className="mr-auto min-w-0 truncate text-sm font-medium text-zinc-400">{view.name}</p>
          <Button variant="ghost" onClick={onEdit}>Editar</Button>
          <Button variant="ghost" onClick={onSettings} aria-label="Ajustes">⚙︎</Button>
          <Button variant="ghost" onClick={onEnd}>Encerrar</Button>
        </div>
        <div className={`mt-2 flex items-center justify-between rounded-2xl px-4 py-3 ring-1 ${view.late ? 'bg-rose-600/90 ring-rose-400' : 'bg-zinc-900 ring-white/5'}`}>
          <div>
            <p className={`text-xs uppercase tracking-widest ${view.late ? 'text-rose-100' : 'text-zinc-500'}`}>
              {view.late ? 'O tempo acabou' : `Deadline ${formatClock(view.deadlineMs)}`}
            </p>
            <p className="text-2xl font-semibold tabular-nums text-zinc-50" data-testid="until-deadline">
              {formatCountdown(view.untilDeadlineMs)}
            </p>
          </div>
          <button type="button" onClick={onExtendDeadline} aria-label="Mais 5 minutos no deadline"
            className="rounded-full bg-white/10 px-3 py-2 text-sm font-semibold text-zinc-50 ring-1 ring-white/15 hover:bg-white/20">
            +5 deadline
          </button>
        </div>
        {view.deficitMs > 0 && !view.late && (
          <p role="status" className="mt-2 rounded-xl bg-amber-400/10 px-4 py-2 text-sm text-amber-200 ring-1 ring-amber-400/30">
            Faltam {formatMinutes(view.deficitMs)} para caber tudo: as próximas tarefas estão comprimidas.
          </p>
        )}
      </header>

      {view.allDone && (
        <section className="mt-4 rounded-2xl bg-lime-300/10 p-5 ring-1 ring-lime-300/30">
          <p className="text-xl font-semibold text-lime-200">Tudo feito!</p>
          <p className="mt-1 text-zinc-300">Deslize uma tarefa concluída para a direita para reativá-la, inclua tarefas em Editar ou encerre a rotina.</p>
          <Button variant="primary" className="mt-3" onClick={onEnd}>Encerrar rotina</Button>
        </section>
      )}

      <ol className="mt-4 space-y-2" aria-label="Tarefas">
        {view.tasks.map((t) => (
          <li key={t.id} ref={t.isCurrent ? currentRef : null}>
            {t.status === 'done' ? (
              <DoneCard task={t} expanded={expanded === t.id} onToggle={() => toggle(t.id)} onReactivate={act(() => onReactivate(t.id))} />
            ) : t.isCurrent ? (
              <CurrentCard task={t} expanded={expanded === t.id} onToggle={() => toggle(t.id)}
                canPostpone={t.id !== lastPendingId}
                onAddFive={onAddFive} onComplete={act(() => onComplete(t.id))} onPostpone={act(() => onPostpone(t.id))} />
            ) : (
              <UpcomingCard task={t} startMs={starts[t.id]} expanded={expanded === t.id} onToggle={() => toggle(t.id)}
                canPostpone={t.id !== lastPendingId}
                onComplete={act(() => onComplete(t.id))} onPostpone={act(() => onPostpone(t.id))} />
            )}
          </li>
        ))}
        {view.bufferMs > 0 && (
          <li>
            <BufferCard bufferMs={view.bufferMs} startMs={cursor} freeTime={view.allDone} expanded={expanded === 'buffer'}
              onToggle={() => toggle('buffer')} onRelease={act(onReleaseBuffer)} />
          </li>
        )}
      </ol>

      <p className="mt-4 flex items-center justify-between border-t border-white/5 pt-3 text-sm text-zinc-500">
        <span>Deadline</span><span className="tabular-nums">{formatClock(view.deadlineMs)}</span>
      </p>
      {!view.allDone && (
        <p className="mt-6 text-center text-xs text-zinc-600">Deslize ← para concluir, → para adiar. Toque num card para ver as ações.</p>
      )}
    </div>
  );
}
