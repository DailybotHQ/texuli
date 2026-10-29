import { getInertRegistry } from '@texuli/core/inert';
import { createOverlay } from '@texuli/core/overlay';
import { afterEach, describe, expect, it } from 'vitest';
import { registerBackdrop } from '../src/internal/backdrop.ts';

/**
 * G75: a dialog backdrop is an inert exemption (its pointer press closes the
 * dialog), but it must never be re-raised in the top layer when an overlay
 * opens from the dialog. The browser order is modeled: `showPopover` appends
 * to the top layer, `hidePopover` removes. The browser check is
 * tests/e2e/bugs-75-79.spec.ts.
 */

let topLayer: string[] = [];

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

afterEach(() => {
  getInertRegistry().clear();
  document.body.replaceChildren();
  topLayer = [];
});

describe('registerBackdrop (G75)', () => {
  it('registers a non-raising exemption, so a Select opened in the dialog ends above it', () => {
    const backdrop = topLayerElement('backdrop');
    const dialog = topLayerElement('dialog');
    const listbox = topLayerElement('listbox');
    let notify: (open: boolean) => void = () => {};
    const release = registerBackdrop(backdrop, {
      contained: false,
      container: null,
      label: 'dialog-backdrop',
      subscribeOpen: (listener) => {
        notify = listener;
        return () => {};
      },
    });
    expect(getInertRegistry().exemptions()).toEqual([
      { element: backdrop, label: 'dialog-backdrop', raise: false },
    ]);

    notify(true);
    const content = createOverlay({ element: dialog, modal: true });
    content.open();
    expect(topLayer).toEqual(['backdrop', 'dialog']);
    const select = createOverlay({ element: listbox });
    select.open();
    expect(topLayer).toEqual(['backdrop', 'dialog', 'listbox']);

    select.destroy();
    content.destroy();
    release();
    expect(getInertRegistry().exemptions()).toEqual([]);
  });
});
