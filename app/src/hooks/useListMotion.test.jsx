import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import useListMotion from './useListMotion';

let motion;
function List({ items }) {
  motion = useListMotion();
  return (
    <div ref={motion.container}>
      <ul>
        {items.map((id) => (
          <li key={id} data-motion-id={id}>
            <div data-swipe-body="" role="group" aria-label={id}><span data-pop="">✓</span>{id}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Layout stand-in: each body sits at 100 px per position in `order`, plus any drag offset.
const offsets = {};
let order = [];
function installLayout() {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function rect() {
    const id = this.getAttribute('aria-label');
    if (!id) return { left: 0, top: 0, width: 300, height: 600 };
    return { left: 10 + (offsets[id] || 0), top: order.indexOf(id) * 100, width: 280, height: 90 };
  });
}
function show(rerender, items) {
  order = items;
  rerender(<List items={items} />);
}
const start = (items) => {
  order = items;
  const view = render(<List items={items} />);
  installLayout();
  return view;
};

let animations;
beforeEach(() => {
  animations = [];
  Object.keys(offsets).forEach((key) => delete offsets[key]);
  Element.prototype.animate = vi.fn(function animate(keyframes, options) {
    const animation = { target: this, keyframes, options, cancel: vi.fn() };
    animations.push(animation);
    return animation;
  });
  Element.prototype.getAnimations = vi.fn(() => []);
});
afterEach(() => {
  delete Element.prototype.animate;
  delete Element.prototype.getAnimations;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const of = (id) => animations.filter((a) => a.target.dataset?.motionId === id);

test('items slide from where they were; the lifted one starts where the swipe left it', () => {
  const { rerender } = start(['a', 'b', 'c']);
  offsets.a = 120;
  act(() => motion.snapshot('a', 'lift'));
  offsets.a = 0;
  show(rerender, ['b', 'a', 'c']);
  expect(of('a')[0].keyframes[0].transform).toBe('translate(120px, -100px)');
  expect(of('a')[0].keyframes.at(-1).transform).toBe('none');
  expect(of('b')[0].keyframes[0].transform).toBe('translate(0px, 100px)');
  expect(of('c')).toHaveLength(0);
  // Only the render that follows a snapshot animates.
  animations.length = 0;
  show(rerender, ['a', 'b', 'c']);
  expect(animations).toHaveLength(0);
});

test('a completed card flies away as a copy while the item fades in and its check pops', () => {
  const { rerender } = start(['a', 'b']);
  offsets.a = -150;
  act(() => motion.snapshot('a', 'fly'));
  offsets.a = 0;
  show(rerender, ['a', 'b']);
  const exit = animations.find((a) => a.target.getAttribute('aria-hidden') === 'true');
  const ghost = exit.target;
  expect(ghost).toBeInTheDocument();
  expect(ghost).not.toHaveAttribute('role');
  expect(ghost.style.left).toBe('-140px');
  expect(exit.keyframes.at(-1).transform).toMatch(/^translateX\(-\d+px\)$/);
  expect(of('a')[0].keyframes[0].opacity).toBe(0);
  expect(animations.some((a) => a.target.hasAttribute('data-pop'))).toBe(true);
  exit.onfinish();
  expect(ghost).not.toBeInTheDocument();
  expect(screen.getAllByRole('group')).toHaveLength(2);
});

test('new items fade in and a cancelled snapshot animates nothing', () => {
  const { rerender } = start(['a']);
  act(() => motion.snapshot('a', 'lift'));
  show(rerender, ['a', 'new']);
  expect(of('new')[0].keyframes[0].opacity).toBe(0);
  animations.length = 0;
  act(() => { motion.snapshot('a', 'fly'); motion.cancel(); });
  show(rerender, ['new', 'a']);
  expect(animations).toHaveLength(0);
});

test('reduced motion and browsers without Web Animations change the list at once', () => {
  const { rerender } = start(['a', 'b']);
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  act(() => motion.snapshot('a', 'fly'));
  show(rerender, ['b', 'a']);
  expect(animations).toHaveLength(0);
  vi.unstubAllGlobals();
  delete Element.prototype.animate;
  act(() => motion.snapshot('a', 'fly'));
  show(rerender, ['a', 'b']);
  expect(screen.getAllByText(/^✓/)).toHaveLength(2);
});
