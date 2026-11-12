import { useLayoutEffect, useRef, useState } from 'react';
import { App } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { createBackgroundAlerts } from '../native/backgroundAlerts';
import { isNative, platform } from '../native/platform';
import { playSound, primeSounds } from '../lib/sound';

export default function useNativeAlerts({ run, enabled, now, clock, onAlert }) {
  const controller = useRef(null);
  const latest = useRef({ run, enabled, onAlert });
  latest.current = { run, enabled, onAlert };
  const [status, setStatus] = useState({ permission: 'prompt', error: '' });

  useLayoutEffect(() => {
    if (!isNative) return undefined;
    let mounted = true;
    let nativeActive = true;
    let stateEvents = 0;
    const listeners = [];
    const instance = createBackgroundAlerts({
      notifications: LocalNotifications, platform, clock, play: playSound,
      onAlert: level => latest.current.onAlert?.(level),
      onStatus: value => { if (mounted) setStatus(value); },
    });
    controller.current = instance;
    instance.update(latest.current.run, latest.current.enabled);
    const visibility = () => instance.setActive(nativeActive && document.visibilityState !== 'hidden');
    const addListener = (event, handler) => {
      App.addListener(event, handler).then(handle => {
        if (mounted) listeners.push(handle);
        else handle.remove();
      }).catch(() => { if (mounted) setStatus(s => ({ ...s, error: 'Não foi possível acompanhar os alertas em segundo plano. Reabra o app.' })); });
    };
    addListener('appStateChange', ({ isActive }) => { stateEvents++; nativeActive = isActive; visibility(); });
    // iOS sends pause before the process can be suspended; Android also sends it
    // when its activity loses focus. Schedule during that background allowance.
    addListener('pause', () => { stateEvents++; nativeActive = false; visibility(); });
    addListener('resume', () => { stateEvents++; nativeActive = true; visibility(); });
    App.getState().then(({ isActive }) => {
      if (mounted && stateEvents === 0) { nativeActive = isActive; visibility(); }
    }).catch(() => {});
    document.addEventListener('visibilitychange', visibility);
    // A restored routine has no Começar tap. Unlock its foreground audio on the
    // first touch too; notification sounds do not depend on Web Audio.
    document.addEventListener('pointerdown', primeSounds, true);
    visibility();
    instance.initialize();
    return () => {
      mounted = false;
      document.removeEventListener('visibilitychange', visibility);
      document.removeEventListener('pointerdown', primeSounds, true);
      listeners.forEach(handle => handle.remove());
      instance.dispose();
      if (controller.current === instance) controller.current = null;
    };
  }, [clock]);

  useLayoutEffect(() => { controller.current?.update(run, enabled); }, [run, enabled, now]);
  // Permission prompts must originate in Começar or the user's settings action.
  const requestPermission = () => controller.current?.requestPermission();
  return isNative ? { ...status, requestPermission } : null;
}
