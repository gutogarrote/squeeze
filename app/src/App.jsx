import React, { useCallback, useEffect, useRef, useState } from 'react';
import PlanScreen from './screens/PlanScreen';
import RoutinesScreen from './screens/RoutinesScreen';
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
import useRestMode from './hooks/useRestMode';
import useScreenWakeLock from './hooks/useScreenWakeLock';
import {
  addTimeToCurrent, applyEdit, completeTask, extendDeadline, moveTask, postponeTask, reactivateTask,
  releaseBuffer, runToPlanTasks, startRun, viewRun,
} from './lib/engine';
import { formatClock, nextOccurrence } from './lib/clock';
import { parseRoutineLink, serializeRoutineLink } from './lib/routineLink';
import {
  EXAMPLE_PLAN, loadDraft, loadRun, loadSettings, loadTemplates, makeId, normalizePlan,
  saveDraft, saveRun, saveSettings, saveTemplates, upsertTemplate,
} from './lib/storage';
import { playFeedback, playSound, primeSounds } from './lib/sound';
import { nativeAlerts, shareOrigin } from './lib/native';
import { typeProps } from './lib/taskTypes';

const planTasks = (tasks) => tasks.map((t) => ({ name: t.name, minutes: t.minutes, type: typeProps(t).type }));
// A run changed the saved routine it came from: name, deadline, tasks, minutes or types.
function changesSavedRoutine(run, templates) {
  const template = templates.find((t) => t.id === run?.templateId);
  if (!template) return false;
  return template.name !== run.name || template.deadline !== formatClock(run.deadlineMs) ||
    JSON.stringify(planTasks(template.tasks)) !== JSON.stringify(planTasks(runToPlanTasks(run)));
}

const withIds = (tasks) => tasks.map((t) => ({ id: makeId('p'), name: t.name, minutes: t.minutes, ...typeProps(t) }));
const planFrom = ({ name, deadline, tasks }, templateId = null) => ({ name, deadline, templateId, tasks: withIds(tasks) });

function readLink() {
  const parsed = parseRoutineLink(window.location.search);
  if (parsed.status !== 'absent') {
    // Each link is imported once; reloading the page does not import it again.
    const url = new URL(window.location.href);
    url.searchParams.delete('rotina');
    url.searchParams.delete('nome');
    url.searchParams.delete('tipos');
    try { window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash); } catch (_) {}
  }
  return parsed;
}

