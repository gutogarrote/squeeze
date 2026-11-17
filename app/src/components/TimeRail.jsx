import React, { useEffect, useLayoutEffect, useState } from 'react';
import { formatClock } from '../lib/clock';
import { placeLabels, railRange, railTicks, railY } from '../lib/timeRail';

export const RAIL_WIDTH = 64;
const PAD = 7;
const LABEL_X = 11;
const LINK_X = 43;
const EDGE_X = RAIL_WIDTH - 2;

// Where each card really is: the list item's place and its swipeable body's height.
function measure(root) {
  const boxes = {};
  root.querySelectorAll('[data-motion-id]').forEach((item) => {
    const body = item.querySelector('[data-swipe-body]') || item;
    boxes[item.dataset.motionId] = { top: item.offsetTop, height: body.offsetHeight };
  });
  return { boxes, height: root.offsetHeight, width: root.offsetWidth };
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const link = (yRail, yCard) => `M${LINK_X},${yRail} C${LINK_X + 10},${yRail} ${EDGE_X - 10},${yCard} ${EDGE_X},${yCard}`;

// Clock ruler beside the task list (specifications.md §12). The ruler is linear in time; the
// cards are not, so a line joins each card edge to its time on the ruler. The present is a
// dashed red line across the current card, joined to the ruler the same way. Decorative for
// assistive technology: every card already states its times.
export default function TimeRail({ container, spans, now, currentId, nowFraction }) {
  const [layout, setLayout] = useState(null);

  // On mount the list's ref is attached only after this component's layout effect: render once more.
  const [, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Card heights change with time and animate, so measure after every render and on resize.
  useLayoutEffect(() => {
    const root = container.current;
    if (!root) return undefined;
    const update = () => setLayout((previous) => { const next = measure(root); return same(previous, next) ? previous : next; });
    update();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(update);
    observer.observe(root);
    return () => observer.disconnect();
  });

  const range = railRange(spans);
  if (!layout || !range || layout.height <= 2 * PAD) return null;
  const y = (ms) => railY(ms, range, layout.height, PAD);
  const edges = [];
  spans.forEach((span) => {
    const box = layout.boxes[span.id];
    if (!box) return;
    edges.push({ ms: span.startMs, card: box.top }, { ms: span.endMs, card: box.top + box.height });
  });
  const currentBox = currentId ? layout.boxes[currentId] : null;
  const present = currentBox && nowFraction !== null
    ? { rail: y(now), card: currentBox.top + Math.min(currentBox.height - 2, Math.max(2, nowFraction * currentBox.height)) }
    : null;
  const times = [...new Set(edges.map((edge) => edge.ms))].sort((a, b) => a - b);
  const labels = placeLabels([
    ...(present ? [{ y: present.rail, ms: now, present: true }] : []),
    ...times.map((ms) => ({ y: y(ms), ms })),
  ]);

  return (
    <svg aria-hidden="true" data-testid="time-rail" width={layout.width} height={layout.height}
      className="pointer-events-none absolute left-0 top-0 z-10 overflow-visible">
      {railTicks(range, layout.height - 2 * PAD).map((ms) => (
        <line key={`t${ms}`} x1="0" x2="4" y1={y(ms)} y2={y(ms)} className="stroke-zinc-700" strokeWidth="1" />
      ))}
      {times.map((ms) => (
        <line key={`b${ms}`} x1="0" x2="8" y1={y(ms)} y2={y(ms)} className="stroke-zinc-400" strokeWidth="1.5" />
      ))}
      {edges.map((edge, i) => (
        <path key={i} d={link(y(edge.ms), edge.card)} fill="none" className="stroke-zinc-500" strokeWidth="1" />
      ))}
      {labels.filter((label) => !label.present).map((label) => (
        <text key={`l${label.ms}`} x={LABEL_X} y={label.y} dominantBaseline="middle" fontSize="10"
          className="fill-zinc-400 tabular-nums">{formatClock(label.ms)}</text>
      ))}
      {present && (
        <g data-testid="time-rail-now">
          <line x1="0" x2="8" y1={present.rail} y2={present.rail} className="stroke-rose-400" strokeWidth="2" />
          <text x={LABEL_X} y={present.rail} dominantBaseline="middle" fontSize="10" fontWeight="700"
            className="fill-rose-400 tabular-nums">{formatClock(now)}</text>
          <path d={link(present.rail, present.card)} fill="none"
            className="stroke-rose-400" strokeWidth="1.5" strokeDasharray="5 4" strokeLinecap="round" />
          {/* Fainter over the card, so the countdown underneath stays readable. */}
          <line x1={EDGE_X} x2={layout.width} y1={present.card} y2={present.card} opacity="0.55"
            className="stroke-rose-400" strokeWidth="1.5" strokeDasharray="5 4" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}
