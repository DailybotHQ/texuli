import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFocusScope } from '../src/focus-scope/index.ts';
import { getInertRegistry, resetInertRegistry } from '../src/inert/index.ts';
import { createLayerStack } from '../src/layer-stack/index.ts';
import { createOverlayCore } from '../src/overlay/core-entry.ts';
import { ALL_OVERLAY_FEATURES, createOverlay } from '../src/overlay/index.ts';
import { createPortal } from '../src/portal/index.ts';
import { positionFloating } from '../src/position-dom/index.ts';
import { lockScroll } from '../src/scroll-lock/scroll-lock.ts';

function element(tag = 'div', parent: Element = document.body): HTMLElement {
  const node = document.createElement(tag);
  parent.append(node);
  return node;
}

beforeEach(() => {
  document.body.replaceChildren();
  resetInertRegistry();
});
afterEach(() => resetInertRegistry());

describe('createOverlayCore features', () => {
  it('throws when an option needs the feature, and 3 related cases', () => {
    // throws when an option needs the feature
    for (const [feature, extra] of [
      ['focusScope', { modal: true, inertOutside: false, lockScroll: false }],
      ['focusScope', { trapFocus: true }],
      ['inert', { inertOutside: true }],
      ['scrollLock', { lockScroll: true }],
      ['position', { anchor: 'trigger' }],
      ['portal', { portal: 'body' }],
    ] as const) {
      const options = {
        element: element(),
        stack: createLayerStack(),
        ...(extra as Record<string, unknown>),
      };
      if ('anchor' in options) options.anchor = element('button');
      if ('portal' in options) options.portal = document.body;
      expect(() => createOverlayCore(options as never), String(feature)).toThrow(
        new RegExp(`"${feature}" feature`)
      );
    }
    resetInertRegistry();
    document.body.replaceChildren();
    resetInertRegistry();
    {
      // creates a positioned overlay with only the position feature
      const trigger = element('button');
      const floating = element();
      const overlay = createOverlayCore(
        { element: floating, anchor: trigger, stack: createLayerStack() },
        { position: positionFloating }
      );
      overlay.open();
      expect(overlay.isOpen()).toBe(true);
      overlay.close();
      overlay.destroy();
    }
    resetInertRegistry();
    document.body.replaceChildren();
    resetInertRegistry();
    {
      // refuses setAnchor without the position feature
      const overlay = createOverlayCore({ element: element(), stack: createLayerStack() });
      expect(() => overlay.setAnchor(element('button'))).toThrow(/"position" feature/);
      overlay.destroy();
    }
    resetInertRegistry();
    document.body.replaceChildren();
    resetInertRegistry();
    {
      // dismisses on Escape with no feature at all
      const onOpenChange = vi.fn();
      const overlay = createOverlayCore({
        element: element(),
        stack: createLayerStack(),
        onOpenChange,
      });
      overlay.open();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(onOpenChange).toHaveBeenLastCalledWith(false);
      overlay.destroy();
    }
  });
  it('keeps a non-modal overlay live inside an open modal without the inert feature, and 3 related cases', () => {
    {
      // keeps a non-modal overlay live inside an open modal without the inert feature
      const stack = createLayerStack();
      const outside = element('button');
      const dialog = element();
      const modal = createOverlay({ element: dialog, modal: true, stack });
      modal.open();
      expect(outside.hasAttribute('inert')).toBe(true);

      // A tooltip-like overlay, outside the dialog in the DOM, composed without inert.
      const tip = element();
      const tooltip = createOverlayCore({ element: tip, stack }, { position: positionFloating });
      tooltip.open();
      expect(getInertRegistry().isExempt(tip)).toBe(true);
      expect(tip.hasAttribute('inert')).toBe(false);
      tooltip.destroy();
      expect(getInertRegistry().isExempt(tip)).toBe(false);
      modal.destroy();
    }
    resetInertRegistry();
    document.body.replaceChildren();
    resetInertRegistry();
    {
      // touches no inert registry when the page has no modal
      const overlay = createOverlayCore({ element: element(), stack: createLayerStack() });
      overlay.open();
      expect((globalThis as Record<string, unknown>).__TEXULI_INERT_REGISTRY_V1__).toBeUndefined();
      overlay.destroy();
    }
    resetInertRegistry();
    document.body.replaceChildren();
    resetInertRegistry();
    {
      // runs a modal with the focus, inert and scroll features it is given
      const outside = element('button');
      const dialog = element();
      const inside = element('button', dialog);
      const overlay = createOverlayCore(
        { element: dialog, modal: true, stack: createLayerStack() },
        { focusScope: createFocusScope, inert: getInertRegistry, scrollLock: lockScroll }
      );
      overlay.open();
      expect(outside.hasAttribute('inert')).toBe(true);
      expect(document.activeElement).toBe(inside);
      overlay.destroy();
      expect(outside.hasAttribute('inert')).toBe(false);
    }
    resetInertRegistry();
    document.body.replaceChildren();
    resetInertRegistry();
    // keeps createOverlay as the all-features overlay
    expect(Object.keys(ALL_OVERLAY_FEATURES).sort()).toEqual([
      'focusScope',
      'inert',
      'portal',
      'position',
      'scrollLock',
    ]);
    expect(ALL_OVERLAY_FEATURES.portal).toBe(createPortal);
  });

  describe('teardown', () => {
    it('opens nothing for an element that already left the document, and 2 related cases', () => {
      {
        // opens nothing for an element that already left the document
        const stack = createLayerStack();
        const scope = getInertRegistry().inertOutside(element());
        const detached = document.createElement('div');
        const overlay = createOverlayCore(
          { element: detached, stack },
          { position: positionFloating }
        );
        expect(() => overlay.open()).not.toThrow();
        expect(overlay.isOpen()).toBe(false);
        expect(stack.size()).toBe(0);
        expect(getInertRegistry().isExempt(detached)).toBe(false);
        overlay.destroy();
        scope.release();
      }
      resetInertRegistry();
      document.body.replaceChildren();
      resetInertRegistry();
      {
        // does not throw when an open runs after the environment lost Element
        const stack = createLayerStack();
        const scope = getInertRegistry().inertOutside(element());
        const floating = element();
        const overlay = createOverlayCore({ element: floating, stack });
        vi.stubGlobal('Element', undefined);
        try {
          expect(() => overlay.open()).not.toThrow();
          expect(overlay.isOpen()).toBe(false);
        } finally {
          vi.unstubAllGlobals();
        }
        overlay.destroy();
        scope.release();
      }
      resetInertRegistry();
      document.body.replaceChildren();
      resetInertRegistry();
      {
        // unmounting mid-open releases once and a second destroy is a no-op
        const stack = createLayerStack();
        const scope = getInertRegistry().inertOutside(element());
        const floating = element();
        const overlay = createOverlayCore({ element: floating, stack });
        overlay.open();
        expect(getInertRegistry().isExempt(floating)).toBe(true);
        floating.remove();
        expect(() => {
          overlay.destroy();
          overlay.destroy();
          overlay.close();
          overlay.open();
        }).not.toThrow();
        expect(getInertRegistry().isExempt(floating)).toBe(false);
        expect(stack.size()).toBe(0);
        scope.release();
      }
    });
  });
});
