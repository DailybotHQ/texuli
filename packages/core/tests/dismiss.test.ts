import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  bindDismissLayer,
  createDismissOutsideEvent,
  createLayerStack,
  createOpenGestureGuard,
  isDismissPointerButton,
  isFocusOutside,
  isPointerOutside,
  isTargetInside,
  isTargetOutside,
  pointerModalityOf,
} from '../src/index.ts';

function mount(html: string): HTMLElement {
  document.body.innerHTML = html;
  const root = document.body.firstElementChild;
  if (!(root instanceof HTMLElement)) throw new Error('expected root');
  return root;
}

function pointer(type: string, init: PointerEventInit = {}): PointerEvent {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: 1,
    pointerType: 'mouse',
    button: 0,
    ...init,
  });
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('pointerModalityOf / isDismissPointerButton', () => {
  it('classifies mouse, touch and pen; accepts primary mouse and any touch/pen button', () => {
    // classifies mouse, touch and pen
    expect(pointerModalityOf({ pointerType: 'mouse' })).toBe('mouse');
    expect(pointerModalityOf({ pointerType: 'touch' })).toBe('touch');
    expect(pointerModalityOf({ pointerType: 'pen' })).toBe('pen');
    expect(pointerModalityOf({ pointerType: '' })).toBe('unknown');
    document.body.innerHTML = '';
    // accepts primary mouse and any touch/pen button
    expect(isDismissPointerButton({ pointerType: 'mouse', button: 0 })).toBe(true);
    expect(isDismissPointerButton({ pointerType: 'mouse', button: 2 })).toBe(false);
    expect(isDismissPointerButton({ pointerType: 'touch', button: 0 })).toBe(true);
    expect(isDismissPointerButton({ pointerType: 'pen', button: 0 })).toBe(true);
  });
});

describe('isTargetInside / isPointerOutside / isFocusOutside', () => {
  it('detects containment and branches, and 3 related cases', () => {
    {
      // detects containment and branches
      const root = mount(`
      <div>
        <div id="layer"><button id="in">In</button></div>
        <button id="trigger">Open</button>
        <button id="out">Out</button>
      </div>
    `);
      const layer = root.querySelector('#layer') as HTMLElement;
      const inside = root.querySelector('#in') as HTMLElement;
      const trigger = root.querySelector('#trigger') as HTMLElement;
      const outside = root.querySelector('#out') as HTMLElement;

      expect(isTargetInside(layer, inside)).toBe(true);
      expect(isTargetOutside(layer, outside)).toBe(true);
      expect(isTargetInside(layer, trigger, { branches: [trigger] })).toBe(true);
      expect(isTargetOutside(layer, trigger, { branches: [trigger] })).toBe(false);
    }
    document.body.innerHTML = '';
    {
      // uses composedPath when provided (shadow-friendly)
      const root = mount(`
      <div>
        <div id="layer"></div>
        <div id="host"></div>
      </div>
    `);
      const layer = root.querySelector('#layer') as HTMLElement;
      const host = root.querySelector('#host') as HTMLElement;
      const shadow = host.attachShadow({ mode: 'open' });
      const deep = document.createElement('button');
      shadow.append(deep);

      expect(isTargetOutside(layer, deep)).toBe(true);
      expect(
        isTargetInside(layer, deep, { composedPath: [deep, shadow, host, layer, document.body] })
      ).toBe(true);
    }
    document.body.innerHTML = '';
    {
      // ignores non-primary mouse for pointer-outside
      const root = mount(`
      <div>
        <div id="layer"></div>
        <button id="out">X</button>
      </div>
    `);
      const layer = root.querySelector('#layer') as HTMLElement;
      const out = root.querySelector('#out') as HTMLElement;
      const right = pointer('pointerdown', { button: 2, pointerType: 'mouse' });
      Object.defineProperty(right, 'target', { value: out });
      expect(isPointerOutside(layer, right)).toBe(false);

      const touch = pointer('pointerdown', { button: 0, pointerType: 'touch', pointerId: 9 });
      Object.defineProperty(touch, 'target', { value: out });
      expect(isPointerOutside(layer, touch)).toBe(true);
    }
    document.body.innerHTML = '';
    {
      // classifies focus-outside from focusin target
      const root = mount(`
      <div>
        <div id="layer"><button id="in">In</button></div>
        <button id="out">Out</button>
      </div>
    `);
      const layer = root.querySelector('#layer') as HTMLElement;
      const out = root.querySelector('#out') as HTMLElement;
      const event = new FocusEvent('focusin', { bubbles: true });
      Object.defineProperty(event, 'target', { value: out });
      expect(isFocusOutside(layer, event)).toBe(true);

      const inside = root.querySelector('#in') as HTMLElement;
      const inner = new FocusEvent('focusin', { bubbles: true });
      Object.defineProperty(inner, 'target', { value: inside });
      expect(isFocusOutside(layer, inner)).toBe(false);
    }
  });
});

