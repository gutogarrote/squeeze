// Alert tones, synthesized with Web Audio (no audio files needed). Browsers only allow
// sound after a user gesture, so primeSounds() runs on the "Começar" tap.
import { TONES } from './alertTones.mjs';
import { LEVEL } from './alerts';

const LEVEL_TONES = { [LEVEL.five]: TONES.five, [LEVEL.one]: TONES.one, [LEVEL.zero]: TONES.zero };

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
  const tones = LEVEL_TONES[level];
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
      amp.gain.exponentialRampToValueAtTime(0.0001, t0 + start + duration);
      osc.connect(amp).connect(ctx.destination);
      osc.start(t0 + start);
      osc.stop(t0 + start + duration + 0.05);
    });
  } catch (_) { /* Playback is best effort. */ }
}
