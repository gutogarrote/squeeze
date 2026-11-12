import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import SettingsSheet from './SettingsSheet';

const wakeLock = { message: 'Desativado', enabled: false, toggle: () => {} };
const props = { settings: { sound: true, restAfterMin: 2 }, wakeLock, onClose: () => {}, onChange: () => {} };

test('native settings show denied permission and offer an explicit retry', () => {
  const requestPermission = vi.fn();
  render(<SettingsSheet {...props} nativeAlerts={{ permission: 'denied', error: '', requestPermission }} />);
  expect(screen.getByRole('status')).toHaveTextContent('Notificações bloqueadas');
  expect(screen.getByRole('status')).toHaveTextContent('economia de bateria');
  fireEvent.click(screen.getByRole('button', { name: 'Verificar permissão' }));
  expect(requestPermission).toHaveBeenCalledOnce();
});

test('native errors can be retried even when notifications were granted', () => {
  const requestPermission = vi.fn();
  render(<SettingsSheet {...props} nativeAlerts={{ permission: 'granted', error: 'Falha ao preparar alertas.', requestPermission }} />);
  expect(screen.getByRole('status')).toHaveTextContent('Falha ao preparar alertas.');
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  expect(requestPermission).toHaveBeenCalledOnce();
});

test('web settings retain the screen-on instructions', () => {
  render(<SettingsSheet {...props} />);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.getByText(/Com a tela acesa/)).toBeInTheDocument();
});