describe('createDismissOutsideEvent', () => {
  it('is preventable without requiring the DOM event to be cancelable', () => {
    const original = new Event('pointerdown', { cancelable: false });
    const wrapped = createDismissOutsideEvent('pointer-outside', original, 'mouse');
    expect(wrapped.defaultPrevented).toBe(false);
    wrapped.preventDefault();
    expect(wrapped.defaultPrevented).toBe(true);
    expect(wrapped.reason).toBe('pointer-outside');
    expect(wrapped.pointerType).toBe('mouse');
  });
});

describe('createOpenGestureGuard', () => {
  it('ignores nothing after a layer opened from a completed click, and 2 related cases', () => {
    {
      // ignores nothing after a layer opened from a completed click
      const guard = createOpenGestureGuard();
      const opening = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(opening, 'pointerId', { value: 1 });
      guard.noteOpen(opening);
      // The user's next press, with the same (mouse) pointer id, is a real outside press.
      const next = new MouseEvent('pointerdown', { bubbles: true });
      Object.defineProperty(next, 'pointerId', { value: 1 });
      expect(guard.shouldIgnore(next)).toBe(false);
      const nextClick = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(nextClick, 'pointerId', { value: 1 });
      expect(guard.shouldIgnore(nextClick)).toBe(false);
    }
    document.body.innerHTML = '';
    {
      // ignores the opening pointer id through its click
      const guard = createOpenGestureGuard();
      const down = pointer('pointerdown', { pointerId: 7 });
      guard.noteOpen(down);
      expect(guard.shouldIgnore(pointer('pointerdown', { pointerId: 7 }))).toBe(true);
      expect(guard.shouldIgnore(pointer('pointerup', { pointerId: 7 }))).toBe(true);
      const click = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(click, 'pointerId', { value: 7 });
      expect(guard.shouldIgnore(click)).toBe(true);
      expect(guard.shouldIgnore(new MouseEvent('click', { bubbles: true }))).toBe(false);
    }
    document.body.innerHTML = '';
    {
      // skips one outside pointerdown after a programmatic open
      const guard = createOpenGestureGuard();
      guard.noteOpen();
      expect(guard.shouldIgnore(pointer('pointerdown', { pointerId: 3 }))).toBe(true);
      expect(guard.shouldIgnore(pointer('pointerdown', { pointerId: 4 }))).toBe(false);
    }
  });
});

