import { LEVEL, alertLevel, nextAlert } from '../lib/alerts';
import { AUTO_CLOSE_MS, viewRun } from '../lib/engine';

export const ALERTS = [
  { level: LEVEL.five, id: 5101, thresholdMs: 300000, name: 'five', label: 'Faltam 5 minutos' },
  { level: LEVEL.one, id: 5102, thresholdMs: 60000, name: 'one', label: 'Falta 1 minuto' },
  { level: LEVEL.zero, id: 5103, thresholdMs: 0, name: 'zero', label: 'O tempo da tarefa acabou' },
];
export const notificationIds = ALERTS.map(({ id }) => ({ id }));

// The current task never advances by itself. Only its future thresholds are scheduled.
export function pendingAlerts(run, nowMs) {
  const view = run && viewRun(run, nowMs);
  if (!view?.current || view.expired) return [];
  const { current } = view;
  return ALERTS.flatMap(({ id, thresholdMs, name, label }) => {
    const atMs = nowMs + current.remainingMs - thresholdMs;
    if (atMs <= nowMs || atMs >= run.deadlineMs + AUTO_CLOSE_MS) return [];
    return [{
      id,
      title: label,
      body: current.name,
      sound: `squeeze_${name}.wav`,
      channelId: `squeeze_${name}_v1`,
      smallIcon: 'ic_stat_squeeze',
      // Inexact wake-up notifications, with normal notification sound settings.
      // Doze can defer/rate-limit them. Never request exact-alarm access.
      isExactNotification: false,
      foreground: false,
      schedule: { at: new Date(atMs), allowWhileIdle: true },
      extra: { taskId: current.id, activation: view.currentSinceMs },
    }];
  });
}

// Also serializes across React StrictMode's mount/cleanup/mount, so an old cleanup
// cannot cancel a newer controller's schedule.
let operations = Promise.resolve();
function enqueue(operation) {
  operations = operations.catch(() => {}).then(operation);
  return operations;
}

export function createBackgroundAlerts({ notifications, platform, clock, play, onAlert, onStatus }) {
  let run = null;
  let enabled = false;
  let active = true;
  let disposed = false;
  let permission = 'prompt';
  let alertState = null;
  let first = true;
  let generation = 0;
  let permissionGeneration = 0;
  let permissionRequest = null;
  let channelsPromise = null;
  let latest = Promise.resolve();

  const status = (error = '') => { if (!disposed) onStatus?.({ permission, error }); };

  function prepareChannels() {
    if (platform !== 'android') return Promise.resolve();
    if (!channelsPromise) {
      channelsPromise = (async () => {
        for (const { name, label } of ALERTS) {
          await notifications.createChannel({
            id: `squeeze_${name}_v1`, name: label, sound: `squeeze_${name}.wav`,
            importance: 4, visibility: 0, vibration: false,
          });
        }
      })().catch(error => { channelsPromise = null; throw error; });
    }
    return channelsPromise;
  }

  function baseline() {
    const view = run && viewRun(run, clock());
    alertState = view?.current ? {
      key: `${view.current.id}:${view.currentSinceMs}`,
      level: alertLevel(view.current.remainingMs),
    } : null;
  }

  function replace() {
    const version = ++generation;
    latest = enqueue(async () => {
      if (version !== generation) return;
      await notifications.cancel({ notifications: notificationIds });
      if (disposed || version !== generation || active || !enabled || permission !== 'granted') return;
      await prepareChannels();
      if (disposed || version !== generation || active || !enabled || permission !== 'granted') return;
      const pending = pendingAlerts(run, clock());
      if (pending.length) await notifications.schedule({ notifications: pending });
      // A task edit/foreground event may have arrived while schedule() was pending.
      if (version !== generation) await notifications.cancel({ notifications: notificationIds });
    }).catch(() => { if (version === generation) status('Não foi possível preparar os alertas em segundo plano. Tente novamente.'); });
    return latest;
  }

  function tick() {
    if (!active || disposed) return;
    const view = run && viewRun(run, clock());
    if (!view?.current || view.expired) { alertState = null; first = false; return; }
    const out = nextAlert(alertState, `${view.current.id}:${view.currentSinceMs}`, view.current.remainingMs, { silent: first });
    first = false;
    alertState = out.state;
    if (out.play !== LEVEL.none) {
      if (enabled) play(out.play);
      onAlert?.(out.play);
    }
  }

  function refreshPermission(request = false) {
    if (permissionRequest) return permissionRequest;
    const version = ++permissionGeneration;
    const operation = (async () => {
      try {
        const result = await (request ? notifications.requestPermissions() : notifications.checkPermissions());
        if (disposed || version !== permissionGeneration) return;
        permission = result.display;
        status();
        return replace();
      } catch (_) { if (version === permissionGeneration) status('Não foi possível verificar a permissão de notificações. Tente novamente.'); }
    })();
    if (request) {
      permissionRequest = operation.finally(() => { permissionRequest = null; });
      return permissionRequest;
    }
    return operation;
  }

  return {
    async initialize() {
      await replace(); // Remove any schedule left by a previous process/run.
      try {
        await prepareChannels();
        if (!disposed) await refreshPermission();
      } catch (_) { status('Não foi possível preparar os sons das notificações. Tente novamente.'); }
    },
    update(nextRun, sound) {
      if (disposed) return;
      const changed = run !== nextRun || enabled !== sound;
      run = nextRun;
      enabled = sound;
      if (changed) replace();
      tick();
    },
    setActive(value) {
      if (disposed || active === value) return;
      active = value;
      // Warnings reached while hidden belong to native notifications. Do not replay
      // them on return, even if Android deferred or the user dismissed them.
      baseline();
      first = false;
      replace();
      if (active) refreshPermission();
    },
    requestPermission: () => refreshPermission(true),
    async flush() {
      let pending;
      do { pending = latest; await pending; } while (pending !== latest);
    },
    dispose() { disposed = true; return replace(); },
  };
}
