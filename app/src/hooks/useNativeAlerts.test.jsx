import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { startRun } from '../lib/engine';
import { LEVEL } from '../lib/alerts';
import useNativeAlerts from './useNativeAlerts';

const mock = vi.hoisted(() => ({ events: new Map(), pending: new Map(), handles: [], play: vi.fn(), prime: vi.fn() }));
vi.mock('../native/platform', () => ({ isNative: true, platform: 'android' }));
vi.mock('../lib/sound', () => ({ playSound: mock.play, primeSounds: mock.prime }));
vi.mock('@capacitor/app', () => ({ App: {
  getState: vi.fn(async () => ({ isActive: true })),
  addListener: vi.fn(async (name, handler) => {
    mock.events.set(name, handler);
    const handle = { remove: vi.fn(async () => {
      if (mock.events.get(name) === handler) mock.events.delete(name);
    }) };
    mock.handles.push(handle);
    return handle;
  }),
} }));
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: {
  checkPermissions: vi.fn(async () => ({ display: 'granted' })),
  requestPermissions: vi.fn(async () => ({ display: 'granted' })),
  createChannel: vi.fn(async () => {}),
  cancel: vi.fn(async ({ notifications }) => notifications.forEach(n => mock.pending.delete(n.id))),
  schedule: vi.fn(async ({ notifications }) => notifications.forEach(n => mock.pending.set(n.id, n))),
} }));

const MIN = 60000;
const START = Date.UTC(2026, 10, 12, 12);
let now;
const clock = () => now;
const run = () => startRun({ name: 'Teste', deadlineMs: START + 10 * MIN, tasks: [{ name: 'A', minutes: 10 }] }, START);

beforeEach(() => {
  now = START;
  mock.pending.clear();
  mock.events.clear();
  mock.handles.length = 0;
  vi.clearAllMocks();
});

async function renderNative(wrapper) {
  const utils = renderHook(({ r, time }) => useNativeAlerts({ run: r, enabled: true, now: time, clock }), {
    initialProps: { r: run(), time: now }, wrapper,
  });
  await waitFor(() => expect(utils.result.current.permission).toBe('granted'));
  return utils;
}

test('native pause schedules, resume cancels, and crossing hidden thresholds never replays', async () => {
  const utils = await renderNative();
  await act(async () => { mock.events.get('pause')(); });
  await waitFor(() => expect(mock.pending.size).toBe(3));
  now = START + 9.5 * MIN;
  await act(async () => { mock.events.get('resume')(); });
  await waitFor(() => expect(mock.pending.size).toBe(0));
  utils.rerender({ r: run(), time: now });
  expect(mock.play).not.toHaveBeenCalled();
  now = START + 10 * MIN;
  utils.rerender({ r: run(), time: now });
  expect(mock.play).toHaveBeenCalledExactlyOnceWith(LEVEL.zero);
});

test('muting/ending via React replaces an already pending background schedule', async () => {
  const utils = await renderNative();
  await act(async () => { mock.events.get('appStateChange')({ isActive: false }); });
  await waitFor(() => expect(mock.pending.size).toBe(3));
  utils.rerender({ r: null, time: now });
  await waitFor(() => expect(mock.pending.size).toBe(0));
});

test('StrictMode cleans up asynchronous listeners without cancelling the current mount schedule', async () => {
  const utils = await renderNative(React.StrictMode);
  await act(async () => { mock.events.get('pause')(); });
  await waitFor(() => expect(mock.pending.size).toBe(3));
  expect(mock.events.size).toBe(3);
  utils.unmount();
  await waitFor(() => expect(mock.pending.size).toBe(0));
  expect(mock.handles.every(handle => handle.remove.mock.calls.length === 1)).toBe(true);
  expect(mock.events.size).toBe(0);
});
