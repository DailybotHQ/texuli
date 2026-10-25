import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createInertRegistry,
  createLayerStack,
  createOverlay,
  type InertRegistry,
  type LayerStack,
  OVERLAY_MODE_ATTR,
  OVERLAY_Z_BASE,
  type OverlayOptions,
} from '../src/index.ts';
import { createOverlayCore } from '../src/overlay/core-entry.ts';

/**
 *   body
 *   ├── main#app > button#trigger, button#other, section#frame > p#frame-text
 *   ├── div#dialog > button#first, button#last
 *   ├── div#nested > button#nested-button
 *   └── section#toasts > button#toast-action   (inert exemption, R16)
 */
let stack: LayerStack;
let inert: InertRegistry;
let page: ReturnType<typeof build>;

function build() {
  document.body.replaceChildren();
  document.documentElement.removeAttribute('style');
  document.body.removeAttribute('style');
  const make = (tag: string, id: string, parent: Element, text = '') => {
    const element = document.createElement(tag);
    element.id = id;
    if (text) element.textContent = text;
    parent.append(element);
    return element;
  };
  const app = make('main', 'app', document.body);
  const trigger = make('button', 'trigger', app, 'Open');
  const other = make('button', 'other', app, 'Other');
  const frame = make('section', 'frame', app);
  const frameText = make('p', 'frame-text', frame, 'Inside the frame');
  const dialog = make('div', 'dialog', document.body);
  const first = make('button', 'first', dialog, 'First');
  const last = make('button', 'last', dialog, 'Last');
  const nested = make('div', 'nested', document.body);
  const nestedButton = make('button', 'nested-button', nested, 'Nested');
  const toasts = make('section', 'toasts', document.body);
  const toastAction = make('button', 'toast-action', toasts, 'Undo');
  return {
    app,
    trigger,
    other,
    frame,
    frameText,
    dialog,
    first,
    last,
    nested,
    nestedButton,
    toasts,
    toastAction,
  };
}

/** Stub the popover API happy-dom lacks, recording calls. */
function withPopover(element: HTMLElement) {
  const calls: string[] = [];
  Object.assign(element, {
    showPopover: () => calls.push('show'),
    hidePopover: () => calls.push('hide'),
  });
  return calls;
}

function overlay(options: Partial<OverlayOptions> & { element: HTMLElement }) {
  return createOverlay({
    stack,
    inertRegistry: inert,
    presence: { reducedMotion: true },
    ...options,
  });
}

const frame = () => new Promise((resolve) => setTimeout(resolve, 40));
const key = (target: Element, name: string, init: KeyboardEventInit = {}) => {
  const event = new KeyboardEvent('keydown', {
    key: name,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
};
const pointerDown = (target: Element) =>
  target.dispatchEvent(
    new PointerEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      button: 0,
      pointerType: 'mouse',
    })
  );

beforeEach(() => {
  stack = createLayerStack();
  inert = createInertRegistry();
  page = build();
});

afterEach(() => {
  inert.clear();
  stack.clear();
});

