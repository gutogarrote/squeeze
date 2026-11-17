import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import SwipeCard from './SwipeCard';

if (!window.PointerEvent) {
  window.PointerEvent = class PointerEvent extends MouseEvent {
    constructor(type, init = {}) { super(type, init); this.pointerId = init.pointerId ?? 1; }
  };
}

// Events carry explicit timestamps so that speed is under the test's control (React replaces
// a zero timestamp with the wall clock, hence the offset).
function pointer(type, element, clientX, timeStamp, clientY = 10) {
  const event = new window.PointerEvent(type, { bubbles: true, clientX, clientY, pointerId: 1, button: 0 });
  Object.defineProperty(event, 'timeStamp', { value: 5000 + timeStamp });
  fireEvent(element, event);
}

function setup(props = {}) {
  const onSwipeLeft = vi.fn(() => true);
  const onSwipeRight = vi.fn(() => true);
  const onTap = vi.fn();
  render(
    <SwipeCard label="Card" leftHint="Concluir" rightHint="Adiar" onSwipeLeft={onSwipeLeft} onSwipeRight={onSwipeRight} onTap={onTap} {...props}>
      Conteúdo
    </SwipeCard>,
  );
  const body = screen.getByRole('group', { name: 'Card' });
  const pane = () => screen.queryByTestId('swipe-pane');
  return { body, pane, onSwipeLeft, onSwipeRight, onTap };
}

beforeEach(() => { vi.stubGlobal('navigator', { vibrate: vi.fn() }); });
afterEach(() => { vi.unstubAllGlobals(); });

test('the action pane grows with the drag and arms, with a haptic tick, past the threshold', () => {
  const { body, pane } = setup();
  pointer('pointerdown', body, 200, 0);
  pointer('pointermove', body, 160, 100);
  expect(body.style.transform).toBe('translateX(-40px)');
  expect(pane()).toHaveAttribute('data-swipe-pane', 'idle');
  expect(pane()).toHaveTextContent('Concluir');
  expect(pane().style.width).toBe('32px');
  expect(navigator.vibrate).not.toHaveBeenCalled();
  pointer('pointermove', body, 90, 400);
  expect(pane()).toHaveAttribute('data-swipe-pane', 'armed');
  expect(navigator.vibrate).toHaveBeenCalledOnce();
  // Coming back disarms; releasing there does nothing.
  pointer('pointermove', body, 170, 900);
  expect(pane()).toHaveAttribute('data-swipe-pane', 'idle');
});

test('a slow short drag springs back without acting; a slow long one acts while still displaced', () => {
  const { body, onSwipeLeft, onSwipeRight } = setup();
  pointer('pointerdown', body, 200, 0);
  pointer('pointermove', body, 150, 1000);
  pointer('pointerup', body, 150, 1100);
  expect(onSwipeLeft).not.toHaveBeenCalled();
  expect(body.style.transform).toBe('');
  expect(body.style.transition).toContain('transform');

  onSwipeRight.mockImplementation(() => { expect(body.style.transform).toBe('translateX(120px)'); return true; });
  pointer('pointerdown', body, 100, 2000);
  pointer('pointermove', body, 220, 4000);
  pointer('pointerup', body, 220, 4100);
  expect(onSwipeRight).toHaveBeenCalledOnce();
});

test('a quick flick acts before the threshold, but only in the direction of travel', () => {
  const { body, onSwipeLeft } = setup();
  pointer('pointerdown', body, 200, 0);
  pointer('pointermove', body, 180, 16);
  pointer('pointermove', body, 150, 32);
  pointer('pointerup', body, 150, 40);
  expect(onSwipeLeft).toHaveBeenCalledOnce();

  // Pulled left, then thrown back to the right: no action.
  pointer('pointerdown', body, 200, 1000);
  pointer('pointermove', body, 120, 1400);
  pointer('pointermove', body, 160, 1416);
  pointer('pointerup', body, 160, 1420);
  expect(onSwipeLeft).toHaveBeenCalledOnce();
});

test('a side without an action resists the pull and shows no pane', () => {
  const { body, pane, onSwipeRight } = setup({ rightHint: '', onSwipeRight: vi.fn(() => false) });
  pointer('pointerdown', body, 100, 0);
  pointer('pointermove', body, 250, 2000);
  expect(body.style.transform).toBe('translateX(30px)');
  expect(pane()).toBeNull();
  expect(navigator.vibrate).not.toHaveBeenCalled();
  pointer('pointerup', body, 250, 2100);
  expect(body).toHaveClass('animate-wobble');
  expect(onSwipeRight).not.toHaveBeenCalled();
});

test('an action that changes nothing makes the card wobble', () => {
  const { body, onSwipeLeft } = setup({ onSwipeLeft: vi.fn(() => false) });
  pointer('pointerdown', body, 200, 0);
  pointer('pointermove', body, 50, 2000);
  pointer('pointerup', body, 50, 2100);
  expect(onSwipeLeft).not.toHaveBeenCalled();
  expect(body).toHaveClass('animate-wobble');
});

test('a cancelled gesture never acts; vertical movement and taps are not swipes', () => {
  const { body, onSwipeLeft, onTap } = setup();
  pointer('pointerdown', body, 200, 0);
  pointer('pointermove', body, 40, 2000);
  pointer('pointercancel', body, 40, 2100);
  expect(onSwipeLeft).not.toHaveBeenCalled();
  expect(body.style.transform).toBe('');

  pointer('pointerdown', body, 200, 3000, 10);
  pointer('pointermove', body, 205, 3100, 120);
  pointer('pointermove', body, 40, 3200, 140);
  pointer('pointerup', body, 40, 3300, 140);
  expect(onSwipeLeft).not.toHaveBeenCalled();
  expect(onTap).not.toHaveBeenCalled();

  pointer('pointerdown', body, 200, 4000);
  pointer('pointerup', body, 200, 4050);
  expect(onTap).toHaveBeenCalledOnce();
});
