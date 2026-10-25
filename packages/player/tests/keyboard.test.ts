import { fireEvent, render, screen } from '@testing-library/svelte';
import type { RenderCatalog } from '@texuli/catalog/render/renderer';
import { flushSync, tick } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { createPlayerCatalog } from '../src/catalog.ts';
import { sanitizeFrameOptions } from '../src/embed/protocol.ts';
import { frameStops, normalizeTabOrder } from '../src/keyboard.ts';
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
      { name: 'tabindex', kind: 'number' as const },
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
  'test-button': focusStub,
};

function button(label: string, extra: object = {}) {
  return { id: 'test-button', props: { label, ...extra } };
}

const page = {
  id: 'layout-page',
  props: { title: 'Keyboard page' },
  children: [
    { id: 'layout-card', props: { title: 'First card' }, children: [button('One')] },
    { id: 'layout-card', props: { title: 'Second card' }, children: [button('Two')] },
    { id: 'layout-card', props: { title: 'Third card' }, children: [button('Three')] },
  ],
};

async function paint(blueprint: unknown = page, extra: object = {}, last = 'Three') {
  const view = render(Player, {
    props: { blueprint, catalog: catalogWithButton(), tier: 'developer', loaders, ...extra },
  });
  await screen.findByRole('button', { name: last, hidden: true }, { timeout: 5000 });
  await tick();
  return view;
}

function key(target: Element, keyName: string, init: KeyboardEventInit = {}) {
  return fireEvent.keyDown(target, { key: keyName, bubbles: true, cancelable: true, ...init });
}

/** A frame's accessible name: `aria-label`, or the text its `aria-labelledby` points at. */
function frameName(frame: Element | null | undefined): string | null {
  if (!frame) return null;
  const labelledBy = frame.getAttribute('aria-labelledby');
  if (labelledBy) return frame.ownerDocument.getElementById(labelledBy)?.textContent ?? null;
  return frame.getAttribute('aria-label');
}

/** Tabbable elements in DOM order: what Tab visits. */
function tabbable(root: ParentNode): string[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]')
  )
    .filter((element) => element.getAttribute('tabindex') !== '-1')
    .filter((element) => !element.closest('[inert]'))
    .map((element) => element.textContent?.trim() ?? '');
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('player focus order', () => {
  it('keeps Tab order equal to reading order, after the skip link', async () => {
    const { container } = await paint();
    const order = tabbable(container);
    expect(order[0]).toBe('Skip past Blueprint preview');
    expect(order.slice(1)).toEqual(['One', 'Two', 'Three']);
  });

  it('normalizes a positive tabindex from painted content to 0', async () => {
    const { container } = await paint(
      { ...page, children: [button('Late'), button('Jumper', { tabindex: 5 })] },
      {},
      'Jumper'
    );
    const jumper = screen.getByRole('button', { name: 'Jumper' });
    expect(jumper.getAttribute('tabindex')).toBe('0');
    expect(tabbable(container).slice(1)).toEqual(['Late', 'Jumper']);

    jumper.setAttribute('tabindex', '9');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(jumper.getAttribute('tabindex')).toBe('0');
    const loose = document.createElement('div');
    loose.innerHTML = '<span tabindex="2"></span><span tabindex="-1"></span>';
    expect(normalizeTabOrder(loose)).toBe(1);
  });

  it('skip link moves focus past the whole frame', async () => {
    const { container } = await paint();
    const skip = screen.getByRole('link', { name: 'Skip past Blueprint preview' });
    await fireEvent.click(skip);
    const end = document.activeElement as HTMLElement;
    expect(end.classList.contains('tx-player__end')).toBe(true);
    expect(container.querySelector('[data-tx-player-surface]')?.contains(end)).toBe(false);
  });
});

