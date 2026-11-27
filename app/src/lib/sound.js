// Alert and feedback tones, synthesized with Web Audio (no audio files needed). Browsers only
// allow sound after a user gesture, so primeSounds() runs on the "Começar" tap. The Android
// app plays the alerts natively from the same recipes (lib/nativeAlerts.js).
import { LEVEL } from './alerts';

// [frequency Hz, start s, duration s, gain, wave]
// Urgent alerts: bright and insistent, for when time is running out.
export const TONES = {
  [LEVEL.five]: [[740, 0, 0.3, 0.3, 'triangle'], [988, 0.42, 0.4, 0.3, 'triangle']],
  [LEVEL.one]: [
    [880, 0, 0.26, 0.36, 'square'], [1046, 0.4, 0.26, 0.36, 'square'],
    [880, 0.8, 0.4, 0.36, 'square'],
  ],
  [LEVEL.zero]: [
    [988, 0, 0.28, 0.44, 'square'], [784, 0.38, 0.28, 0.44, 'square'],
    [988, 0.76, 0.28, 0.44, 'square'], [784, 1.14, 0.28, 0.44, 'square'],
    [988, 1.52, 0.28, 0.44, 'square'], [784, 1.9, 0.6, 0.44, 'square'],
  ],
  // Soft and short: the task is still running past its time.
  [LEVEL.reminder]: [[659, 0, 0.16, 0.2, 'sine'], [880, 0.2, 0.3, 0.18, 'sine']],
  // Every 5 minutes left: two light taps.
  [LEVEL.tick]: [[740, 0, 0.14, 0.2, 'triangle'], [740, 0.24, 0.18, 0.2, 'triangle']],
};

// Soft alerts: gentle sine chimes that mark the passage of time without alarm.
export const SOFT_TONES = {
  [LEVEL.five]: [[523, 0, 0.4, 0.14, 'sine'], [659, 0.45, 0.55, 0.14, 'sine']],
  [LEVEL.one]: [[587, 0, 0.35, 0.15, 'sine'], [740, 0.4, 0.35, 0.15, 'sine'], [880, 0.8, 0.6, 0.14, 'sine']],
  [LEVEL.zero]: [[784, 0, 0.45, 0.17, 'sine'], [659, 0.5, 0.45, 0.17, 'sine'], [523, 1, 0.9, 0.16, 'sine']],
  [LEVEL.reminder]: [[659, 0, 0.35, 0.11, 'sine']],
  [LEVEL.tick]: [[880, 0, 0.6, 0.09, 'sine']],
};

export const tonesFor = (level, style = 'urgent') => (style === 'soft' ? SOFT_TONES : TONES)[level];

// Short answers to the user's own actions, quieter than any alert.
export const FEEDBACK = {
  // A small win: a bright two-note "coin".
  done: [[988, 0, 0.08, 0.12, 'square'], [1319, 0.08, 0.32, 0.12, 'square']],
  // A swap: three notes going down.
  postpone: [[784, 0, 0.09, 0.15, 'triangle'], [622, 0.09, 0.09, 0.15, 'triangle'], [494, 0.18, 0.18, 0.13, 'triangle']],
  // The routine is done: a rising arpeggio that lands on a chord, with a sparkle on top.
  finish: [
    [523, 0, 0.12, 0.13, 'triangle'], [659, 0.12, 0.12, 0.13, 'triangle'], [784, 0.24, 0.12, 0.13, 'triangle'],
    [1047, 0.36, 0.7, 0.12, 'triangle'], [784, 0.36, 0.7, 0.07, 'triangle'], [659, 0.36, 0.7, 0.06, 'triangle'],
    [1568, 0.5, 0.18, 0.05, 'sine'], [2093, 0.64, 0.3, 0.04, 'sine'],
  ],
};

let context = null;

function audioContext() {
  if (context) return context;
  const Ctx = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!Ctx) return null;
  try { context = new Ctx(); } catch (_) { context = null; }
  return context;
}

export function primeSounds() {
  const ctx = audioContext();
  try { ctx?.resume?.()?.catch?.(() => {}); } catch (_) {}
}

function playTones(tones) {
  const ctx = audioContext();
  if (!ctx || !tones) return;
  try {
    ctx.resume?.()?.catch?.(() => {});
    const t0 = ctx.currentTime + 0.02;
    tones.forEach(([frequency, start, duration, gain, type]) => {
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      const attack = Math.min(0.02, duration / 4);
      const release = Math.min(0.08, duration / 3);
      osc.type = type;
      osc.frequency.value = frequency;
      amp.gain.setValueAtTime(0.0001, t0 + start);
      amp.gain.exponentialRampToValueAtTime(gain, t0 + start + attack);
      // Hold the tone at full strength before releasing it; a long decay made alerts faint.
      amp.gain.setValueAtTime(gain, t0 + start + duration - release);
      amp.gain.exponentialRampToValueAtTime(0.0001, t0 + start + duration);
      osc.connect(amp).connect(ctx.destination);
      osc.start(t0 + start);
      osc.stop(t0 + start + duration + 0.05);
    });
  } catch (_) { /* Playback is best effort. */ }
}

export const playSound = (level, style = 'urgent') => playTones(tonesFor(level, style));
export const playFeedback = (name) => playTones(FEEDBACK[name]);