describe('top-layer mode, modal', () => {
  it('composes popover, layer, inert, scroll lock, focus and presence on open', () => {
    const calls = withPopover(page.dialog);
    const onOpenChange = vi.fn();
    page.trigger.focus();
    const engine = overlay({ element: page.dialog, modal: true, onOpenChange, label: 'dialog' });
    inert.exempt({ element: page.toasts, label: 'toasts' });

    engine.open();

    expect(page.dialog.getAttribute('popover')).toBe('manual');
    expect(calls).toEqual(['show']);
    expect(page.dialog.getAttribute(OVERLAY_MODE_ATTR)).toBe('top-layer');
    expect(page.dialog.getAttribute('data-state')).toBe('open');
    expect(engine.phase()).toBe('open');
    expect(engine.isTop()).toBe(true);
    expect(stack.top()?.element).toBe(page.dialog);
    // Inert outside, but never the toast region (R16).
    expect(page.app.hasAttribute('inert')).toBe(true);
    expect(page.nested.hasAttribute('inert')).toBe(true);
    expect(page.toasts.hasAttribute('inert')).toBe(false);
    expect(page.dialog.hasAttribute('inert')).toBe(false);
    // Scroll lock on the page, focus moved inside.
    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(document.activeElement).toBe(page.first);
    expect(onOpenChange).toHaveBeenCalledWith(true);
    // No z-index when the browser top layer stacks it.
    expect(page.dialog.style.zIndex).toBe('');
  });

  it('runs a modal overlay core without modal texels when their effects are off', () => {
    page.trigger.focus();
    const engine = createOverlayCore({
      element: page.dialog,
      modal: true,
      trapFocus: false,
      inertOutside: false,
      lockScroll: false,
      stack,
      presence: { reducedMotion: true },
    });

    engine.open();

    expect(document.activeElement).toBe(page.trigger);
    expect(page.app.hasAttribute('inert')).toBe(false);
    expect(document.documentElement.style.overflow).toBe('');
    engine.destroy();
  });

  it('re-raises an open exempt popover (the toast region) above the new top layer', () => {
    withPopover(page.dialog);
    const toastCalls = withPopover(page.toasts);
    let open = true;
    page.toasts.matches = ((selector: string) =>
      selector === ':popover-open' && open) as typeof page.toasts.matches;
    inert.exempt({ element: page.toasts });
    overlay({ element: page.dialog, modal: true }).open();
    expect(toastCalls).toEqual(['hide', 'show']);
    open = false;
    overlay({ element: page.nested, modal: true }).open();
    expect(toastCalls).toEqual(['hide', 'show']);
  });

  it('traps Tab inside the dialog', () => {
    withPopover(page.dialog);
    const engine = overlay({ element: page.dialog, modal: true });
    engine.open();
    page.last.focus();
    const tab = key(page.last, 'Tab');
    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(page.first);
  });

  it('releases interaction at close and hides after the exit frame', async () => {
    const calls = withPopover(page.dialog);
    const onExitComplete = vi.fn();
    page.trigger.focus();
    const engine = overlay({ element: page.dialog, modal: true, onExitComplete });
    engine.open();
    engine.close();

    // Interaction ends now: focus is back, nothing inert, the layer is gone.
    expect(engine.phase()).toBe('closing');
    expect(document.activeElement).toBe(page.trigger);
    expect(page.app.hasAttribute('inert')).toBe(false);
    expect(stack.size()).toBe(0);
    expect(page.dialog.getAttribute('data-state')).toBe('closed');
    // Still shown during exit motion.
    expect(calls).toEqual(['show']);

    await frame();
    expect(calls).toEqual(['show', 'hide']);
    expect(engine.phase()).toBe('closed');
    expect(page.dialog.hasAttribute('popover')).toBe(false);
    expect(page.dialog.hasAttribute(OVERLAY_MODE_ATTR)).toBe(false);
    expect(document.documentElement.style.overflow).toBe('');
    expect(onExitComplete).toHaveBeenCalledOnce();
  });

  it('keeps an author popover value after close', async () => {
    withPopover(page.dialog);
    page.dialog.setAttribute('popover', 'auto');
    const engine = overlay({ element: page.dialog, modal: true });
    engine.open();
    expect(page.dialog.getAttribute('popover')).toBe('manual');
    engine.close();
    await frame();
    expect(page.dialog.getAttribute('popover')).toBe('auto');
  });

  it('re-opens during exit without hiding', async () => {
    const calls = withPopover(page.dialog);
    const engine = overlay({ element: page.dialog, modal: true });
    engine.open();
    engine.close();
    engine.open();
    await frame();
    expect(engine.phase()).toBe('open');
    expect(calls).toEqual(['show']);
    expect(page.dialog.getAttribute('data-state')).toBe('open');
    expect(page.app.hasAttribute('inert')).toBe(true);
    expect(stack.size()).toBe(1);
  });
});

