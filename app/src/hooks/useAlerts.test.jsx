import { renderHook } from '@testing-library/react';
import { vi } from 'vitest';
import useAlerts from './useAlerts';
import { LEVEL } from '../lib/alerts';

const M = 60000;
const view = (id, remainingMs, since = 0) => ({ current: { id, remainingMs }, currentSinceMs: since });

test('plays thresholds as they are reached, not what already happened when the app opened', () => {
  const play = vi.fn();
  const onAlert = vi.fn();
  const { rerender } = renderHook(({ v, enabled }) => useAlerts(v, { enabled, onAlert, play }), {
    initialProps: { v: view('a', 3 * M), enabled: true },
  });
  expect(play).not.toHaveBeenCalled();
  rerender({ v: view('a', 59000), enabled: true });
  expect(play).toHaveBeenLastCalledWith(LEVEL.one);
  rerender({ v: view('b', -M, 10), enabled: true });
  expect(play).toHaveBeenLastCalledWith(LEVEL.zero);
  expect(onAlert).toHaveBeenCalledTimes(2);
});

test('with sounds off nothing plays, but the rest screen still wakes', () => {
  const play = vi.fn();
  const onAlert = vi.fn();
  const { rerender } = renderHook(({ v }) => useAlerts(v, { enabled: false, onAlert, play }), {
    initialProps: { v: view('a', 10 * M) },
  });
  rerender({ v: view('a', 5 * M) });
  expect(play).not.toHaveBeenCalled();
  expect(onAlert).toHaveBeenCalledWith(LEVEL.five);
});
