import { vi } from 'vitest';
import { haptic, installWakeLock, isNative, nativeAlerts, PUBLIC_URL, shareOrigin } from './native';

test('on the web there is no bridge and links use the page origin', () => {
  expect(isNative()).toBe(false);
  expect(nativeAlerts()).toBeNull();
  expect(shareOrigin()).toBe('http://localhost:3000/');
  expect(PUBLIC_URL).toMatch(/^https:\/\/.+\/$/);
  expect(installWakeLock()).toBe(false);
});

test('the wake lock comes from the native window flag when the web view lacks the API', async () => {
  const bridge = { keepScreenOn: vi.fn(() => Promise.resolve()) };
  const nav = {};
  expect(installWakeLock(bridge, nav)).toBe(true);
  const lock = await nav.wakeLock.request('screen');
  expect(bridge.keepScreenOn).toHaveBeenLastCalledWith({ on: true });
  const onRelease = vi.fn();
  lock.addEventListener('release', onRelease);
  await lock.release();
  await lock.release();
  expect(lock.released).toBe(true);
  expect(bridge.keepScreenOn).toHaveBeenCalledTimes(2);
  expect(bridge.keepScreenOn).toHaveBeenLastCalledWith({ on: false });
  expect(onRelease).toHaveBeenCalledOnce();
});

test('an existing wake lock API is left alone', () => {
  const request = vi.fn();
  const nav = { wakeLock: { request } };
  expect(installWakeLock({ keepScreenOn: vi.fn() }, nav)).toBe(false);
  expect(nav.wakeLock.request).toBe(request);
});

test('haptics are best effort', () => {
  const vibrate = vi.fn(() => { throw new Error('blocked'); });
  vi.stubGlobal('navigator', { vibrate });
  expect(() => haptic(5)).not.toThrow();
  expect(vibrate).toHaveBeenCalledWith(5);
  vi.stubGlobal('navigator', {});
  expect(() => haptic()).not.toThrow();
  vi.unstubAllGlobals();
});