describe('dismissal', () => {
  it('closes only the topmost layer on Escape and restores focus in order', async () => {
    withPopover(page.dialog);
    withPopover(page.nested);
    page.trigger.focus();
    const outer = overlay({ element: page.dialog, modal: true });
    outer.open();
    expect(document.activeElement).toBe(page.first);
    const inner = overlay({ element: page.nested, modal: true });
    inner.open();
    expect(document.activeElement).toBe(page.nestedButton);
    expect(page.dialog.hasAttribute('inert')).toBe(true);

    const first = key(page.nestedButton, 'Escape');
    expect(first.defaultPrevented).toBe(true);
    expect(inner.phase()).toBe('closing');
    expect(outer.phase()).toBe('open');
    expect(document.activeElement).toBe(page.first);
    expect(page.dialog.hasAttribute('inert')).toBe(false);
    expect(page.app.hasAttribute('inert')).toBe(true);

    key(page.first, 'Escape');
    expect(outer.phase()).toBe('closing');
    expect(document.activeElement).toBe(page.trigger);
    expect(page.app.hasAttribute('inert')).toBe(false);
    await frame();
  });

  it('leaves Escape to a handler that already took it, and to exempt regions (R16)', () => {
    withPopover(page.dialog);
    inert.exempt({ element: page.toasts });
    const engine = overlay({ element: page.dialog, modal: true });
    engine.open();

    page.first.addEventListener('keydown', (event) => event.preventDefault(), { once: true });
    key(page.first, 'Escape');
    expect(engine.isOpen()).toBe(true);

    page.toastAction.focus();
    expect(document.activeElement).toBe(page.toastAction);
    key(page.toastAction, 'Escape');
    expect(engine.isOpen()).toBe(true);

    key(page.first, 'Escape', { isComposing: true });
    expect(engine.isOpen()).toBe(true);
  });

  it('closes a non-modal overlay on pointer outside, not on the trigger, the toast or the opening gesture', () => {
    inert.exempt({ element: page.toasts });
    const onOpenChange = vi.fn();
    const engine = overlay({ element: page.dialog, branches: () => [page.trigger], onOpenChange });
    const opening = new PointerEvent('pointerdown', {
      bubbles: true,
      button: 0,
      pointerType: 'mouse',
      pointerId: 7,
    });
    engine.open(opening);

    pointerDown(page.trigger);
    pointerDown(page.toastAction);
    pointerDown(page.first);
    expect(engine.isOpen()).toBe(true);

    pointerDown(page.other);
    expect(engine.isOpen()).toBe(false);
    expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
  });

  it('dismisses on the first outside pointer after a keyboard open', () => {
    const engine = overlay({ element: page.dialog });
    engine.open();
    pointerDown(page.other);
    expect(engine.isOpen()).toBe(false);
  });

  it('keeps a menu opened from inside a modal live, even outside the modal', () => {
    withPopover(page.dialog);
    const modal = overlay({ element: page.dialog, modal: true });
    modal.open();
    expect(page.nested.hasAttribute('inert')).toBe(true);
    const menu = overlay({ element: page.nested, branches: () => [page.first] });
    menu.open();
    expect(page.nested.hasAttribute('inert')).toBe(false);
    expect(inert.isExempt(page.nested)).toBe(true);
    // Its own exemption does not swallow its Escape; the modal stays open.
    key(page.nestedButton, 'Escape');
    expect(menu.isOpen()).toBe(false);
    expect(modal.isOpen()).toBe(true);
    menu.open();
    menu.close();
    expect(inert.isExempt(page.nested)).toBe(false);
    expect(page.nested.hasAttribute('inert')).toBe(true);
  });

  it('closes a non-modal overlay when focus leaves it', () => {
    const engine = overlay({ element: page.dialog });
    engine.open();
    page.first.focus();
    page.other.focus();
    expect(engine.isOpen()).toBe(false);
  });

  it('lets onDismissRequest veto a close', () => {
    withPopover(page.dialog);
    const reasons: string[] = [];
    const engine = overlay({
      element: page.dialog,
      modal: true,
      onDismissRequest: (event) => {
        reasons.push(event.reason);
        event.preventDefault();
      },
    });
    engine.open();
    key(page.first, 'Escape');
    pointerDown(page.other);
    expect(engine.isOpen()).toBe(true);
    expect(reasons).toEqual(['escape', 'pointer-outside']);
  });

  it('honors dismiss switches', () => {
    const engine = overlay({
      element: page.dialog,
      dismiss: { escape: false, pointerOutside: false, focusOutside: false },
    });
    engine.open();
    key(page.first, 'Escape');
    pointerDown(page.other);
    page.other.focus();
    expect(engine.isOpen()).toBe(true);
  });
});

describe('contained mode', () => {
  it('portals into the frame and keeps every effect inside it', async () => {
    const onExitComplete = vi.fn();
    const engine = overlay({
      element: page.dialog,
      mode: 'contained',
      container: page.frame,
      modal: true,
      onExitComplete,
    });
    engine.open();

    expect(page.dialog.parentElement).toBe(page.frame);
    expect(page.dialog.hasAttribute('popover')).toBe(false);
    expect(page.dialog.getAttribute(OVERLAY_MODE_ATTR)).toBe('contained');
    expect(page.dialog.style.zIndex).toBe(String(OVERLAY_Z_BASE));
    // Only the frame's content goes inert; the page around it stays usable.
    expect(page.frameText.hasAttribute('inert')).toBe(true);
    expect(page.trigger.hasAttribute('inert')).toBe(false);
    expect(page.toasts.hasAttribute('inert')).toBe(false);
    // No page scroll lock for a contained overlay.
    expect(document.documentElement.style.overflow).toBe('');
    expect(document.activeElement).toBe(page.first);

    engine.close();
    await frame();
    expect(page.dialog.parentElement).toBe(document.body);
    expect(page.dialog.nextElementSibling).toBe(page.nested);
    expect(page.dialog.style.zIndex).toBe('');
    expect(page.frameText.hasAttribute('inert')).toBe(false);
    expect(onExitComplete).toHaveBeenCalledOnce();
  });

  it('stacks nested contained overlays by open order', () => {
    const outer = overlay({ element: page.dialog, mode: 'contained', container: page.frame });
    const inner = overlay({ element: page.nested, mode: 'contained', container: page.frame });
    outer.open();
    inner.open();
    expect(Number(page.nested.style.zIndex)).toBeGreaterThan(Number(page.dialog.style.zIndex));
  });

  it('follows a new frame reactively', () => {
    const second = document.createElement('section');
    document.body.append(second);
    const engine = overlay({
      element: page.dialog,
      mode: 'contained',
      container: page.frame,
      modal: true,
    });
    engine.open();
    engine.setContainer(second);
    expect(page.dialog.parentElement).toBe(second);
    expect(page.frameText.hasAttribute('inert')).toBe(false);
  });

  it('positions against an anchor inside the frame', () => {
    const engine = overlay({
      element: page.dialog,
      mode: 'contained',
      container: page.frame,
      anchor: page.trigger,
      position: { placement: 'bottom-start', offset: 4, cssAnchor: 'never' },
    });
    engine.open();
    expect(page.dialog.getAttribute('data-placement')).toBe('bottom-start');
    engine.setAnchor(null);
    expect(page.dialog.hasAttribute('data-placement')).toBe(false);
  });
});

