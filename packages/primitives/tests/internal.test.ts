import { render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  attachDismissLayer,
  attachFocusScope,
  attachOverlay,
  attachPosition,
  attachRovingFocus,
  composeChildProps,
  createPrimitiveContext,
  stateAttributes,
} from '../src/internal/index.ts';
import ContextFixture from './context-fixture.svelte';

const cleanups: Array<() => void> = [];

function attach<E extends Element>(binding: (node: E) => unknown, node: E) {
  const cleanup = binding(node);
  if (typeof cleanup === 'function') cleanups.push(cleanup as () => void);
}

afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
  document.body.replaceChildren();
});

describe('Svelte attachment adapters', () => {
  it('activates and deactivates a focus scope with the attached node', () => {
    const opener = document.createElement('button');
    const dialog = document.createElement('section');
    const first = document.createElement('button');
    dialog.append(first);
    document.body.append(opener, dialog);
    opener.focus();

    attach(attachFocusScope(), dialog);
    expect(document.activeElement).toBe(first);

    cleanups.pop()?.();
    expect(document.activeElement).toBe(opener);
  });

  it('disconnects outside-focus listeners when the layer detaches', () => {
    const layer = document.createElement('div');
    const outside = document.createElement('button');
    const onFocusOutside = vi.fn();
    document.body.append(layer, outside);
    attach(attachDismissLayer({ pointerOutside: false, onFocusOutside }), layer);

    outside.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(onFocusOutside).toHaveBeenCalledTimes(1);

    cleanups.pop()?.();
    outside.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(onFocusOutside).toHaveBeenCalledTimes(1);
  });

  it('synchronizes roving items, responds to keys, and restores authored tabindex on detach', () => {
    const root = document.createElement('div');
    const first = document.createElement('button');
    const second = document.createElement('button');
    first.dataset.rovingItem = '';
    second.dataset.rovingItem = '';
    first.setAttribute('tabindex', '4');
    root.append(first, second);
    document.body.append(root);
    attach(attachRovingFocus({ orientation: 'horizontal', observe: false }), root);

    expect(first.getAttribute('tabindex')).toBe('0');
    expect(second.getAttribute('tabindex')).toBe('-1');
    first.focus();
    const move = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true,
    });
    root.dispatchEvent(move);
    expect(move.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(second);

    cleanups.pop()?.();
    expect(first.getAttribute('tabindex')).toBe('4');
    expect(second.hasAttribute('tabindex')).toBe(false);
    const afterDetach = new KeyboardEvent('keydown', {
      key: 'ArrowLeft',
      bubbles: true,
      cancelable: true,
    });
    root.dispatchEvent(afterDetach);
    expect(afterDetach.defaultPrevented).toBe(false);
  });

  it('positions a floating node on attach and clears owned styles on detach', () => {
    const reference = document.createElement('button');
    const floating = document.createElement('div');
    document.body.append(reference, floating);
    attach(
      attachPosition(reference, {
        placement: 'bottom',
        cssAnchor: 'never',
        ancestorScroll: false,
        ancestorResize: false,
        elementResize: false,
        layoutShift: false,
      }),
      floating
    );
    expect(floating.style.position).toBe('fixed');

    cleanups.pop()?.();
    expect(floating.style.position).toBe('');
  });

  it('destroys the overlay controller when its node detaches', () => {
    const node = document.createElement('div');
    const onController = vi.fn();
    document.body.append(node);
    attach(attachOverlay({ dismiss: { escape: false } }, onController), node);

    expect(onController).toHaveBeenCalledTimes(1);
    const controller = onController.mock.calls[0]?.[0];
    expect(controller?.phase()).toBe('closed');

    cleanups.pop()?.();
    expect(controller?.phase()).toBe('closed');
    expect(onController).toHaveBeenLastCalledWith(undefined);
  });
});

describe('primitive composition contracts', () => {
  it('composes child classes and event handlers while allowing a child veto', () => {
    const childClick = vi.fn((event: Event) => event.preventDefault());
    const primitiveClick = vi.fn();
    const props = composeChildProps(
      { class: 'trigger', onclick: primitiveClick, 'data-state': 'open', 'aria-expanded': 'true' },
      { class: 'custom', onclick: childClick, 'data-state': 'closed', 'aria-expanded': 'false' }
    );
    const event = new Event('click', { cancelable: true });

    props.onclick?.(event);
    expect(props.class).toBe('trigger custom');
    expect(props['data-state']).toBe('open');
    expect(props['aria-expanded']).toBe('true');
    expect(childClick).toHaveBeenCalledWith(event);
    expect(primitiveClick).not.toHaveBeenCalled();

    const allowChildClick = vi.fn();
    const runPrimitiveClick = vi.fn();
    const composed = composeChildProps(
      { onclick: runPrimitiveClick },
      { onclick: allowChildClick }
    );
    const accepted = new Event('click', { cancelable: true });
    composed.onclick?.(accepted);
    expect(allowChildClick).toHaveBeenCalledWith(accepted);
    expect(runPrimitiveClick).toHaveBeenCalledWith(accepted);
  });

  it('uses consistent state attributes and reports missing context providers', () => {
    expect(stateAttributes('open')).toEqual({ 'data-state': 'open' });
    expect(stateAttributes('disabled')).toEqual({ 'data-state': 'disabled', 'data-disabled': '' });
    expect(stateAttributes('closed', true)).toEqual({
      'data-state': 'closed',
      'data-disabled': '',
    });

    const menu = createPrimitiveContext<{ selected: string }>('Menu');
    expect(() => menu.get()).toThrow('Missing Menu provider');

    render(ContextFixture);
    expect(screen.getByText('alpha')).toBeTruthy();
  });
});
