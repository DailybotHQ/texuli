import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createInertRegistry,
  createLayerStack,
  createOverlay,
  type InertRegistry,
  type LayerStack,
} from '../src/index.ts';

/**
 * G75: the overlay engine re-shows raisable inert exemptions (the toast
 * region) in the top layer when an overlay opens, so they keep painting on
 * top. A dialog backdrop and an overlay opened inside a modal are exemptions
 * too, but must stay under the overlays opened after them: re-showing the
 * backdrop when a Select opened inside the dialog put it above the listbox and
 * the dialog, so every click landed on the backdrop.
 *
 * happy-dom has no top layer, so this models one: `showPopover` appends to an
 * ordered list (the browser orders the top layer by show time) and
 * `hidePopover` removes from it.
 */

let stack: LayerStack;
let inert: InertRegistry;
let topLayer: string[];

function topLayerElement(id: string): HTMLElement {
  const element = document.createElement('div');
  element.id = id;
  document.body.append(element);
  Object.assign(element, {
    showPopover() {
      if (topLayer.includes(id)) throw new DOMException('already open', 'InvalidStateError');
      topLayer.push(id);
    },
    hidePopover() {
      topLayer = topLayer.filter((entry) => entry !== id);
    },
  });
  const matches = element.matches.bind(element);
  element.matches = ((selector: string) =>
    selector === ':popover-open' ? topLayer.includes(id) : matches(selector)) as typeof matches;
  return element;
}

function overlay(element: HTMLElement, modal: boolean) {
  return createOverlay({
    element,
    modal,
    stack,
    inertRegistry: inert,
    presence: { reducedMotion: true },
  });
}

beforeEach(() => {
  document.body.replaceChildren();
  stack = createLayerStack();
  inert = createInertRegistry();
  topLayer = [];
});

afterEach(() => {
  inert.clear();
  stack.clear();
});

describe('top-layer order of exemptions (G75)', () => {
  it('keeps a Select opened inside a modal dialog above the dialog backdrop, and the toasts above all', () => {
    const toasts = topLayerElement('toasts');
    toasts.showPopover();
    inert.exempt({ element: toasts, label: 'toast-region' });
    const backdrop = topLayerElement('backdrop');
    const dialog = topLayerElement('dialog');
    const listbox = topLayerElement('listbox');

    // The dialog primitive: the backdrop shows, then the modal content.
    inert.exempt({ element: backdrop, label: 'dialog-backdrop', raise: false });
    backdrop.showPopover();
    overlay(dialog, true).open();
    expect(topLayer).toEqual(['backdrop', 'dialog', 'toasts']);

    // A Select inside the dialog opens: it must end above the backdrop.
    overlay(listbox, false).open();
    expect(topLayer).toEqual(['backdrop', 'dialog', 'listbox', 'toasts']);
  });

  it('never re-raises an overlay opened inside a modal above an overlay opened from it', () => {
    const dialog = topLayerElement('dialog');
    const popover = topLayerElement('popover');
    const picker = topLayerElement('picker');
    overlay(dialog, true).open();
    // The popover is live under the modal through an exemption the engine registers.
    overlay(popover, false).open();
    expect(inert.exemptions().map((entry) => entry.element)).toContain(popover);
    overlay(picker, false).open();
    expect(topLayer).toEqual(['dialog', 'popover', 'picker']);
  });

  it('still re-raises exemptions registered without `raise` (the R16 default)', () => {
    const region = topLayerElement('region');
    region.showPopover();
    const handle = inert.exempt({ element: region });
    expect(inert.exemptions()).toEqual([{ element: region }]);
    overlay(topLayerElement('dialog'), true).open();
    expect(topLayer).toEqual(['dialog', 'region']);
    handle.release();
    const quiet = topLayerElement('quiet');
    quiet.showPopover();
    inert.exempt({ element: quiet, raise: false });
    expect(inert.exemptions()).toEqual([{ element: quiet, raise: false }]);
    overlay(topLayerElement('sheet'), true).open();
    expect(topLayer.slice(-2)).toEqual(['quiet', 'sheet']);
  });
});