describe('fallbacks and life cycle', () => {
  it('uses a z-index when the browser has no popover API', () => {
    const engine = overlay({ element: page.dialog, modal: true });
    engine.open();
    expect(page.dialog.hasAttribute('popover')).toBe(false);
    expect(page.dialog.style.zIndex).toBe(String(OVERLAY_Z_BASE));
  });

  it('portals a top-layer overlay only when asked', () => {
    const host = document.createElement('div');
    document.body.append(host);
    withPopover(page.dialog);
    const engine = overlay({ element: page.dialog, portal: host });
    engine.open();
    expect(page.dialog.parentElement).toBe(host);
    engine.setContainer(null);
    expect(page.dialog.parentElement).toBe(document.body);
  });

  it('destroy tears everything down at once and is idempotent', () => {
    const calls = withPopover(page.dialog);
    page.trigger.focus();
    const engine = overlay({
      element: page.dialog,
      modal: true,
      mode: 'top-layer',
      portal: page.frame,
    });
    engine.open();
    engine.destroy();
    engine.destroy();
    expect(calls).toEqual(['show', 'hide']);
    expect(page.dialog.parentElement).toBe(document.body);
    expect(page.app.hasAttribute('inert')).toBe(false);
    expect(document.documentElement.style.overflow).toBe('');
    expect(stack.size()).toBe(0);
    expect(document.activeElement).toBe(page.trigger);
    engine.open();
    expect(engine.phase()).toBe('closed');
  });

  it('falls back to the opening control when nothing was focused (WebKit clicks)', () => {
    withPopover(page.dialog);
    (document.activeElement as HTMLElement | null)?.blur();
    const engine = overlay({ element: page.dialog, modal: true });
    page.trigger.addEventListener('click', (event) => engine.open(event), { once: true });
    page.trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.activeElement).toBe(page.first);
    engine.close();
    expect(document.activeElement).toBe(page.trigger);
  });

  it('never leaves focus inside a closed overlay', () => {
    withPopover(page.dialog);
    (document.activeElement as HTMLElement | null)?.blur();
    const engine = overlay({ element: page.dialog, modal: true });
    engine.open();
    engine.close();
    expect(page.dialog.contains(document.activeElement)).toBe(false);
  });

  it('respects restoreFocus: false and toggles', async () => {
    withPopover(page.dialog);
    page.trigger.focus();
    const engine = overlay({ element: page.dialog, modal: true, restoreFocus: false });
    engine.toggle();
    expect(engine.isOpen()).toBe(true);
    engine.toggle();
    expect(document.activeElement).toBe(page.first);
    await frame();
  });

  it('does not rescue focus after a close callback prevents restoration', () => {
    const onBeforeRestoreFocus = vi.fn((event: { preventDefault(): void }) =>
      event.preventDefault()
    );
    page.trigger.focus();
    const engine = overlay({ element: page.dialog, modal: true, onBeforeRestoreFocus });
    engine.open();
    expect(document.activeElement).toBe(page.first);

    engine.close();

    expect(onBeforeRestoreFocus).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(page.first);
  });

  it('touches nothing before open', () => {
    overlay({ element: page.dialog, modal: true, mode: 'contained', container: page.frame });
    expect(page.dialog.parentElement).toBe(document.body);
    expect(page.dialog.attributes.length).toBe(1);
    expect(stack.size()).toBe(0);
  });
});
