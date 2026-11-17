import React, { useRef, useState } from 'react';
import { haptic } from '../lib/native';

const LOCK_PX = 8;
const GAP_PX = 8;
const FLING_PX_MS = 0.55;
const FLING_MIN_PX = 28;
const RESIST = 0.2;
const SPRING = 'cubic-bezier(.2,1.25,.35,1)';

const TONES = {
  emerald: { soft: 'bg-emerald-500/15 text-emerald-300', solid: 'bg-emerald-500 text-emerald-950' },
  sky: { soft: 'bg-sky-500/15 text-sky-300', solid: 'bg-sky-500 text-sky-950' },
  lime: { soft: 'bg-lime-300/15 text-lime-200', solid: 'bg-lime-300 text-lime-950' },
};

const thresholdFor = (width) => Math.min(96, (width || 320) * 0.28);

// A horizontally swipeable card. onSwipeLeft/onSwipeRight return true when the gesture did
// something; otherwise the card wobbles back ("balança e volta"). A side without a hint has
// no action: the card resists the pull. The action pane grows behind the card and turns
// solid (with a haptic tick) once releasing will act; a quick flick acts too. Vertical
// scrolling stays native (touch-action: pan-y). Taps (no movement) call onTap.
export default function SwipeCard({
  onSwipeLeft, onSwipeRight, leftHint, rightHint, leftIcon = '✓', rightIcon = '↓',
  leftTone = 'emerald', rightTone = 'sky', onTap, className = '', style, bodyStyle, children, label,
}) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [threshold, setThreshold] = useState(96);
  const [side, setSide] = useState(null);
  const [wobble, setWobble] = useState(false);
  const gesture = useRef(null);
  const ref = useRef(null);

  const hintFor = (value) => (value < 0 ? leftHint : rightHint);

  function onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    // Buttons and fields inside the card keep their own behavior.
    if (e.target.closest?.('button, input, select, a')) return;
    gesture.current = {
      x: e.clientX, y: e.clientY, id: e.pointerId, axis: null, moved: false, dx: 0,
      lastX: e.clientX, lastT: e.timeStamp, velocity: 0, armed: false, threshold: 96,
    };
  }

  function onPointerMove(e) {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    const mx = e.clientX - g.x;
    const my = e.clientY - g.y;
    if (!g.axis) {
      if (Math.abs(mx) > LOCK_PX && Math.abs(mx) > Math.abs(my)) {
        g.axis = 'x';
        g.threshold = thresholdFor(ref.current?.offsetWidth);
        setThreshold(g.threshold);
        setDragging(true);
        try { ref.current?.setPointerCapture?.(e.pointerId); } catch (_) {}
      } else if (Math.abs(my) > LOCK_PX) g.axis = 'y';
    }
    if (Math.abs(mx) > LOCK_PX || Math.abs(my) > LOCK_PX) g.moved = true;
    if (g.axis !== 'x') return;
    const dt = e.timeStamp - g.lastT;
    if (dt > 0) {
      g.velocity = 0.6 * ((e.clientX - g.lastX) / dt) + 0.4 * g.velocity;
      g.lastX = e.clientX;
      g.lastT = e.timeStamp;
    }
    g.dx = mx;
    const armed = !!hintFor(mx) && Math.abs(mx) >= g.threshold;
    if (armed !== g.armed) { g.armed = armed; if (armed) haptic(12); }
    setDx(mx);
    setSide(mx < 0 ? 'left' : 'right');
  }

  function finish(e) {
    const g = gesture.current;
    gesture.current = null;
    if (!g || (e && g.id !== e.pointerId)) return;
    const cancelled = e?.type === 'pointercancel';
    const flung = Math.abs(g.velocity) > FLING_PX_MS && Math.abs(g.dx) > FLING_MIN_PX
      && Math.sign(g.velocity) === Math.sign(g.dx) && !!hintFor(g.dx);
    const far = Math.abs(g.dx) >= g.threshold;
    let handled = null;
    if (g.axis === 'x' && !cancelled && (far || flung)) {
      const action = g.dx < 0 ? onSwipeLeft : onSwipeRight;
      // The handler runs while the card is still displaced, so the list can animate from here.
      handled = action ? !!action() : false;
    }
    setDragging(false);
    setDx(0);
    if (handled) haptic(18);
    if (handled === false) { setWobble(true); setTimeout(() => setWobble(false), 400); }
    if (!g.moved && e?.type === 'pointerup') onTap?.();
  }

  const hint = hintFor(dx);
  // No action on this side: the card follows only a little.
  const x = dx === 0 ? 0 : hint ? dx : dx * RESIST;
  const armed = !!hint && Math.abs(dx) >= threshold;
  const progress = Math.min(1, Math.abs(dx) / threshold);
  const paneSide = side || 'left';
  const paneHint = paneSide === 'left' ? leftHint : rightHint;
  const tone = TONES[paneSide === 'left' ? leftTone : rightTone] || TONES.emerald;
  const settle = dragging ? 'none' : `380ms ${SPRING}`;
  return (
    <div className={`relative ${style?.height !== undefined ? 'transition-[height] duration-500' : ''}`} style={style}>
      {side && paneHint && (
        <div aria-hidden="true" data-testid="swipe-pane" data-swipe-pane={armed ? 'armed' : 'idle'}
          className={`absolute inset-y-0 flex items-center overflow-hidden rounded-2xl transition-colors duration-150 ${
            paneSide === 'left' ? 'right-0 justify-end' : 'left-0 justify-start'} ${armed ? tone.solid : tone.soft}`}
          style={{ width: Math.max(0, Math.abs(x) - GAP_PX), transition: dragging ? undefined : `width ${settle}` }}>
          <span className={`flex shrink-0 items-center gap-2 whitespace-nowrap px-4 text-sm font-semibold ${paneSide === 'left' ? 'flex-row-reverse' : ''}`}
            style={{
              opacity: 0.35 + 0.65 * progress,
              transform: `scale(${armed ? 1.12 : 0.85 + 0.15 * progress})`,
              transformOrigin: paneSide === 'left' ? 'right center' : 'left center',
              transition: 'transform 200ms cubic-bezier(.2,1.8,.4,1)',
            }}>
            <span className="text-lg leading-none">{paneSide === 'left' ? leftIcon : rightIcon}</span>
            <span>{paneHint}</span>
          </span>
        </div>
      )}
      <div
        ref={ref}
        role="group"
        aria-label={label}
        data-swipe-body=""
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        className={`relative h-full touch-pan-y select-none ${dragging ? 'shadow-xl shadow-black/50' : ''} ${wobble ? 'animate-wobble' : ''} ${className}`}
        style={{
          ...bodyStyle,
          transform: x ? `translateX(${x}px)` : undefined,
          transition: dragging ? 'none' : `transform ${settle}`,
          willChange: dragging ? 'transform' : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}
