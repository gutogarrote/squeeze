import { vi } from 'vitest';
import { LEVEL } from './alerts';

let ctx;
let oscillators;
let envelopes;

beforeEach(() => {
  vi.resetModules();
  oscillators = [];
  envelopes = [];
  ctx = {
    currentTime: 10,
    destination: {},
    resume: vi.fn(() => Promise.resolve()),
    createOscillator: vi.fn(() => {
      const osc = { frequency: {}, connect: vi.fn((amp) => amp), start: vi.fn(), stop: vi.fn() };
      oscillators.push(osc);
      return osc;
    }),
    createGain: vi.fn(() => {
      const amp = { gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() };
      envelopes.push(amp);
      return amp;
    }),
  };
  vi.stubGlobal('AudioContext', class { constructor() { return ctx; } });
});

afterEach(() => { vi.unstubAllGlobals(); });

test('alerts grow in volume, length and repetition as the deadline approaches', async () => {
  const { playSound } = await import('./sound');
  const bursts = [LEVEL.five, LEVEL.one, LEVEL.zero].map((level) => {
    oscillators.length = 0;
    envelopes.length = 0;
    playSound(level);
    return {
      count: oscillators.length,
      duration: oscillators.at(-1).stop.mock.calls[0][0] - oscillators[0].start.mock.calls[0][0],
      peak: Math.max(...envelopes.map((amp) => amp.gain.exponentialRampToValueAtTime.mock.calls[0][0])),
    };
  });
  expect(bursts[0].count).toBeGreaterThanOrEqual(2);
  expect(bursts[0].duration).toBeGreaterThan(0.8);
  expect(bursts[0].peak).toBeGreaterThanOrEqual(0.25);
  for (let i = 1; i < bursts.length; i += 1) {
    expect(bursts[i].count).toBeGreaterThan(bursts[i - 1].count);
    expect(bursts[i].duration).toBeGreaterThan(bursts[i - 1].duration);
    expect(bursts[i].peak).toBeGreaterThan(bursts[i - 1].peak);
    expect(bursts[i].peak).toBeLessThan(0.5);
  }
});

test('tones sustain their full volume before fading and stop their oscillators', async () => {
  const { playSound } = await import('./sound');
  playSound(LEVEL.zero);
  envelopes.forEach((amp, i) => {
    const [attack, release] = amp.gain.exponentialRampToValueAtTime.mock.calls;
    const sustain = amp.gain.setValueAtTime.mock.calls[1];
    expect(sustain[0]).toBe(attack[0]);
    expect(sustain[1] - attack[1]).toBeGreaterThan(0.15);
    expect(release[0]).toBeLessThan(0.001);
    expect(release[1]).toBeGreaterThan(sustain[1]);
    expect(oscillators[i].stop.mock.calls[0][0]).toBeGreaterThan(release[1]);
    expect(amp.connect).toHaveBeenCalledWith(ctx.destination);
  });
});

test('audio is primed on a user gesture and unavailable audio stays harmless', async () => {
  const { primeSounds, playSound } = await import('./sound');
  primeSounds();
  expect(ctx.resume).toHaveBeenCalledOnce();
  expect(oscillators).toHaveLength(0);
  ctx.createOscillator.mockImplementation(() => { throw new Error('Audio unavailable'); });
  expect(() => playSound(LEVEL.zero)).not.toThrow();
  expect(() => playSound(LEVEL.none)).not.toThrow();
});

test('browsers without Web Audio can still start routines', async () => {
  vi.stubGlobal('AudioContext', undefined);
  vi.stubGlobal('webkitAudioContext', undefined);
  const { primeSounds, playSound } = await import('./sound');
  expect(() => primeSounds()).not.toThrow();
  expect(() => playSound(LEVEL.zero)).not.toThrow();
});
