// [frequency Hz, start s, duration s, gain, wave]. Shared by Web Audio and the
// native WAV generator so the three notifications keep Squeeze's existing sounds.
export const TONES = {
  five: [[660, 0, 0.35, 0.18, 'sine']],
  one: [[880, 0, 0.18, 0.25, 'triangle'], [880, 0.28, 0.18, 0.25, 'triangle']],
  zero: [
    [988, 0, 0.16, 0.35, 'square'], [784, 0.2, 0.16, 0.35, 'square'],
    [988, 0.4, 0.16, 0.35, 'square'], [784, 0.6, 0.3, 0.35, 'square'],
  ],
};
