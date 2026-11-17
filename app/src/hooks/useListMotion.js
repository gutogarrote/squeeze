import { useCallback, useLayoutEffect, useRef } from 'react';

const EASE = 'cubic-bezier(.2,.9,.3,1)';

function canAnimate() {
  if (typeof Element === 'undefined' || typeof Element.prototype.animate !== 'function') return false;
  return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

// What moves: the swipeable body when there is one (it carries the drag offset), else the item.
const bodyOf = (item) => item.querySelector('[data-swipe-body]') || item;

function makeGhost(body, rect, rootRect) {
  const ghost = body.cloneNode(true);
  ghost.setAttribute('aria-hidden', 'true');
  ghost.removeAttribute('role');
  ghost.removeAttribute('aria-label');
  ghost.classList.remove('animate-wobble');
  Object.assign(ghost.style, {
    position: 'absolute', left: `${rect.left - rootRect.left}px`, top: `${rect.top - rootRect.top}px`,
    width: `${rect.width}px`, height: `${rect.height}px`, margin: '0', transform: 'none', transition: 'none',
    pointerEvents: 'none', zIndex: '5',
  });
  return ghost;
}

// Animates a list across an operation (FLIP). Call snapshot(id, effect) right before the state
// change and cancel() if nothing changed. After the next render every item with
// data-motion-id slides from where it was, including where a swipe left it. Effects for
// the item acted on:
// - 'fly': a copy of the card leaves to the left while the item fades in at its new place;
// - 'lift': the item travels above its neighbours (a swap).
// Without Web Animations, or with reduced motion, it does nothing.
export default function useListMotion() {
  const container = useRef(null);
  const pending = useRef(null);

  const snapshot = useCallback((id, effect) => {
    const root = container.current;
    if (!root || !canAnimate()) return;
    const rootRect = root.getBoundingClientRect();
    const rects = new Map();
    let ghost = null;
    root.querySelectorAll('[data-motion-id]').forEach((item) => {
      const body = bodyOf(item);
      const rect = body.getBoundingClientRect();
      rects.set(item.dataset.motionId, rect);
      if (effect === 'fly' && item.dataset.motionId === String(id)) ghost = makeGhost(body, rect, rootRect);
    });
    pending.current = { id: String(id), effect, rects, ghost };
  }, []);

  const cancel = useCallback(() => { pending.current = null; }, []);

  // Runs after every render; it only acts on the render that follows a snapshot.
  useLayoutEffect(() => {
    const motion = pending.current;
    const root = container.current;
    if (!motion || !root) return;
    pending.current = null;
    root.querySelectorAll('[data-motion-id]').forEach((item) => {
      item.getAnimations?.().forEach((animation) => animation.cancel());
      const before = motion.rects.get(item.dataset.motionId);
      const acted = item.dataset.motionId === motion.id;
      if (!before || (acted && motion.effect === 'fly')) {
        item.animate([{ opacity: 0, transform: 'scale(.94)' }, { opacity: 1, transform: 'none' }],
          { duration: 300, delay: before ? 140 : 0, easing: EASE, fill: 'backwards' });
        item.querySelector('[data-pop]')?.animate(
          [{ transform: 'scale(0)' }, { transform: 'scale(1.5)', offset: 0.6 }, { transform: 'scale(1)' }],
          { duration: 420, delay: 180, easing: 'ease-out', fill: 'backwards' },
        );
        return;
      }
      const after = bodyOf(item).getBoundingClientRect();
      const dx = before.left - after.left;
      const dy = before.top - after.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
      const from = `translate(${dx}px, ${dy}px)`;
      if (acted && motion.effect === 'lift') {
        item.animate([
          { transform: from, zIndex: 10 },
          { transform: `translate(${dx * 0.35}px, ${dy * 0.45}px) scale(1.03)`, zIndex: 10, offset: 0.5 },
          { transform: 'none', zIndex: 10 },
        ], { duration: 440, easing: EASE });
      } else {
        item.animate([{ transform: from }, { transform: 'none' }], { duration: 380, easing: EASE });
      }
    });
    if (motion.ghost) {
      const { ghost } = motion;
      root.appendChild(ghost);
      const distance = (parseFloat(ghost.style.left) || 0) + (parseFloat(ghost.style.width) || 320) + 48;
      const exit = ghost.animate(
        [{ transform: 'translateX(0)', opacity: 1 }, { transform: `translateX(${-distance}px)`, opacity: 0.3 }],
        { duration: 260, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' },
      );
      const remove = () => ghost.remove();
      exit.onfinish = remove;
      exit.oncancel = remove;
    }
  });

  return { container, snapshot, cancel };
}
