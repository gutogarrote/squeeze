import React, { useEffect, useRef, useState } from 'react';
import SwipeCard from '../components/SwipeCard';
import useListMotion from '../hooks/useListMotion';
import useReorder from '../hooks/useReorder';
import { Button } from '../components/Sheet';
import TimelineCard from '../components/TimelineCard';
import { GearIcon } from './RoutinesScreen';
import { formatClock, formatCountdown, formatMinutes } from '../lib/clock';
import { cardHeight } from '../lib/cardSize';

const MIN_MS = 60000;
const FIVE_MIN_MS = 5 * MIN_MS;
function Bar({ value, total, tone }) {
  const pct = total > 0 ? Math.max(0, Math.min(100, (value / total) * 100)) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <div className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// Two short lines in the top-right corner: hold, then drag to move the task.
function DragHandle({ name, props, active }) {
  return (
    <button type="button" aria-label={`Mover ${name}`} title="Segure e arraste para mover"
      aria-keyshortcuts="ArrowUp ArrowDown" {...props}
      style={{ touchAction: 'none' }}
      className={`absolute right-1.5 top-1.5 z-10 grid h-8 w-9 select-none place-items-center rounded-lg transition ${
        active ? 'bg-white/15 text-zinc-100' : 'text-zinc-500 hover:bg-white/10 hover:text-zinc-300'}`}>
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M6 9.5h12M6 14.5h12" />
      </svg>
    </button>
  );
}

function Actions({ children }) {
  return <div className="mt-2 flex flex-wrap justify-end gap-2">{children}</div>;
}

function CurrentCard({ task, onAddFive, expanded, onToggle, onComplete, onPostpone, canPostpone, handle }) {
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
        leftHint="Concluir"
        rightHint={canPostpone ? 'Adiar' : ''}
        onTap={onToggle}
        bodyStyle={{ minHeight: cardHeight(Math.max(task.budgetMs, task.consumedMs)) }}
        className={`rounded-2xl p-5 ring-1 transition-colors duration-500 ${ring}`}
      >
        {handle}
        <p className="text-xs font-medium uppercase tracking-widest text-lime-300/80">Agora</p>
        <h2 className="mt-1 text-2xl font-semibold leading-tight text-zinc-50">{task.name}</h2>
        {task.type === 'fixed' && <p className="mt-1 text-xs font-medium text-sky-300">Tempo fixo · não faz squeeze</p>}
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

function UpcomingCard({ task, startMs, expanded, onToggle, onComplete, onPostpone, canPostpone, handle }) {
  const compressed = task.compressed;
  const expandedTime = task.remainingMs > task.referenceMs && task.referenceMs > 0;
  return (
    <div>
      <SwipeCard
        label={`Próxima: ${task.name}`}
        onSwipeLeft={onComplete}
        onSwipeRight={onPostpone}
        leftHint="Concluir"
        rightHint={canPostpone ? 'Adiar' : ''}
        onTap={onToggle}
        style={{ height: cardHeight(task.remainingMs) }}
        className="flex flex-col justify-center rounded-2xl bg-zinc-900/70 py-2 pl-4 pr-12 ring-1 ring-white/5"
      >
        {handle}
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
          {task.type === 'fixed' && <span className="shrink-0 text-xs text-sky-300">Fixo</span>}
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
        rightHint="Reativar"
        rightIcon="↺"
        onTap={onToggle}
        style={{ height: cardHeight(task.consumedMs) }}
        className="flex items-center justify-between gap-3 rounded-2xl bg-zinc-900/30 px-4 ring-1 ring-white/5"
      >
        <p className="min-w-0 truncate text-zinc-500 line-through decoration-zinc-600">
          <span aria-hidden="true" data-pop="" className="mr-2 inline-block text-lime-300/70 no-underline">✓</span>{task.name}
        </p>
        <p className="shrink-0 text-sm tabular-nums text-zinc-600">{formatMinutes(task.consumedMs)}</p>
      </SwipeCard>
      {expanded && (
        <Actions><Button variant="secondary" onClick={onReactivate}>Reativar</Button></Actions>
      )}
    </div>
  );
}

function BufferCard({ bufferMs, startMs, freeTime, expanded, onToggle, onRelease, name = 'Folga' }) {
  return (
    <div>
      <SwipeCard
        label={freeTime ? 'Tempo livre' : name}
        onSwipeLeft={freeTime ? () => false : onRelease}
        onSwipeRight={() => false}
        leftHint={freeTime ? '' : 'Distribuir'}
        leftIcon="⇣"
        leftTone="lime"
        onTap={onToggle}
        style={{ height: cardHeight(bufferMs) }}
        className="flex flex-col justify-center rounded-2xl border border-dashed border-lime-300/30 px-4"
      >
        <div className="flex items-baseline justify-between">
          <p className="font-medium text-lime-200">{freeTime ? 'Tempo livre' : name}</p>
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
  view, now, onComplete, onPostpone, onMove, onShare, onFinish, onReactivate, onReleaseBuffer, onAddFive, onExtendDeadline, onEdit, onEnd, onSettings,
}) {
  const [expanded, setExpanded] = useState(null);
  const currentRef = useRef(null);
  const currentId = view.current?.id;

  useEffect(() => {
    setExpanded(null);
    currentRef.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }, [currentId]);

  const toggle = (id) => setExpanded((e) => (e === id ? null : id));
  const motion = useListMotion();
  // Runs one operation and animates the list across it: `fly` sends the card away (done,
  // distributed), `lift` carries it to its new place (postponed, reactivated).
  const act = (fn, id, effect) => () => {
    setExpanded(null);
    motion.snapshot(id, effect);
    const changed = fn();
    if (!changed) motion.cancel();
    return changed;
  };
  const complete = (id) => act(() => onComplete(id), id, 'fly');
  const postpone = (id) => act(() => onPostpone(id), id, 'lift');
  const pending = view.tasks.filter((t) => t.status === 'pending' && t.type !== 'buffer');
  const lastPendingId = pending[pending.length - 1]?.id;
  const reorder = useReorder({
    container: motion.container,
    ids: pending.map((t) => t.id),
    onDrop: (id, to) => {
      setExpanded(null);
      motion.snapshot(id, 'lift');
      if (!onMove(id, to)) motion.cancel();
    },
  });
  const handleFor = (t) => (pending.length > 1
    ? <DragHandle name={t.name} props={reorder.handleProps(t.id)} active={reorder.drag?.id === t.id} />
    : null);

  // Projected start times of the upcoming tasks (time blocking).
  let cursor = now + Math.max(0, view.current?.remainingMs ?? 0);
  const starts = {};
  view.tasks.forEach((t) => {
    if (t.status !== 'pending' || t.isCurrent) return;
    starts[t.id] = cursor;
    cursor += Math.max(0, t.remainingMs);
  });

  return (
    <div className="mx-auto min-h-screen max-w-xl animate-rise px-4 pt-4" style={{ paddingBottom: 'calc(var(--safe-bottom) + 6rem)' }}>
      <header className="sticky top-0 z-20 -mx-4 bg-zinc-950/90 px-4 pb-3 pt-safe backdrop-blur">
        <TimelineCard startMs={view.startedAtMs} deadlineMs={view.deadlineMs} now={now} late={view.late} squeezed={view.deficitMs > 0} />
        {view.protectedDeficitMs > 0 && (
          <p role="status" className="mt-2 rounded-xl bg-rose-500/15 px-4 py-2 text-sm text-rose-200 ring-1 ring-rose-400/40">
            O plano ultrapassa o deadline em {formatMinutes(view.protectedDeficitMs)}. A duração das tarefas fixas será preservada.
          </p>
        )}
        {view.deficitMs > 0 && !view.late && !view.protectedDeficitMs && (
          <p role="status" className="mt-2 rounded-xl bg-amber-400/10 px-4 py-2 text-sm text-amber-200 ring-1 ring-amber-400/30">
            <strong className="font-semibold">Squeeze!</strong> Faltam {formatMinutes(view.deficitMs)} para caber tudo.
          </p>
        )}
      </header>

      {view.allDone && (
        <section className="mt-4 animate-pop-in rounded-2xl bg-lime-300/10 p-5 ring-1 ring-lime-300/30">
          <p className="text-xl font-semibold text-lime-200">Tudo feito!</p>
          <p className="mt-1 text-zinc-300">Deslize uma tarefa concluída para a direita para reativá-la, inclua tarefas em Editar ou encerre a rotina.</p>
          <Button variant="primary" className="mt-3" onClick={onFinish}>Encerrar rotina</Button>
        </section>
      )}

      <div ref={motion.container} className="relative mt-4">
        <ol className="space-y-2" aria-label="Tarefas">
          {view.tasks.map((t) => (
            <li key={t.id} data-motion-id={t.id} ref={t.isCurrent ? currentRef : null} className="relative" style={reorder.itemStyle(t.id)}>
              {t.status === 'done' ? (
                <DoneCard task={t} expanded={expanded === t.id} onToggle={() => toggle(t.id)}
                  onReactivate={act(() => onReactivate(t.id), t.id, 'lift')} />
              ) : t.type === 'buffer' ? (
                <BufferCard name={t.name} bufferMs={Math.max(0, t.remainingMs)} startMs={t.isCurrent ? now : starts[t.id]}
                  freeTime={view.allDone} expanded={expanded === t.id} onToggle={() => toggle(t.id)} onRelease={complete(t.id)} />
              ) : t.isCurrent ? (
                <CurrentCard task={t} expanded={expanded === t.id} onToggle={() => toggle(t.id)}
                  canPostpone={t.id !== lastPendingId}
                  onAddFive={onAddFive} onComplete={complete(t.id)} onPostpone={postpone(t.id)} handle={handleFor(t)} />
              ) : (
                <UpcomingCard task={t} startMs={starts[t.id]} expanded={expanded === t.id} onToggle={() => toggle(t.id)}
                  canPostpone={t.id !== lastPendingId}
                  onComplete={complete(t.id)} onPostpone={postpone(t.id)} handle={handleFor(t)} />
              )}
            </li>
          ))}
          {view.bufferMs > 0 && (
            <li data-motion-id="buffer" className="relative">
              <BufferCard bufferMs={view.bufferMs} startMs={cursor} freeTime={view.allDone} expanded={expanded === 'buffer'}
                onToggle={() => toggle('buffer')} onRelease={act(onReleaseBuffer, 'buffer', 'fly')} />
            </li>
          )}
        </ol>
      </div>

      <section aria-label="Deadline da rotina"
        className={`mt-4 flex items-center justify-between gap-3 rounded-2xl px-4 py-4 ring-1 ${view.late ? 'bg-rose-600/90 ring-rose-400' : 'bg-zinc-900 ring-white/10'}`}>
        <div>
          <p className={`text-xs uppercase tracking-widest ${view.late ? 'text-rose-100' : 'text-zinc-400'}`}>
            Deadline {formatClock(view.deadlineMs)}
          </p>
          {view.late && <p className="mt-1 text-sm font-medium text-rose-100">O tempo acabou</p>}
          <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-50" data-testid="until-deadline">
            {formatCountdown(view.untilDeadlineMs)}
          </p>
        </div>
        <button type="button" onClick={onExtendDeadline} aria-label="Mais 5 minutos no deadline"
          className="shrink-0 rounded-full bg-white/10 px-3 py-2 text-sm font-semibold text-zinc-50 ring-1 ring-white/15 hover:bg-white/20">
          +5 deadline
        </button>
      </section>
      <nav aria-label="Ações da rotina" className="mt-4 flex items-center justify-end gap-1">
        <p className="mr-auto min-w-0 truncate text-sm text-zinc-500">{view.name}</p>
        <Button variant="secondary" onClick={onShare} aria-label="Compartilhar rotina" title="Compartilhar rotina">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" />
            <path d="M8.2 10.8l7.6-4.5M8.2 13.2l7.6 4.5" />
          </svg>
        </Button>
        <Button variant="secondary" onClick={onEdit}>Editar</Button>
        <Button variant="secondary" onClick={onSettings} aria-label="Ajustes" className="px-3"><GearIcon /></Button>
        <Button variant="secondary" onClick={onEnd}>Encerrar</Button>
      </nav>
      {!view.allDone && (
        <p className="mt-6 text-center text-xs text-zinc-600">Deslize ← para concluir, → para adiar. Segure e arraste as duas linhas de um card para movê-lo. Toque num card para ver as ações.</p>
      )}
    </div>
  );
}
