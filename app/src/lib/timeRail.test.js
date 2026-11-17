import { placeLabels, railRange, railSpans, railTicks, railY } from './timeRail';

const M = 60000;
const at = (h, m = 0) => new Date(2026, 10, 4, h, m).getTime();
const done = (id, consumedMin) => ({ id, status: 'done', consumedMs: consumedMin * M, remainingMs: 0 });
const pending = (id, remainingMin, extra = {}) => ({ id, status: 'pending', consumedMs: 0, remainingMs: remainingMin * M, ...extra });
const minutes = (spans) => spans.map((s) => [s.id, (s.startMs - at(11, 34)) / M, (s.endMs - at(11, 34)) / M]);

test('done tasks stack back from the current one and the next ones are projected forwards', () => {
  const view = {
    bufferMs: 5 * M,
    tasks: [done('a', 10), done('b', 3), pending('c', 6, { isCurrent: true, consumedMs: 4 * M }), pending('d', 45), pending('e', 2)],
  };
  const { spans, currentId, nowFraction } = railSpans(view, at(11, 34));
  expect(minutes(spans)).toEqual([['a', -17, -7], ['b', -7, -4], ['c', -4, 6], ['d', 6, 51], ['e', 51, 53], ['buffer', 53, 58]]);
  expect(currentId).toBe('c');
  expect(nowFraction).toBeCloseTo(0.4);
  // Consecutive spans share their boundary.
  spans.slice(1).forEach((s, i) => expect(s.startMs).toBe(spans[i].endMs));
});

test('an overdue current task ends now; a task completed ahead of its turn takes no time there', () => {
  const view = {
    bufferMs: 0,
    tasks: [pending('c', -3, { isCurrent: true, consumedMs: 13 * M }), done('x', 0), pending('d', 20)],
  };
  const { spans, nowFraction } = railSpans(view, at(11, 34));
  expect(minutes(spans)).toEqual([['c', -13, 0], ['x', 0, 0], ['d', 0, 20]]);
  expect(nowFraction).toBe(1);
});

test('with everything done the spans end now and free time follows', () => {
  const { spans, currentId, nowFraction } = railSpans({ bufferMs: 30 * M, tasks: [done('a', 10), done('b', 5)] }, at(11, 34));
  expect(minutes(spans)).toEqual([['a', -15, -5], ['b', -5, 0], ['buffer', 0, 30]]);
  expect(currentId).toBeNull();
  expect(nowFraction).toBeNull();
  expect(railSpans(null, 0).spans).toEqual([]);
});

test('the ruler is linear between the first start and the last end', () => {
  const range = railRange([{ startMs: at(11, 30), endMs: at(11, 40) }, { startMs: at(11, 40), endMs: at(12, 30) }]);
  expect(range).toEqual({ startMs: at(11, 30), endMs: at(12, 30) });
  expect(railY(at(11, 30), range, 600)).toBe(0);
  expect(railY(at(12, 0), range, 600)).toBe(300);
  expect(railY(at(12, 30), range, 600, 10)).toBe(590);
  expect(railRange([])).toBeNull();
  expect(railRange([{ startMs: 5, endMs: 5 }])).toBeNull();
});

test('ticks fall on round clock times, with a step that keeps them apart', () => {
  const range = { startMs: at(11, 34), endMs: at(12, 32) };
  const clock = (t) => `${new Date(t).getHours()}:${String(new Date(t).getMinutes()).padStart(2, '0')}`;
  expect(railTicks(range, 600).slice(0, 3).map(clock)).toEqual(['11:34', '11:35', '11:36']);
  expect(railTicks(range, 600)).toHaveLength(59);
  expect(railTicks(range, 200).map(clock)).toEqual(['11:35', '11:40', '11:45', '11:50', '11:55', '12:00', '12:05', '12:10', '12:15', '12:20', '12:25', '12:30']);
  expect(railTicks(range, 40).map(clock)).toEqual(['11:45', '12:00', '12:15', '12:30']);
  // Half-hour time zones still get round local times.
  const utc = (h, m) => Date.UTC(2026, 10, 4, h, m);
  expect(railTicks({ startMs: utc(6, 0), endMs: utc(8, 0) }, 20, { offsetMin: -330 }).map((t) => new Date(t).getUTCMinutes())).toEqual([30, 30]);
  expect(railTicks({ startMs: 0, endMs: 1000 * 240 * M }, 10, { offsetMin: 0, limit: 5 })).toHaveLength(5);
});

test('labels that would overlap give way to the ones listed first', () => {
  const kept = placeLabels([{ y: 100, id: 'now' }, { y: 95, id: 'a' }, { y: 112, id: 'b' }, { y: 120, id: 'c' }, { y: 40, id: 'd' }]);
  expect(kept.map((p) => p.id)).toEqual(['now', 'b', 'd']);
});
