// @vitest-environment happy-dom
/**
 * The builder outline's pointer drag runs on the shared @texuli/drag engine
 * (T-migrate-builder): a drag whose pointer capture fails keeps following the
 * pointer through the document (the engine's capture fallback), and
 * pointercancel cancels. The hand-rolled drag only listened on the pressed
 * element, so these moves were lost.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CatalogTreeInput } from '@texuli/catalog/render/renderer';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Outline from '../src/components/builder/outline/Outline.svelte';

const tree: CatalogTreeInput = {
  id: 'layout-page',
  props: { title: 'Fictional page' },
  children: [
    { id: 'layout-card', props: { title: 'Box' }, children: [] },
    { id: 'blocks-text', props: { block: { type: 'text', markdown: 'one' } } },
  ],
};

let app: ReturnType<typeof mount> | null = null;
afterEach(() => {
  if (app) unmount(app);
  app = null;
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

function pointer(type: string, target: EventTarget, x: number, y: number) {
  const event = new PointerEvent(type, {
    pointerId: 9,
    pointerType: 'touch',
    isPrimary: true,
    button: 0,
    clientX: x,
    clientY: y,
    bubbles: true,
  });
  target.dispatchEvent(event);
  flushSync();
}

describe('builder outline drag on the shared engine', () => {
  it('follows document moves when capture fails, and pointercancel cancels', () => {
    vi.spyOn(HTMLElement.prototype, 'setPointerCapture').mockImplementation(() => {
      throw new DOMException('No active pointer', 'NotFoundError');
    });
    const target = document.createElement('div');
    document.body.append(target);
    app = mount(Outline, {
      target,
      props: {
        tree,
        selected: [],
        labelOf: (id: string) => id,
        canContain: (id: string) => id !== 'blocks-text',
        onselect: () => {},
        onmove: () => null,
        onremove: () => {},
      },
    });
    flushSync();
    const handle = target.querySelector<HTMLElement>('[data-outline-row="1"] .outline__handle');
    const row = target.querySelector<HTMLElement>('[data-builder-row="1"]');
    if (!handle || !row) throw new Error('outline rows not rendered');
    pointer('pointerdown', handle, 10, 10);
    pointer('pointermove', document, 10, 30);
    expect(row.classList.contains('outline__item--dragging')).toBe(true);
    pointer('pointercancel', document, 10, 30);
    expect(row.classList.contains('outline__item--dragging')).toBe(false);
    expect(target.querySelector('[data-outline-status]')?.textContent).toBe('Move cancelled.');
  });

  it('owns no drag threshold or hit-testing of its own', () => {
    const source = readFileSync(
      resolve('apps/website/src/components/builder/outline/Outline.svelte'),
      'utf8'
    );
    expect(source).toContain("from '@texuli/drag/gesture'");
    expect(source).toContain("from '@texuli/drag/collision'");
    expect(source).not.toMatch(/DRAG_THRESHOLD|elementFromPoint|Math\.hypot/);
  });
});
