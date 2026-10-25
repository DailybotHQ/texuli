import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import type { RenderCatalog } from '@texuli/catalog/render/renderer';
import { flushSync, tick } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { createPlayerCatalog } from '../src/catalog.ts';
import { frameStops, navigableFrames, parentFrame } from '../src/keyboard.ts';
import { mountPlayer } from '../src/mount.ts';
import Player from '../src/Player.svelte';
import { LOCAL_STATE_FORMAT } from '../src/state/bind.ts';

const layoutLoader = async () =>
  import('../src/layouts/ContentLayout.svelte').then((m) => m.default);
const focusStub = async () => import('./FocusStub.svelte').then((m) => m.default);

/** The player catalog plus a test-only focusable id. */
function catalogWithButton(): RenderCatalog {
  const base = createPlayerCatalog();
  const spec = {
    id: 'test-button',
    label: 'Test button',
    props: [
      { name: 'label', kind: 'string' as const },
      { name: 'dialog', kind: 'boolean' as const },
    ],
    emit: ['developer'] as const,
  };
  return {
    get: (id) => (id === 'test-button' ? spec : base.get(id)),
    allows: (id, tier) => (id === 'test-button' ? true : (base.allows?.(id, tier) ?? false)),
  };
}

const loaders = {
  'layout-page': layoutLoader,
  'layout-card': layoutLoader,
  'layout-grid': layoutLoader,
  'test-button': focusStub,
};
const card = (title: string, children: unknown[] = []) => ({
  id: 'layout-card',
  props: { title },
  children,
});
const button = (label: string, extra: object = {}) => ({
  id: 'test-button',
  props: { label, ...extra },
});

/** page > [card A > [card A1, card A2], grid > [card G1, card G2], card B] */
const tree = {
  id: 'layout-page',
  props: { title: 'Focus page' },
  children: [
    card('A', [card('A1', [button('in A1')]), card('A2')]),
    { id: 'layout-grid', props: { columns: 2 }, children: [card('G1'), card('G2')] },
    card('B', [button('in B')]),
  ],
};

async function paint(blueprint: unknown = tree, extra: object = {}) {
  const view = render(Player, {
    props: { blueprint, catalog: catalogWithButton(), tier: 'developer', loaders, ...extra },
  });
  await waitFor(
    () => {
      expect(view.container.querySelector('[data-tx-player-skeleton]')).toBeNull();
      expect(screen.getAllByRole('button', { hidden: true }).length).toBeGreaterThan(0);
    },
    { timeout: 5000 }
  );
  await tick();
  return view;
}

function key(target: Element, name: string, init: KeyboardEventInit = {}) {
  return fireEvent.keyDown(target, { key: name, bubbles: true, cancelable: true, ...init });
}

