import React, { useCallback, useEffect, useRef, useState } from 'react';
import PlanScreen from './screens/PlanScreen';
import RunScreen from './screens/RunScreen';
import RunEditor from './components/RunEditor';
import RestScreen from './components/RestScreen';
import SettingsSheet from './components/SettingsSheet';
import EndSheet from './components/EndSheet';
import Sheet, { Button } from './components/Sheet';
import PwaUpdateNotice from './components/PwaUpdateNotice';
import { cleanItems } from './components/TaskListEditor';
import useNow from './hooks/useNow';
import useAlerts from './hooks/useAlerts';
import useNativeAlerts from './hooks/useNativeAlerts';
import { routineBaseUrl } from './native/platform';
import useRestMode from './hooks/useRestMode';
import useScreenWakeLock from './hooks/useScreenWakeLock';
import {
  addTimeToCurrent, applyEdit, completeTask, extendDeadline, postponeTask, reactivateTask,
  releaseBuffer, runToPlanTasks, startRun, viewRun,
} from './lib/engine';
import { formatClock, nextOccurrence } from './lib/clock';
import { parseRoutineLink, serializeRoutineLink } from './lib/routineLink';
import {
  EXAMPLE_PLAN, loadDraft, loadRun, loadSettings, loadTemplates, makeId, normalizePlan,
  saveDraft, saveRun, saveSettings, saveTemplates, upsertTemplate,
} from './lib/storage';
import { primeSounds } from './lib/sound';

const withIds = (tasks) => tasks.map((t) => ({ id: makeId('p'), name: t.name, minutes: t.minutes }));
const planFrom = ({ name, deadline, tasks }, templateId = null) => ({ name, deadline, templateId, tasks: withIds(tasks) });

function readLink() {
  const parsed = parseRoutineLink(window.location.search);
  if (parsed.status !== 'absent') {
    // Each link is imported once; reloading the page does not import it again.
    const url = new URL(window.location.href);
    url.searchParams.delete('rotina');
    url.searchParams.delete('nome');
    try { window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash); } catch (_) {}
  }
  return parsed;
}