describe('bindDismissLayer', () => {
  it('notifies pointer-outside and focus-outside separately, and 3 related cases', () => {
    {
      // notifies pointer-outside and focus-outside separately
      const root = mount(`
      <div>
        <div id="layer"><button id="in">In</button></div>
        <button id="out">Out</button>
      </div>
    `);
      const layer = root.querySelector('#layer') as HTMLElement;
      const out = root.querySelector('#out') as HTMLElement;
      const onPointerOutside = vi.fn();
      const onFocusOutside = vi.fn();
      const binding = bindDismissLayer({
        element: layer,
        document,
        onPointerOutside,
        onFocusOutside,
      });

      out.dispatchEvent(pointer('pointerdown', { pointerId: 2 }));
      expect(onPointerOutside).toHaveBeenCalledTimes(1);
      expect(onPointerOutside.mock.calls[0]?.[0].reason).toBe('pointer-outside');
      expect(onPointerOutside.mock.calls[0]?.[0].pointerType).toBe('mouse');

      out.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      expect(onFocusOutside).toHaveBeenCalledTimes(1);
      expect(onFocusOutside.mock.calls[0]?.[0].reason).toBe('focus-outside');
      expect(onFocusOutside.mock.calls[0]?.[0].pointerType).toBeNull();

      binding.disconnect();
    }
    document.body.innerHTML = '';
    {
      // does not notify when the target is inside the layer or a branch
      const root = mount(`
      <div>
        <div id="layer"><button id="in">In</button></div>
        <button id="trigger">Open</button>
        <button id="out">Out</button>
      </div>
    `);
      const layer = root.querySelector('#layer') as HTMLElement;
      const inside = root.querySelector('#in') as HTMLElement;
      const trigger = root.querySelector('#trigger') as HTMLElement;
      const onPointerOutside = vi.fn();
      const binding = bindDismissLayer({
        element: layer,
        document,
        branches: [trigger],
        onPointerOutside,
      });

      inside.dispatchEvent(pointer('pointerdown'));
      trigger.dispatchEvent(pointer('pointerdown'));
      expect(onPointerOutside).not.toHaveBeenCalled();

      binding.disconnect();
    }
    document.body.innerHTML = '';
    {
      // honours preventDefault as a per-layer veto flag
      const root = mount(`
      <div>
        <div id="layer"></div>
        <button id="out">Out</button>
      </div>
    `);
      const layer = root.querySelector('#layer') as HTMLElement;
      const out = root.querySelector('#out') as HTMLElement;
      let prevented = false;
      const binding = bindDismissLayer({
        element: layer,
        document,
        onPointerOutside: (event) => {
          event.preventDefault();
          prevented = event.defaultPrevented;
        },
      });
      out.dispatchEvent(pointer('pointerdown'));
      expect(prevented).toBe(true);
      binding.disconnect();
    }
    document.body.innerHTML = '';
    {
      // guards against the opening pointer so it does not dismiss immediately
      const root = mount(`
      <div>
        <div id="layer"></div>
        <button id="out">Out</button>
      </div>
    `);
      const layer = root.querySelector('#layer') as HTMLElement;
      const out = root.querySelector('#out') as HTMLElement;
      const onPointerOutside = vi.fn();
      const binding = bindDismissLayer({
        element: layer,
        document,
        onPointerOutside,
      });
      binding.noteOpenGesture(pointer('pointerdown', { pointerId: 42 }));
      out.dispatchEvent(pointer('pointerdown', { pointerId: 42 }));
      expect(onPointerOutside).not.toHaveBeenCalled();
      out.dispatchEvent(pointer('pointerdown', { pointerId: 99 }));
      expect(onPointerOutside).toHaveBeenCalledTimes(1);
      binding.disconnect();
    }
  });
  it('only the top stack layer receives outside pointer, and 2 related cases', () => {
    {
      // only the top stack layer receives outside pointer
      const root = mount(`
      <div>
        <div id="lower"></div>
        <div id="upper"></div>
        <button id="out">Out</button>
      </div>
    `);
      const lower = root.querySelector('#lower') as HTMLElement;
      const upper = root.querySelector('#upper') as HTMLElement;
      const out = root.querySelector('#out') as HTMLElement;
      const stack = createLayerStack();
      const low = stack.register({ element: lower });
      const up = stack.register({ element: upper });
      const onLower = vi.fn();
      const onUpper = vi.fn();
      const bindLower = bindDismissLayer({
        element: lower,
        document,
        stack,
        layerId: low.id,
        onPointerOutside: onLower,
      });
      const bindUpper = bindDismissLayer({
        element: upper,
        document,
        stack,
        layerId: up.id,
        onPointerOutside: onUpper,
      });

      out.dispatchEvent(pointer('pointerdown', { pointerId: 5 }));
      expect(onUpper).toHaveBeenCalledTimes(1);
      expect(onLower).not.toHaveBeenCalled();

      up.unregister();
      out.dispatchEvent(pointer('pointerdown', { pointerId: 6 }));
      expect(onLower).toHaveBeenCalledTimes(1);

      bindLower.disconnect();
      bindUpper.disconnect();
    }
    document.body.innerHTML = '';
    {
      // supports click-phase pointer outside for touch-friendly dismiss
      const root = mount(`
      <div>
        <div id="layer"></div>
        <button id="out">Out</button>
      </div>
    `);
      const layer = root.querySelector('#layer') as HTMLElement;
      const out = root.querySelector('#out') as HTMLElement;
      const onPointerOutside = vi.fn();
      const binding = bindDismissLayer({
        element: layer,
        document,
        pointerPhase: 'click',
        onPointerOutside,
      });

      out.dispatchEvent(pointer('pointerdown', { pointerId: 8, pointerType: 'touch' }));
      expect(onPointerOutside).not.toHaveBeenCalled();
      out.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      expect(onPointerOutside).toHaveBeenCalledTimes(1);

      binding.disconnect();
    }
    document.body.innerHTML = '';
    {
      // disconnect is idempotent and stops notifications
      const root = mount(`
      <div>
        <div id="layer"></div>
        <button id="out">Out</button>
      </div>
    `);
      const layer = root.querySelector('#layer') as HTMLElement;
      const out = root.querySelector('#out') as HTMLElement;
      const onPointerOutside = vi.fn();
      const binding = bindDismissLayer({
        element: layer,
        document,
        onPointerOutside,
      });
      binding.disconnect();
      binding.disconnect();
      out.dispatchEvent(pointer('pointerdown'));
      expect(onPointerOutside).not.toHaveBeenCalled();
    }
  });
});