describe('frame navigation', () => {
  it('marks layout frames as programmatic focus stops in reading order', async () => {
    const { container } = await paint();
    const frames = frameStops(container);
    expect(frames.map((frame) => frameName(frame) ?? frame.tagName)).toEqual([
      'MAIN',
      'First card',
      'Second card',
      'Third card',
    ]);
    expect(frames.every((frame) => frame.getAttribute('tabindex') === '-1')).toBe(true);
  });

  it('F6 and Shift+F6 cycle frames from anywhere inside the surface', async () => {
    const { container } = await paint();
    const frames = frameStops(container);
    const one = screen.getByRole('button', { name: 'One' });
    one.focus();
    await key(one, 'F6');
    expect(document.activeElement).toBe(frames[2]);
    await key(document.activeElement as Element, 'F6', { shiftKey: true });
    expect(document.activeElement).toBe(frames[1]);
    frames[3]?.focus();
    await key(frames[3] as Element, 'F6');
    expect(document.activeElement).toBe(frames[0]);
  });

  it('arrows, Home and End move between frames only when a frame has focus', async () => {
    const { container } = await paint();
    const frames = frameStops(container);
    frames[1]?.focus();
    await key(frames[1] as Element, 'ArrowDown');
    expect(document.activeElement).toBe(frames[2]);
    await key(frames[2] as Element, 'End');
    expect(document.activeElement).toBe(frames[3]);
    // Home and End stay among sibling frames (the three cards); ArrowLeft reaches the page.
    await key(frames[3] as Element, 'Home');
    expect(document.activeElement).toBe(frames[1]);
    await key(frames[1] as Element, 'ArrowLeft');
    expect(document.activeElement).toBe(frames[0]);

    const two = screen.getByRole('button', { name: 'Two' });
    two.focus();
    const event = new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    });
    two.dispatchEvent(event);
    expect(document.activeElement).toBe(two);
    expect(event.defaultPrevented).toBe(false);
  });

  it('Escape walks outward: control → its frame → player label, without trapping', async () => {
    const { container } = await paint();
    const two = screen.getByRole('button', { name: 'Two' });
    two.focus();
    await key(two, 'Escape');
    expect(frameName(document.activeElement)).toBe('Second card');
    await key(document.activeElement as Element, 'Escape');
    expect(document.activeElement).toBe(container.querySelector('.tx-player__label'));
  });

  it('leaves Escape inside a modal surface, or one already handled, to the component', async () => {
    await paint({ ...page, children: [button('Modal', { dialog: true }), button('Three')] });
    const inner = screen.getByRole('button', { name: 'Modal' });
    inner.focus();
    await key(inner, 'Escape');
    expect(document.activeElement).toBe(inner);

    const three = screen.getByRole('button', { name: 'Three' });
    three.focus();
    const handled = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    handled.preventDefault();
    three.dispatchEvent(handled);
    expect(document.activeElement).toBe(three);
  });
});

describe('inert and focus rescue', () => {
  it('makes a non-active player surface inert, and skeletons are always inert', async () => {
    const { container } = await paint(page, { active: false });
    const surface = container.querySelector('[data-tx-player-surface]');
    expect(surface?.hasAttribute('inert')).toBe(true);
    expect(tabbable(container)).toEqual(['Skip past Blueprint preview']);

    render(Player, {
      props: {
        blueprint: { id: 'layout-page', props: { title: 'Loading' } },
        loaders: { 'layout-page': () => new Promise(() => {}) },
        loadTimeoutMs: 0,
      },
    });
    expect(document.querySelector('[data-tx-player-skeleton]')?.hasAttribute('inert')).toBe(true);
  });

  it('lets a host frame mark the player non-active through the frame protocol', () => {
    expect(sanitizeFrameOptions({ active: false })).toEqual({ active: false });
    expect(sanitizeFrameOptions({ active: 'no' })).toEqual({});
  });

  it('moves focus to the notice when an update removes the focused node', async () => {
    const target = document.createElement('div');
    document.body.append(target);
    const mounted = mountPlayer(target, {
      blueprint: {
        format: LOCAL_STATE_FORMAT,
        version: 1,
        state: { note: { type: 'string', initial: 'Fine' } },
        blueprint: {
          id: 'layout-page',
          props: { title: 'Rescue', description: { $state: 'note' } },
          children: [button('Focused')],
        },
      },
      catalog: catalogWithButton(),
      tier: 'developer',
      loaders,
    });
    const focused = await screen.findByRole('button', { name: 'Focused' });
    focused.focus();
    mounted.setState('note', '<b>refused</b>');
    flushSync();
    await tick();
    expect(document.activeElement?.classList.contains('tx-player__notice')).toBe(true);
    mounted.dispose();
  });
});
