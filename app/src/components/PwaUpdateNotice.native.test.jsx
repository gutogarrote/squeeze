import React from 'react';
import { render } from '@testing-library/react';
import { vi } from 'vitest';
import PwaUpdateNotice from './PwaUpdateNotice';
import { registerPwa } from '../pwa/registerPwa';

vi.mock('../native/platform', () => ({ isNative: true }));
vi.mock('../pwa/registerPwa', () => ({ registerPwa: vi.fn(() => () => {}) }));

test('the installed app never registers a PWA service worker', () => {
  vi.stubEnv('PROD', true);
  try {
    render(<PwaUpdateNotice editing={false} />);
    expect(registerPwa).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
  } finally { vi.unstubAllEnvs(); }
});
