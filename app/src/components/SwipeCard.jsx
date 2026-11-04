import React, { useRef, useState } from 'react';

const LOCK_PX = 8;

// A horizontally swipeable card. onSwipeLeft/onSwipeRight return true when the gesture did
// something; otherwise the card wobbles back ("balança e volta"). Vertical scrolling stays
// native (touch-action: pan-y). Taps (no movement) call onTap.
export default function SwipeCard({
  onSwipeLeft, onSwipeRight, leftHint, rightHint, onTap, className = '', style, children, label,
}) {
  const [dx, setDx] = useState(0);
  const [settling, setSettling] = useState(false);
  const [wobble, setWobble] = useState(false);
  const gesture = useRef(null);
  const ref = useRef(null);

  function onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    // Buttons and fields inside the card keep their own behavior.
    if (e.target.closest?.('button, input, select, a')) return;
    gesture.current = { x: e.clientX, y: e.clientY, id: e.pointerId, axis: null, moved: false, dx: 0 };
    setSettling(false);
  }

  function onPointerMove(e) {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    const mx = e.clientX - g.x;
    const my = e.clientY - g.y;
    if (!g.axis) {
      if (Math.abs(mx) > LOCK_PX && Math.abs(mx) > Math.abs(my)) {
        g.axis = 'x';
        try { ref.current?.setPointerCapture?.(e.pointerId); } catch (_) {}
      } else if (Math.abs(my) > LOCK_PX) g.axis = 'y';
    }
    if (Math.abs(mx) > LOCK_PX || Math.abs(my) > LOCK_PX) g.moved = true;
    if (g.axis === 'x') { g.dx = mx; setDx(mx); }
  }

  function finish(e) {
    const g = gesture.current;
    gesture.current = null;
    if (!g || (e && g.id !== e.pointerId)) return;
    const width = ref.current?.offsetWidth || 320;
    const threshold = Math.min(96, width * 0.28);
    let handled = null;
    if (g.axis === 'x' && g.dx <= -threshold) handled = onSwipeLeft ? !!onSwipeLeft() : false;
    else if (g.axis === 'x' && g.dx >= threshold) handled = onSwipeRight ? !!onSwipeRight() : false;
    setSettling(true);
    setDx(0);
    if (handled === false) { setWobble(true); setTimeout(() => setWobble(false), 400); }
    if (!g.moved && e?.type === 'pointerup') onTap?.();
  }

  const direction = dx < 0 ? 'left' : dx > 0 ? 'right' : null;
  const reveal = Math.min(1, Math.abs(dx) / 96);
  return (
    <div className="relative" style={style}>
      {direction && (
        <div aria-hidden="true" className={`absolute inset-0 flex items-center rounded-2xl px-5 text-sm font-semibold ${
          direction === 'left' ? 'justify-end bg-emerald-500/20 text-emerald-300' : 'justify-start bg-sky-500/20 text-sky-300'}`}
        style={{ opacity: reveal }}>
          {direction === 'left' ? leftHint : rightHint}
        </div>
      )}
      <div
        ref={ref}
        role="group"
        aria-label={label}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        className={`relative h-full touch-pan-y select-none ${wobble ? 'animate-wobble' : ''} ${className}`}
        style={{
          transform: dx ? `translateX(${dx}px)` : undefined,
          transition: settling ? 'transform 220ms cubic-bezier(.2,.8,.2,1)' : 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
}