export default function App({ clock = Date.now }) {
  const now = useNow(clock);
  const [link] = useState(readLink);
  const [settings, setSettings] = useState(loadSettings);
  const [templates, setTemplates] = useState(loadTemplates);
  const [initial] = useState(() => {
    const stored = loadRun();
    const expiredAtLoad = !!stored && viewRun(stored, clock()).expired;
    return { run: expiredAtLoad ? null : stored, expiredAtLoad };
  });
  const [run, setRunState] = useState(initial.run);
  const [draft, setDraftState] = useState(() => {
    if (link.status === 'valid' && !initial.run) return planFrom(link.plan);
    return loadDraft() || normalizePlan(EXAMPLE_PLAN);
  });
  const [pendingImport, setPendingImport] = useState(() => (link.status === 'valid' && initial.run ? link.plan : null));
  const [toast, setToast] = useState(() => {
    if (link.status === 'invalid') return link.error;
    return initial.expiredAtLoad ? 'A rotina anterior foi encerrada automaticamente, 12 horas depois do deadline.' : '';
  });
  const [sheet, setSheet] = useState(null); // 'settings' | 'end' | 'edit' | { share: url }
  const runRef = useRef(run);
  runRef.current = run;

  const setRun = useCallback((next) => { runRef.current = next; setRunState(next); saveRun(next); }, []);
  const setDraft = useCallback((next) => { setDraftState(next); saveDraft(next); }, []);

  // An imported link becomes the saved draft; an expired run leaves storage.
  const imported = link.status === 'valid' && !initial.run;
  const importedDraft = useRef(imported ? draft : null);
  useEffect(() => {
    if (importedDraft.current) saveDraft(importedDraft.current);
    if (initial.expiredAtLoad) saveRun(null);
  }, [initial]);
  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(''), 4000); return () => clearTimeout(t); }, [toast]);

  const view = run ? viewRun(run, now) : null;

  // A run still open 12 hours after its deadline is closed (specifications.md §8).
  const expired = !!view?.expired;
  useEffect(() => {
    if (!expired) return;
    setRun(null);
    setSheet(null);
    setToast('A rotina foi encerrada automaticamente, 12 horas depois do deadline.');
  }, [expired, setRun]);

  const rest = useRestMode({ active: !!view && !view.allDone && !sheet, restAfterMin: settings.restAfterMin, now, clock });
  const nativeAlerts = useNativeAlerts({ run, enabled: settings.sound, now, clock, onAlert: rest.wake });
  useAlerts(view, { enabled: settings.sound, onAlert: rest.wake, managed: !!nativeAlerts });
  const wakeLock = useScreenWakeLock(!!view && sheet !== 'edit', !!view?.allDone);

  // Every gesture applies an engine operation; it returns false when nothing changed.
  const apply = (operation) => {
    const current = runRef.current;
    if (!current) return false;
    const next = operation(current, clock());
    if (next === current) return false;
    setRun(next);
    return true;
  };

  function start() {
    const tasks = cleanItems(draft.tasks);
    const plan = { ...draft, tasks };
    setDraft(plan);
    primeSounds();
    if (settings.sound) nativeAlerts?.requestPermission();
    setRun(startRun({ name: draft.name.trim() || 'Rotina', templateId: draft.templateId, deadlineMs: nextOccurrence(draft.deadline, clock()), tasks }, clock()));
  }

  function saveTemplate(asNew = false) {
    const plan = { ...draft, tasks: cleanItems(draft.tasks) };
    const exists = !asNew && templates.some((t) => t.id === draft.templateId);
    const { id, list } = upsertTemplate(templates, { ...plan, id: exists ? draft.templateId : undefined, templateId: exists ? draft.templateId : null });
    setTemplates(list);
    saveTemplates(list);
    setDraft({ ...plan, name: plan.name.trim() || 'Sem nome', templateId: id });
    setToast(exists ? 'Rotina salva.' : 'Nova rotina salva.');
  }

  function deleteTemplate(id) {
    const list = templates.filter((t) => t.id !== id);
    setTemplates(list);
    saveTemplates(list);
    if (draft.templateId === id) setDraft({ ...draft, templateId: null });
  }

  async function share() {
    let url;
    try {
      url = serializeRoutineLink(routineBaseUrl(), { name: draft.name.trim(), deadline: draft.deadline, tasks: cleanItems(draft.tasks) });
    } catch (error) {
      setToast(error.message);
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setToast('Link copiado.');
    } catch (_) {
      setSheet({ share: url });
    }
  }

  function endRun({ save = false, restart = false } = {}) {
    const current = runRef.current;
    if (!current) return;
    const tasks = runToPlanTasks(current);
    const deadline = formatClock(current.deadlineMs);
    let templateId = current.templateId;
    if (save) {
      const exists = templates.some((t) => t.id === current.templateId);
      const saved = upsertTemplate(templates, { id: exists ? current.templateId : undefined, name: current.name, deadline, tasks });
      templateId = saved.id;
      setTemplates(saved.list);
      saveTemplates(saved.list);
      setToast(exists ? 'Rotina salva atualizada.' : 'Rotina salva.');
    }
    // Restarting, or updating the routine open in the planner, shows the run's tasks there.
    if (restart || (save && draft.templateId === current.templateId)) {
      setDraft(planFrom({ name: current.name, deadline, tasks }, templateId));
    }
    setRun(null);
    setSheet(null);
  }

  function resolveImport(replace) {
    if (replace) {
      setRun(null);
      setDraft(planFrom(pendingImport));
    }
    setPendingImport(null);
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {view ? (
        <RunScreen
          view={view}
          now={now}
          onComplete={(id) => apply((r, t) => completeTask(r, id, t))}
          onPostpone={(id) => apply((r, t) => postponeTask(r, id, t))}
          onReactivate={(id) => apply((r, t) => reactivateTask(r, id, t))}
          onReleaseBuffer={() => apply((r, t) => releaseBuffer(r, t))}
          onAddFive={() => apply((r, t) => addTimeToCurrent(r, t))}
          onExtendDeadline={() => apply((r, t) => extendDeadline(r, t))}
          onEdit={() => setSheet('edit')}
          onEnd={() => setSheet('end')}
          onSettings={() => setSheet('settings')}
        />
      ) : (
        <PlanScreen
          draft={draft}
          onChange={setDraft}
          now={now}
          templates={templates}
          onStart={start}
          onSave={() => saveTemplate(false)}
          onSaveAsNew={() => saveTemplate(true)}
          onOpenTemplate={(t) => setDraft(planFrom(t, t.id))}
          onDeleteTemplate={deleteTemplate}
          onNew={() => setDraft({ name: '', deadline: draft.deadline, templateId: null, tasks: [] })}
          onShare={share}
          onSettings={() => setSheet('settings')}
        />
      )}

      {sheet === 'edit' && view && (
        <RunEditor view={view} now={now} onCancel={() => setSheet(null)}
          onSave={(edit) => { apply((r, t) => applyEdit(r, edit, t)); setSheet(null); }} />
      )}
      {sheet === 'end' && view && (
        <EndSheet hasTemplate={templates.some((t) => t.id === run.templateId)} onEnd={endRun} onClose={() => setSheet(null)} />
      )}
      {sheet === 'settings' && (
        <SettingsSheet settings={settings} wakeLock={wakeLock} nativeAlerts={nativeAlerts} onClose={() => setSheet(null)}
          onChange={(next) => {
            if (next.sound && !settings.sound) { primeSounds(); nativeAlerts?.requestPermission(); }
            setSettings(next); saveSettings(next);
          }} />
      )}
      {sheet?.share && (
        <Sheet title="Link da rotina" onClose={() => setSheet(null)}>
          <p className="mb-2 text-sm text-zinc-400">Não foi possível copiar automaticamente. Copie o link abaixo:</p>
          <input readOnly aria-label="Link da rotina" value={sheet.share} onFocus={(e) => e.target.select()}
            className="w-full rounded-lg bg-white/5 p-3 text-sm text-zinc-100" />
        </Sheet>
      )}
      {pendingImport && (
        <Sheet title="Abrir rotina do link?" onClose={() => resolveImport(false)}
          footer={(
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => resolveImport(false)}>Manter a atual</Button>
              <Button variant="danger" className="flex-1" onClick={() => resolveImport(true)}>Substituir</Button>
            </div>
          )}>
          <p className="text-zinc-300">
            Há uma rotina em andamento. Abrir “{pendingImport.name}” encerra a atual sem salvar.
          </p>
        </Sheet>
      )}

      {view && rest.resting && <RestScreen view={view} now={now} onWake={rest.wake} />}
      {toast && (
        <p role="status" className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-md rounded-xl bg-zinc-800 px-4 py-3 text-center text-sm text-zinc-100 shadow-xl ring-1 ring-white/10">
          {toast}
        </p>
      )}
      <PwaUpdateNotice editing={sheet === 'edit'} />
    </div>
  );
}
