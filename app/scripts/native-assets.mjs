import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { TONES } from '../src/lib/alertTones.mjs';

const RATE = 44100;

export function toneWav(tones) {
  const duration = Math.max(...tones.map(([, start, length]) => start + length)) + 0.1;
  const count = Math.ceil(duration * RATE);
  const bytes = Buffer.alloc(44 + count * 2);
  bytes.write('RIFF', 0);
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20); // PCM, mono, 16 bits.
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(RATE, 24);
  bytes.writeUInt32LE(RATE * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(count * 2, 40);
  for (let sample = 0; sample < count; sample++) {
    const time = sample / RATE;
    let value = 0;
    for (const [frequency, start, length, gain, wave] of tones) {
      const t = time - start;
      if (t < 0 || t >= length) continue;
      const phase = t * frequency * 2 * Math.PI;
      const waveValue = wave === 'square' ? Math.sign(Math.sin(phase))
        : wave === 'triangle' ? 2 / Math.PI * Math.asin(Math.sin(phase)) : Math.sin(phase);
      const envelope = t < 0.02 ? 0.0001 * Math.pow(gain / 0.0001, t / 0.02)
        : gain * Math.pow(0.0001 / gain, (t - 0.02) / (length - 0.02));
      value += waveValue * envelope;
    }
    bytes.writeInt16LE(Math.round(Math.max(-1, Math.min(1, value)) * 32767), 44 + sample * 2);
  }
  return bytes;
}

export async function writeNativeSounds(root) {
  const directories = ['android/app/src/main/res/raw', 'ios/App/App'];
  for (const directory of directories) {
    const target = resolve(root, directory);
    await mkdir(target, { recursive: true });
    for (const [name, tones] of Object.entries(TONES)) {
      await writeFile(resolve(target, `squeeze_${name}.wav`), toneWav(tones));
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await writeNativeSounds(fileURLToPath(new URL('..', import.meta.url)));
}
