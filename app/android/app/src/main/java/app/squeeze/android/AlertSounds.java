package app.squeeze.android;

import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioTrack;
import org.json.JSONArray;

/**
 * Synthesizes the alert tones natively, with the same recipe as lib/sound.js:
 * each tone is [frequency Hz, start s, duration s, gain, wave]. Played on the alarm stream,
 * so it sounds with the screen off and the media volume down.
 */
final class AlertSounds {

    private static final int RATE = 44100;

    private AlertSounds() {}

    static short[] render(JSONArray tones) {
        double total = 0;
        for (int i = 0; i < tones.length(); i++) {
            JSONArray tone = tones.optJSONArray(i);
            if (tone != null) total = Math.max(total, tone.optDouble(1, 0) + tone.optDouble(2, 0));
        }
        int length = (int) Math.ceil((Math.min(total, 10) + 0.05) * RATE);
        float[] mix = new float[length];
        for (int i = 0; i < tones.length(); i++) {
            JSONArray tone = tones.optJSONArray(i);
            if (tone == null) continue;
            double frequency = tone.optDouble(0, 880);
            double start = tone.optDouble(1, 0);
            double duration = tone.optDouble(2, 0.3);
            double gain = Math.min(1, Math.max(0, tone.optDouble(3, 0.3)));
            String wave = tone.optString(4, "square");
            int first = (int) (start * RATE);
            int count = (int) (duration * RATE);
            for (int n = 0; n < count && first + n < length; n++) {
                double t = n / (double) RATE;
                double phase = (t * frequency) % 1.0;
                double sample;
                if ("triangle".equals(wave)) sample = 1 - 4 * Math.abs(phase - 0.5);
                else if ("sine".equals(wave)) sample = Math.sin(2 * Math.PI * phase);
                else sample = phase < 0.5 ? 1 : -1;
                mix[first + n] += (float) (sample * gain * envelope(t, duration));
            }
        }
        short[] pcm = new short[length];
        for (int i = 0; i < length; i++) {
            float v = Math.max(-1f, Math.min(1f, mix[i]));
            pcm[i] = (short) (v * 32767);
        }
        return pcm;
    }

    // Fast attack, full-strength hold, short exponential release.
    private static double envelope(double t, double duration) {
        final double attack = 0.02;
        final double release = 0.08;
        final double floor = 0.0001;
        if (t < attack) return floor * Math.pow(1 / floor, t / attack);
        if (t <= duration - release) return 1;
        double x = Math.min(1, (t - (duration - release)) / release);
        return Math.pow(floor, x);
    }

    /** Blocks until the sound ends. Call it off the main thread. */
    static void play(JSONArray tones) {
        short[] pcm = render(tones);
        if (pcm.length == 0) return;
        AudioTrack track = null;
        try {
            track = new AudioTrack.Builder()
                .setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build())
                .setAudioFormat(new AudioFormat.Builder()
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setSampleRate(RATE)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                    .build())
                .setTransferMode(AudioTrack.MODE_STATIC)
                .setBufferSizeInBytes(pcm.length * 2)
                .build();
            track.write(pcm, 0, pcm.length);
            track.play();
            Thread.sleep(pcm.length * 1000L / RATE + 150);
        } catch (Exception ignored) {
            // Playback is best effort.
        } finally {
            if (track != null) {
                try { track.release(); } catch (Exception ignored) {}
            }
        }
    }
}
