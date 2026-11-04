import { formatClock, formatCountdown, formatMinutes, isClock, nextOccurrence } from './clock';

const local = (day, h, m = 0) => new Date(2026, 10, day, h, m).getTime();

describe('nextOccurrence', () => {
  test('a time later today is today', () => {
    expect(nextOccurrence('15:00', local(4, 12))).toBe(local(4, 15));
  });
  test('a time that already passed today is tomorrow', () => {
    expect(nextOccurrence('01:00', local(4, 23))).toBe(local(5, 1));
    expect(nextOccurrence('10:00', local(4, 14))).toBe(local(5, 10));
  });
  test('after midnight, early times are still today', () => {
    expect(nextOccurrence('02:00', local(5, 0, 30))).toBe(local(5, 2));
  });
  test('invalid clocks give NaN', () => {
    expect(nextOccurrence('25:00', local(4, 12))).toBeNaN();
    expect(isClock('9:00')).toBe(false);
    expect(isClock('09:00')).toBe(true);
  });
});

describe('formats', () => {
  test('clock', () => {
    expect(formatClock(local(4, 12, 35))).toBe('12:35');
  });
  test('countdown, including negative delay', () => {
    expect(formatCountdown(5 * 60000)).toBe('5:00');
    expect(formatCountdown(4 * 60000 + 59500)).toBe('5:00');
    expect(formatCountdown(3723000)).toBe('1:02:03');
    expect(formatCountdown(-(5 * 60 + 20) * 1000)).toBe('-5:20');
    expect(formatCountdown(-10 * 60000 - 3000)).toBe('-10:03');
    expect(formatCountdown(-400)).toBe('0:00');
  });
  test('minutes', () => {
    expect(formatMinutes(45 * 60000)).toBe('45 min');
    expect(formatMinutes(60 * 60000)).toBe('1h');
    expect(formatMinutes(65 * 60000)).toBe('1h 05');
    expect(formatMinutes(-5 * 60000)).toBe('-5 min');
    expect(formatMinutes(0)).toBe('0 min');
  });
});