function named(container: Element, title: string): HTMLElement {
  const frame = frameStops(container).find((candidate) => {
    const id = candidate.getAttribute('aria-labelledby');
    return id && container.querySelector(`[id="${id}"]`)?.textContent === title;
  });
  if (!frame) throw new Error(`No frame ${title}`);
  return frame;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('roving the frame tree the grammar containers form', () => {
  it('knows each frame’s parent frame', async () => {
    const { container } = await paint();
    const surface = container.querySelector('[data-tx-player-surface]') as HTMLElement;
    const page = frameStops(container)[0] as HTMLElement;
    expect(parentFrame(page, surface)).toBeNull();
    expect(parentFrame(named(container, 'A1'), surface)).toBe(named(container, 'A'));
    expect(
      parentFrame(named(container, 'G2'), surface)?.classList.contains('tx-player-layout--grid')
    ).toBe(true);
  });

  it('ArrowDown and ArrowUp move among siblings only, stopping at the ends', async () => {
    const { container } = await paint();
    const a = named(container, 'A');
    a.focus();
    await key(a, 'ArrowDown');
    expect(document.activeElement?.classList.contains('tx-player-layout--grid')).toBe(true);
    await key(document.activeElement as Element, 'ArrowDown');
    expect(document.activeElement).toBe(named(container, 'B'));
    // Last sibling: ArrowDown does nothing (no wrap, no jump into another level).
    await key(document.activeElement as Element, 'ArrowDown');
    expect(document.activeElement).toBe(named(container, 'B'));
    const a2 = named(container, 'A2');
    a2.focus();
    await key(a2, 'ArrowUp');
    expect(document.activeElement).toBe(named(container, 'A1'));
  });

  it('ArrowRight enters the first child frame and ArrowLeft returns to the parent', async () => {
    const { container } = await paint();
    const page = frameStops(container)[0] as HTMLElement;
    page.focus();
    await key(page, 'ArrowRight');
    expect(document.activeElement).toBe(named(container, 'A'));
    await key(document.activeElement as Element, 'ArrowRight');
    expect(document.activeElement).toBe(named(container, 'A1'));
    await key(document.activeElement as Element, 'ArrowLeft');
    expect(document.activeElement).toBe(named(container, 'A'));
    await key(document.activeElement as Element, 'ArrowLeft');
    expect(document.activeElement).toBe(page);
    // A frame with no child frames: ArrowRight is left to the browser.
    const b = named(container, 'B');
    b.focus();
    const event = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true,
    });
    b.dispatchEvent(event);
    expect(document.activeElement).toBe(b);
    expect(event.defaultPrevented).toBe(false);
  });

  it('swaps ArrowLeft and ArrowRight in right-to-left content', async () => {
    const { container } = await paint(tree, { dir: 'rtl' });
    const page = frameStops(container)[0] as HTMLElement;
    page.focus();
    await key(page, 'ArrowLeft');
    expect(document.activeElement).toBe(named(container, 'A'));
    await key(document.activeElement as Element, 'ArrowRight');
    expect(document.activeElement).toBe(page);
  });

  it('keeps F6 and the Escape walk flat and outward, as fixture 07 pinned', async () => {
    const { container } = await paint();
    const inner = screen.getByRole('button', { name: 'in A1' });
    inner.focus();
    await key(inner, 'Escape');
    expect(document.activeElement).toBe(named(container, 'A1'));
    await key(document.activeElement as Element, 'Escape');
    expect(document.activeElement).toBe(container.querySelector('.tx-player__label'));
    inner.focus();
    await key(inner, 'F6');
    // F6 goes to the next frame in reading order after A1, which is A2.
    expect(document.activeElement).toBe(named(container, 'A2'));
  });
});

describe('focus containment', () => {
  it('never targets a frame inside an inert subtree', async () => {
    const { container } = await paint();
    const grid = container.querySelector('.tx-player-layout--grid') as HTMLElement;
    // A component's modal surface makes the rest inert; simulate that on the grid.
    grid.setAttribute('inert', '');
    expect(navigableFrames(container)).not.toContain(named(container, 'G1'));
    const a = named(container, 'A');
    a.focus();
    await key(a, 'ArrowDown');
    expect(document.activeElement).toBe(named(container, 'B'));
    const a2 = named(container, 'A2');
    a2.focus();
    await key(a2, 'F6');
    expect(document.activeElement).toBe(named(container, 'B'));
  });

  it('player keys never move focus out of the player', async () => {
    const { container } = await paint();
    const frames = navigableFrames(container);
    const last = frames[frames.length - 1] as HTMLElement;
    last.focus();
    await key(last, 'F6');
    expect(container.contains(document.activeElement)).toBe(true);
    const label = container.querySelector('.tx-player__label') as HTMLElement;
    await key(frames[0] as Element, 'Escape');
    expect(document.activeElement).toBe(label);
  });
});

describe('predictable focus after a repaint', () => {
  it('moves focus to the nearest surviving frame when the focused node disappears', async () => {
    const target = document.createElement('div');
    document.body.append(target);
    const mounted = mountPlayer(target, {
      blueprint: {
        format: LOCAL_STATE_FORMAT,
        version: 1,
        state: { modal: { type: 'boolean', initial: false } },
        blueprint: {
          id: 'layout-page',
          props: { title: 'Repaint' },
          children: [card('Holder', [button('Vanishing', { dialog: { $state: 'modal' } })])],
        },
      },
      catalog: catalogWithButton(),
      tier: 'developer',
      loaders,
    });
    const vanishing = await screen.findByRole('button', { name: 'Vanishing' }, { timeout: 5000 });
    vanishing.focus();
    // The bound prop swaps the stub's button for a dialog: the focused node is gone.
    expect(mounted.setState('modal', true)).toBe(true);
    flushSync();
    await tick();
    expect(vanishing.isConnected).toBe(false);
    expect(document.activeElement).toBe(named(target, 'Holder'));
    mounted.dispose();
  });
});
