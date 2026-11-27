import { renderHook } from '@testing-library/react';
import { vi } from 'vitest';
import useNativeAlerts from './useNativeAlerts';
import { LEVEL } from '../lib/alerts';

const M = 60000;
const view = (remainingMs, id = 'a') => ({ current: { id, name: 'Banho', remainingMs }, currentSinceMs: 0 });
// The three thresholds of a plan, without the 5-minute ticks.
const thresholds = (alerts) => alerts.filter((a) => a.level !== LEVEL.tick);
const makeBridge = () => ({ sync: vi.fn(() => Promise.resolve()), play: vi.fn(() => Promise.resolve()) });

test('schedules once per change of the current task, not on every tick', () => {
  const bridge = makeBridge();
  const { rerender } = renderHook(({ v, now, enabled }) => useNativeAlerts(v, now, { enabled, bridge }), {
    initialProps: { v: view(20 * M), now: 0, enabled: true },
  });
  expect(bridge.sync).toHaveBeenCalledOnce();
  expect(thresholds(bridge.sync.mock.calls[0][0].alerts).map((a) => a.atMs)).toEqual([15 * M, 19 * M, 20 * M]);
  rerender({ v: view(19 * M), now: M, enabled: true });
  expect(bridge.sync).toHaveBeenCalledOnce();
  rerender({ v: view(24 * M), now: M, enabled: true });
  expect(bridge.sync).toHaveBeenCalledTimes(2);
  expect(thresholds(bridge.sync.mock.calls[1][0].alerts).at(-1).atMs).toBe(25 * M);
});

test('muting or ending the routine cancels the alarms', () => {
  const bridge = makeBridge();
  const { rerender } = renderHook(({ v, enabled }) => useNativeAlerts(v, 0, { enabled, bridge }), {
    initialProps: { v: view(20 * M), enabled: true },
  });
  rerender({ v: view(20 * M), enabled: false });
  expect(bridge.sync).toHaveBeenLastCalledWith({ alerts: [] });
  rerender({ v: view(20 * M), enabled: true });
  expect(thresholds(bridge.sync.mock.calls.at(-1)[0].alerts)).toHaveLength(3);
  rerender({ v: null, enabled: true });
  expect(bridge.sync).toHaveBeenLastCalledWith({ alerts: [] });
});

test('play sends the alert with the key its alarm uses, so only one of them sounds', () => {
  const bridge = makeBridge();
  const { result } = renderHook(() => useNativeAlerts(view(30000), 0, { enabled: true, bridge }));
  result.current(LEVEL.one);
  const scheduled = bridge.sync.mock.calls[0][0].alerts.find((a) => a.level === LEVEL.one);
  expect(bridge.play).toHaveBeenCalledWith({ alert: scheduled });
});

test('without a bridge it stays out of the way, and a failing bridge is harmless', () => {
  expect(renderHook(() => useNativeAlerts(view(M), 0, { enabled: true, bridge: null })).result.current).toBeUndefined();
  const bridge = { sync: vi.fn(() => Promise.reject(new Error('gone'))), play: vi.fn(() => Promise.reject(new Error('gone'))) };
  const { result } = renderHook(() => useNativeAlerts(view(M), 0, { enabled: true, bridge }));
  expect(() => result.current(LEVEL.one)).not.toThrow();
});