export default function App({ clock = Date.now, native = nativeAlerts(), feedback = playFeedback, home = 'routines' }) {
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
  // Without a run: the routines (home) or the planner. A routine link opens in the planner.
  const [screen, setScreen] = useState(() => (link.status === 'valid' ? 'plan' : home));
  const [focusDeadline, setFocusDeadline] = useState(false);
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

  // Android app: a routine link that opens the app arrives as an event, not in the address.
  useEffect(() => {
    if (!native?.addListener) return undefined;
    let handle = null;
    let disposed = false;
    Promise.resolve(native.addListener('routineLink', ({ url }) => {
      let parsed;
      try { parsed = parseRoutineLink(new URL(url).search); } catch (_) { return; }
      if (parsed.status === 'invalid') setToast(parsed.error);
      if (parsed.status !== 'valid') return;
      setSheet(null);
      if (runRef.current) setPendingImport(parsed.plan);
      else { setDraft(planFrom(parsed.plan)); setScreen('plan'); }
    })).then((listener) => { handle = listener; if (disposed) listener?.remove?.(); }).catch(() => {});
    return () => { disposed = true; handle?.remove?.(); };
  }, [native, setDraft]);

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
  // In the Android app the system plays the alerts (they must sound with the screen off).
  const reminderMs = settings.reminderMin * 60000;
  const style = settings.alertStyle;
  const playNative = useNativeAlerts(view, now, { enabled: settings.sound, bridge: native, reminderMs, style });
  const playWeb = useCallback((level) => playSound(level, style), [style]);
  useAlerts(view, { enabled: settings.sound, onAlert: rest.wake, play: playNative || playWeb, reminderMs });
  // Short sounds answering the user's own gestures follow the same switch.
  const cue = (name) => { if (settings.sound) feedback(name); };
  const wakeLock = useScreenWakeLock(!!view && sheet !== 'edit', !!view?.allDone);

  const go = (next) => { setFocusDeadline(false); setScreen(next); };

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
    // The routine was used now: "last used" order on the home screen.
    if (templates.some((t) => t.id === draft.templateId)) {
      const list = templates.map((t) => (t.id === draft.templateId ? { ...t, lastUsedAt: clock() } : t));
      setTemplates(list);
      saveTemplates(list);
    }
    if (native) Promise.resolve(native.requestNotifications()).catch(() => {});
    primeSounds();
    setRun(startRun({ name: draft.name.trim() || 'Rotina', templateId: draft.templateId, deadlineMs: nextOccurrence(draft.deadline, clock()), tasks }, clock()));
  }

  function saveTemplate(asNew = false, name = draft.name) {
    const plan = { ...draft, name, tasks: cleanItems(draft.tasks) };
    const exists = !asNew && templates.some((t) => t.id === draft.templateId);
    const { id, list } = upsertTemplate(templates, { ...plan, id: exists ? draft.templateId : undefined, templateId: exists ? draft.templateId : null });
    setTemplates(list);
    saveTemplates(list);
    setDraft({ ...plan, name: plan.name.trim() || 'Sem nome', templateId: id });
    setToast(exists ? 'Rotina salva.' : 'Nova rotina salva.');
  }

  function renameTemplate(id, name) {
    const list = templates.map((t) => (t.id === id ? { ...t, name } : t));
    setTemplates(list);
    saveTemplates(list);
    if (draft.templateId === id) setDraft({ ...draft, name });
    setToast('Rotina renomeada.');
  }

  function deleteTemplate(id) {
    const list = templates.filter((t) => t.id !== id);
    setTemplates(list);
    saveTemplates(list);
    if (draft.templateId === id) setDraft({ ...draft, templateId: null });
  }

  function moveTemplate(id, direction) {
    const index = templates.findIndex((t) => t.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= templates.length) return;
    const list = templates.slice();
    const [template] = list.splice(index, 1);
    list.splice(target, 0, template);
    setTemplates(list);
    saveTemplates(list);
  }

  function routineUrl(plan) {
    try {
      return serializeRoutineLink(shareOrigin(!!native), plan);
    } catch (error) {
      setToast(error.message);
      return null;
    }
  }

  async function copyLink(url) {
    try {
      await navigator.clipboard.writeText(url);
      setToast('Link copiado.');
    } catch (_) {
      setSheet({ share: url });
    }
  }

  async function share() {
    const url = routineUrl({ name: draft.name.trim(), deadline: draft.deadline, tasks: cleanItems(draft.tasks) });
    if (url) await copyLink(url);
  }

  // The routine being run, as it stands now (edits included), through the system's share
  // sheet when there is one; otherwise the link is copied.
  async function shareRun() {
    const current = runRef.current;
    if (!current) return;
    const url = routineUrl({ name: current.name, deadline: formatClock(current.deadlineMs), tasks: runToPlanTasks(current) });
    if (!url) return;
    const title = `${current.name} — Squeeze`;
    try {
      if (native?.share) { await native.share({ title, url }); return; }
      if (navigator.share) { await navigator.share({ title, url }); return; }
    } catch (error) {
      if (error?.name === 'AbortError') return;
    }
    await copyLink(url);
  }

  // Completing the last task ends the routine: a celebration and the closing options.
  function complete(id) {
    const changed = apply((r, t) => completeTask(r, id, t));
    if (!changed) return false;
    if (viewRun(runRef.current, clock()).allDone) {
      cue('finish');
      setSheet('end');
    } else cue('done');
    return true;
  }

  function postpone(id) {
    const changed = apply((r, t) => postponeTask(r, id, t));
    if (changed) cue('postpone');
    return changed;
  }

  function move(id, to) {
    const changed = apply((r, t) => moveTask(r, id, to, t));
    if (changed) cue('postpone');
    return changed;
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
    // Restarting goes to the planner, at the deadline; anything else back to the routines.
    if (restart) { setScreen('plan'); setFocusDeadline(true); } else go('routines');
  }

  function resolveImport(replace) {
    if (replace) {
      setRun(null);
      setDraft(planFrom(pendingImport));
      go('plan');
    }
    setPendingImport(null);
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {view ? (
        <RunScreen
          view={view}
          now={now}
          onComplete={complete}
          onPostpone={postpone}
          onMove={move}
          onShare={shareRun}
          onFinish={() => setSheet('end')}
          onReactivate={(id) => apply((r, t) => reactivateTask(r, id, t))}
          onReleaseBuffer={() => apply((r, t) => releaseBuffer(r, t))}
          onAddFive={() => apply((r, t) => addTimeToCurrent(r, t))}
          onExtendDeadline={() => apply((r, t) => extendDeadline(r, t))}
          onEdit={() => setSheet('edit')}
          onEnd={() => setSheet('end')}
          onSettings={() => setSheet('settings')}
        />
      ) : screen === 'routines' ? (
        <RoutinesScreen
          templates={templates}
          currentId={draft.templateId}
          draft={draft}
          sort={settings.routineSort}
          onSort={(routineSort) => { const next = { ...settings, routineSort }; setSettings(next); saveSettings(next); }}
          onOpen={(t) => { setDraft(planFrom(t, t.id)); go('plan'); }}
          onDelete={deleteTemplate}
          onRename={renameTemplate}
          onMove={moveTemplate}
          onNew={() => { setDraft({ name: '', deadline: draft.deadline, templateId: null, tasks: [] }); go('plan'); }}
          onContinue={() => go('plan')}
          onSettings={() => setSheet('settings')}
        />
      ) : (
        <PlanScreen
          draft={draft}
          focusDeadline={focusDeadline}
          onRoutines={() => go('routines')}
          onChange={setDraft}
          now={now}
          templates={templates}
          onStart={start}
          onSave={() => saveTemplate(false)}
          onSaveAsNew={(name) => saveTemplate(true, name)}
          onShare={share}
          onSettings={() => setSheet('settings')}
          sound={settings.sound}
          onToggleSound={(sound) => { const next = { ...settings, sound }; setSettings(next); saveSettings(next); }}
        />
      )}

      {sheet === 'edit' && view && (
        <RunEditor view={view} now={now} onCancel={() => setSheet(null)}
          onSave={(edit) => { apply((r, t) => applyEdit(r, edit, t)); setSheet(null); }} />
      )}
      {sheet === 'end' && view && (
        <EndSheet view={view} now={now} canSave={changesSavedRoutine(run, templates)}
          onEnd={endRun} onEdit={() => setSheet('edit')} onClose={() => setSheet(null)} />
      )}
      {sheet === 'settings' && (
        <SettingsSheet settings={settings} wakeLock={wakeLock} native={!!native} onClose={() => setSheet(null)}
          onChange={(next) => { setSettings(next); saveSettings(next); }} />
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
        <p role="status" className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-md animate-pop-in rounded-xl bg-zinc-800 px-4 py-3 text-center text-sm text-zinc-100 shadow-xl ring-1 ring-white/10">
          {toast}
        </p>
      )}
      {!native && <PwaUpdateNotice editing={sheet === 'edit'} />}
    </div>
  );
}
