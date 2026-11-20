import { useEffect, useRef, useState } from 'react';
import { haptic } from '../lib/native';

export const HOLD_MS = 300;
const SLOP_PX = 8;
const GAP_PX = 8;

// Long-press-and-drag reordering of the run list (specifications.md §5). The handle must be
// held still for HOLD_MS before the card lifts, so a stray touch or a scroll never moves a
// task. While dragging, the card follows the finger and the other pending cards make room;
// on release `onDrop(id, position)` gets the new position among `ids` (pending tasks, in order).
export default function useReorder({ container, ids, onDrop }) {
  const [drag, setDrag] = useState(null); // { id, dy, from, target, size }
  const press = useRef(null);
  const latest = useRef({ ids, onDrop });
  latest.current = { ids, onDrop };

  useEffect(() => () => clearTimeout(press.current?.timer), []);

  const boxes = () => {
    const items = [...(container.current?.querySelectorAll('[data-motion-id]') || [])];
    return latest.current.ids.map((id) => {
      const item = items.find((node) => node.dataset.motionId === id);
      const rect = item?.getBoundingClientRect();
      return { id, top: rect?.top ?? 0, height: rect?.height ?? 0 };
    });
  };

  function lift() {
    const p = press.current;
    if (!p) return;
    const list = boxes();
    const from = list.findIndex((box) => box.id === p.id);
    if (from < 0) { press.current = null; return; }
    p.lifted = true;
    p.list = list;
    haptic(15);
    setDrag({ id: p.id, dy: 0, from, target: from, size: list[from].height + GAP_PX });
  }

  function targetFor(p, dy) {
    const from = p.list.findIndex((box) => box.id === p.id);
    const self = p.list[from];
    const center = self.top + dy + self.height / 2;
    return p.list.filter((box, k) => k !== from && box.top + box.height / 2 < center).length;
  }

  const handleProps = (id) => ({
    onPointerDown(e) {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch (_) {}
      clearTimeout(press.current?.timer);
      press.current = { id, y: e.clientY, x: e.clientX, pointerId: e.pointerId, lifted: false, timer: setTimeout(lift, HOLD_MS) };
    },
    onPointerMove(e) {
      const p = press.current;
      if (!p || p.pointerId !== e.pointerId) return;
      const dy = e.clientY - p.y;
      if (!p.lifted) {
        // Moving before the hold ends is not a drag.
        if (Math.abs(dy) > SLOP_PX || Math.abs(e.clientX - p.x) > SLOP_PX) { clearTimeout(p.timer); press.current = null; }
        return;
      }
      const target = targetFor(p, dy);
      setDrag((d) => (d ? { ...d, dy, target } : d));
    },
    onPointerUp(e) {
      const p = press.current;
      if (!p || p.pointerId !== e.pointerId) return;
      clearTimeout(p.timer);
      press.current = null;
      if (!p.lifted) return;
      const target = targetFor(p, e.clientY - p.y);
      const from = p.list.findIndex((box) => box.id === p.id);
      setDrag(null);
      if (target !== from) latest.current.onDrop(p.id, target);
    },
    onPointerCancel() {
      clearTimeout(press.current?.timer);
      press.current = null;
      setDrag(null);
    },
    onContextMenu(e) { e.preventDefault(); },
    // Keyboard alternative: arrows move one place.
    onKeyDown(e) {
      const k = latest.current.ids.indexOf(id);
      const by = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
      if (!by || k < 0 || k + by < 0 || k + by >= latest.current.ids.length) return;
      e.preventDefault();
      latest.current.onDrop(id, k + by);
    },
  });

  // Style for each list item while dragging.
  const itemStyle = (id) => {
    if (!drag) return undefined;
    if (id === drag.id) {
      return { transform: `translateY(${drag.dy}px) scale(1.02)`, zIndex: 20, transition: 'none', position: 'relative' };
    }
    const k = ids.indexOf(id);
    if (k < 0) return undefined;
    let shift = 0;
    if (k > drag.from && k <= drag.target) shift = -drag.size;
    else if (k < drag.from && k >= drag.target) shift = drag.size;
    return { transform: shift ? `translateY(${shift}px)` : undefined, transition: 'transform 160ms ease-out' };
  };

  return { drag, handleProps, itemStyle };
}
