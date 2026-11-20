// Bridge to the Android app (Capacitor). On the web every export is inert.
import { Capacitor, registerPlugin } from '@capacitor/core';

// Links are shared with the public web address, never the app's internal origin.
export const PUBLIC_URL = 'https://squeeze.ggarrote.workers.dev/';

export const isNative = () => Capacitor.isNativePlatform();

let plugin = null;
// The native alert plugin (android/.../SqueezeAlertsPlugin.java), or null on the web.
export function nativeAlerts() {
  if (!isNative()) return null;
  if (!plugin) plugin = registerPlugin('SqueezeAlerts');
  return plugin;
}

export const shareOrigin = (native = isNative()) => (native ? PUBLIC_URL : `${window.location.origin}/`);

// Web views without the Screen Wake Lock API get it from the native window flag, so
// useScreenWakeLock works unchanged.
export function installWakeLock(bridge = nativeAlerts(), nav = navigator) {
  if (!bridge || nav.wakeLock?.request) return false;
  const request = async () => {
    await bridge.keepScreenOn({ on: true });
    const listeners = new Set();
    const sentinel = {
      released: false,
      type: 'screen',
      addEventListener: (type, fn) => { if (type === 'release') listeners.add(fn); },
      removeEventListener: (type, fn) => { if (type === 'release') listeners.delete(fn); },
      release: async () => {
        if (sentinel.released) return;
        sentinel.released = true;
        await bridge.keepScreenOn({ on: false });
        listeners.forEach((fn) => fn({ type: 'release', target: sentinel }));
      },
    };
    return sentinel;
  };
  Object.defineProperty(nav, 'wakeLock', { configurable: true, value: { request } });
  return true;
}

// Light haptic tick; silently unavailable where the browser has no vibration.
export function haptic(ms = 10) {
  try { navigator.vibrate?.(ms); } catch (_) { /* Best effort. */ }
}
