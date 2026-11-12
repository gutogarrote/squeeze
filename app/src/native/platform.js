import { Capacitor } from '@capacitor/core';

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform();

// Native WebViews use localhost / capacitor://localhost, which are not shareable.
export function routineBaseUrl() {
  return isNative ? 'https://squeeze.ggarrote.workers.dev/' : window.location.origin + '/';
}
