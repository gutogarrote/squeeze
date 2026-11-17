import React from 'react';

if (!window.PointerEvent) {
  window.PointerEvent = class PointerEvent extends MouseEvent {
    constructor(type, init = {}) { super(type, init); this.pointerId = init.pointerId ?? 1; }
  };
}
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { vi } from 'vitest';
import App from './App';
import { LEVEL } from './lib/alerts';
import * as sound from './lib/sound';

vi.mock('./components/PwaUpdateNotice', () => ({ default: () => <p>pwa</p> }));

// The Android app: App receives the native bridge and the system plays the alerts.
const local = (h, m = 0) => new Date(2026, 10, 4, h, m).getTime();
const MIN = 60000;
let nowMs;
let native;
const clock = () => nowMs;
const advance = (ms) => { nowMs += ms; act(() => { vi.advanceTimersByTime(1000); }); };
const lastSync = () => native.sync.mock.calls.at(-1)[0].alerts;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
  localStorage.clear();
  window.history.replaceState(null, '', '/');
  nowMs = local(12, 20);
  native = {
    sync: vi.fn(() => Promise.resolve({ scheduled: 3 })),
    play: vi.fn(() => Promise.resolve({ played: true })),
    requestNotifications: vi.fn(() => Promise.resolve({ granted: true })),
  };
  vi.spyOn(sound, 'playSound');
  vi.spyOn(sound, 'primeSounds');
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

test('starting schedules the alarms of the current task and asks for notifications', () => {
  render(<App clock={clock} native={native} />);
  expect(lastSync()).toEqual([]);
  fireEvent.click(screen.getByRole('button', { name: 'Começar' }));
  expect(native.requestNotifications).toHaveBeenCalledOnce();
  expect(sound.primeSounds).not.toHaveBeenCalled();
  expect(lastSync().map((a) => [a.level, a.atMs, a.body])).toEqual([
    [LEVEL.five, local(13, 15), 'Orçamento'], [LEVEL.one, local(13, 19), 'Orçamento'], [LEVEL.zero, local(13, 20), 'Orçamento'],
  ]);
  expect(screen.queryByText('pwa')).not.toBeInTheDocument();
});

test('thresholds play through the system with the alarm key, never through Web Audio', () => {
  render(<App clock={clock} native={native} />);
  fireEvent.click(screen.getByRole('button', { name: 'Começar' }));
  const scheduled = lastSync();
  const syncs = native.sync.mock.calls.length;
  advance(55 * MIN);
  expect(native.play).toHaveBeenCalledOnce();
  expect(native.play.mock.calls[0][0].alert.key).toBe(scheduled[0].key);
  expect(sound.playSound).not.toHaveBeenCalled();
  expect(native.sync.mock.calls).toHaveLength(syncs);
});

test('more time, the next task, muting and ending all reschedule', () => {
  render(<App clock={clock} native={native} />);
  fireEvent.click(screen.getByRole('button', { name: 'Começar' }));
  advance(56 * MIN);
  fireEvent.click(screen.getByRole('button', { name: '+5 min' }));
  expect(lastSync().at(-1).atMs).toBe(local(13, 25));
  fireEvent.pointerDown(screen.getByRole('group', { name: 'Tarefa atual: Orçamento' }), { clientX: 10, clientY: 10, pointerId: 1, button: 0 });
  fireEvent.pointerUp(screen.getByRole('group', { name: 'Tarefa atual: Orçamento' }), { clientX: 10, clientY: 10, pointerId: 1 });
  fireEvent.click(screen.getByRole('button', { name: 'Concluir' }));
  expect(lastSync().every((a) => a.body === 'Guardar equipamentos')).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Ajustes' }));
  fireEvent.click(screen.getByRole('switch', { name: /Sons/ }));
  expect(lastSync()).toEqual([]);
  expect(screen.getByText(/mesmo com a tela apagada/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('switch', { name: /Sons/ }));
  expect(lastSync()).toHaveLength(3);
  fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
  fireEvent.click(screen.getByRole('button', { name: 'Encerrar' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Encerrar' }));
  expect(lastSync()).toEqual([]);
});
