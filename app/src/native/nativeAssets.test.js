import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TONES } from '../lib/alertTones.mjs';
import { toneWav, writeNativeSounds } from '../../scripts/native-assets.mjs';

test('native sounds are audible, distinct mono PCM WAVs below the iOS 30-second limit', () => {
  const sounds = Object.values(TONES).map(toneWav);
  for (const wav of sounds) {
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
    expect(wav.toString('ascii', 8, 16)).toBe('WAVEfmt ');
    expect(wav.readUInt16LE(20)).toBe(1);
    expect(wav.readUInt16LE(22)).toBe(1);
    expect(wav.readUInt16LE(34)).toBe(16);
    expect(wav.readUInt32LE(4)).toBe(wav.length - 8);
    expect(wav.readUInt32LE(40) / wav.readUInt32LE(28)).toBeLessThan(30);
    const samples = Array.from({ length: (wav.length - 44) / 2 }, (_, i) => wav.readInt16LE(44 + 2 * i));
    expect(Math.max(...samples.map(Math.abs))).toBeGreaterThan(1000);
  }
  expect(new Set(sounds.map(wav => wav.toString('base64'))).size).toBe(3);
});

test('sync generates identical sound resources for both platforms', async () => {
  const root = await mkdtemp(join(tmpdir(), 'squeeze-sounds-'));
  try {
    await writeNativeSounds(root);
    for (const name of ['five', 'one', 'zero']) {
      const android = await readFile(join(root, `android/app/src/main/res/raw/squeeze_${name}.wav`));
      const ios = await readFile(join(root, `ios/App/App/squeeze_${name}.wav`));
      expect(android.equals(ios)).toBe(true);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
