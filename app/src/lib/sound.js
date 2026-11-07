// Alert tones, synthesized with Web Audio (no audio files needed). Browsers only allow
// sound after a user gesture, so primeSounds() runs on the "Começar" tap.
import { LEVEL } from './alerts';

// [frequency Hz, start s, duration s, gain, wave]
const TONES = {
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

export function playSound(level) {
  const ctx = audioContext();
  const tones = TONES[level];
  if (!ctx || !tones) return;
  try {
    ctx.resume?.()?.catch?.(() => {});
    const t0 = ctx.currentTime + 0.02;
    tones.forEach(([frequency, start, duration, gain, type]) => {
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.type = type;
      osc.frequency.value = frequency;
      amp.gain.setValueAtTime(0.0001, t0 + start);
      amp.gain.exponentialRampToValueAtTime(gain, t0 + start + 0.02);
      // Hold the tone at full strength before releasing it; a long decay made alerts faint.
      amp.gain.setValueAtTime(gain, t0 + start + duration - 0.08);
      amp.gain.exponentialRampToValueAtTime(0.0001, t0 + start + duration);
      osc.connect(amp).connect(ctx.destination);
      osc.start(t0 + start);
      osc.stop(t0 + start + duration + 0.05);
    });
  } catch (_) { /* Playback is best effort. */ }
}
