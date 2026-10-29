import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import type { RenderCatalog } from '@texuli/catalog/render/renderer';
import { flushSync, tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createAnnouncer,
  formatAnnouncement,
  paintAnnouncement,
  selectionAnnouncement,
} from '../src/announcements.ts';
import { createPlayerCatalog } from '../src/catalog.ts';
import { sanitizeFrameOptions } from '../src/embed/protocol.ts';
import { frameStops, navigableFrames, normalizeTabOrder, parentFrame } from '../src/keyboard.ts';
import { DEFAULT_PLAYER_LABELS } from '../src/labels.ts';
import { PLAYER_LOADERS } from '../src/loaders.ts';
import { mountPlayer } from '../src/mount.ts';
import Player from '../src/Player.svelte';
import { applySelection, EMPTY_SELECTION, pruneSelection } from '../src/selection.ts';
import { LOCAL_STATE_FORMAT } from '../src/state/bind.ts';
import { scenario } from './scenario.ts';

describe('keyboard', () => {
  async function paint(blueprint: unknown = page, extra: object = {}, last = 'Three') {
    const view = render(Player, {
      props: { blueprint, catalog: catalogWithButton(), tier: 'developer', loaders, ...extra },
    });
    await screen.findByRole('button', { name: last, hidden: true }, { timeout: 5000 });
    await tick();
    return view;
  }

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
    it('focus order: Tab follows reading order after the skip link; positive tabindex is normalized', async () => {
      await scenario('keeps Tab order equal to reading order, after the skip link', async () => {
        const { container } = await paint();
        const order = tabbable(container);
        expect(order[0]).toBe('Skip past Blueprint preview');
        expect(order.slice(1)).toEqual(['One', 'Two', 'Three']);
      });
      await scenario('normalizes a positive tabindex from painted content to 0', async () => {
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
      await scenario('skip link moves focus past the whole frame', async () => {
        const { container } = await paint();
        const skip = screen.getByRole('link', { name: 'Skip past Blueprint preview' });
        await fireEvent.click(skip);
        const end = document.activeElement as HTMLElement;
        expect(end.classList.contains('tx-player__end')).toBe(true);
        expect(container.querySelector('[data-tx-player-surface]')?.contains(end)).toBe(false);
      });
    });
  });

  describe('frame navigation', () => {
    it('frame navigation: focus stops, F6, arrows, Home and End, and the Escape walk that never traps', async () => {
      await scenario(
        'marks layout frames as programmatic focus stops in reading order',
        async () => {
          const { container } = await paint();
          const frames = frameStops(container);
          expect(frames.map((frame) => frameName(frame) ?? frame.tagName)).toEqual([
            'MAIN',
            'First card',
            'Second card',
            'Third card',
          ]);
          expect(frames.every((frame) => frame.getAttribute('tabindex') === '-1')).toBe(true);
        }
      );
      await scenario('F6 and Shift+F6 cycle frames from anywhere inside the surface', async () => {
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
      await scenario(
        'arrows, Home and End move between frames only when a frame has focus',
        async () => {
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
        }
      );
      await scenario(
        'Escape walks outward: control → its frame → player label, without trapping',
        async () => {
          const { container } = await paint();
          const two = screen.getByRole('button', { name: 'Two' });
          two.focus();
          await key(two, 'Escape');
          expect(frameName(document.activeElement)).toBe('Second card');
          await key(document.activeElement as Element, 'Escape');
          expect(document.activeElement).toBe(container.querySelector('.tx-player__label'));
        }
      );
      await scenario(
        'leaves Escape inside a modal surface, or one already handled, to the component',
        async () => {
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
        }
      );
    });
  });

  describe('inert and focus rescue', () => {
    it('inert surfaces and focus rescue', async () => {
      await scenario(
        'makes a non-active player surface inert, and skeletons are always inert',
        async () => {
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
          expect(document.querySelector('[data-tx-player-skeleton]')?.hasAttribute('inert')).toBe(
            true
          );
        }
      );
      await scenario(
        'lets a host frame mark the player non-active through the frame protocol',
        async () => {
          expect(sanitizeFrameOptions({ active: false })).toEqual({ active: false });
          expect(sanitizeFrameOptions({ active: 'no' })).toEqual({});
        }
      );
      await scenario(
        'moves focus to the notice when an update removes the focused node',
        async () => {
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
        }
      );
    });
  });
});

describe('focus management', () => {
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
    it('roving the frame tree: parents, siblings, children, RTL and the flat F6/Escape walk', async () => {
      await scenario('knows each frame’s parent frame', async () => {
        const { container } = await paint();
        const surface = container.querySelector('[data-tx-player-surface]') as HTMLElement;
        const page = frameStops(container)[0] as HTMLElement;
        expect(parentFrame(page, surface)).toBeNull();
        expect(parentFrame(named(container, 'A1'), surface)).toBe(named(container, 'A'));
        expect(
          parentFrame(named(container, 'G2'), surface)?.classList.contains('tx-player-layout--grid')
        ).toBe(true);
      });
      await scenario(
        'ArrowDown and ArrowUp move among siblings only, stopping at the ends',
        async () => {
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
        }
      );
      await scenario(
        'ArrowRight enters the first child frame and ArrowLeft returns to the parent',
        async () => {
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
        }
      );
      await scenario('swaps ArrowLeft and ArrowRight in right-to-left content', async () => {
        const { container } = await paint(tree, { dir: 'rtl' });
        const page = frameStops(container)[0] as HTMLElement;
        page.focus();
        await key(page, 'ArrowLeft');
        expect(document.activeElement).toBe(named(container, 'A'));
        await key(document.activeElement as Element, 'ArrowRight');
        expect(document.activeElement).toBe(page);
      });
      await scenario(
        'keeps F6 and the Escape walk flat and outward, as fixture 07 pinned',
        async () => {
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
        }
      );
    });
  });

  describe('focus containment', () => {
    it('focus containment skips inert frames and keeps player keys inside', async () => {
      await scenario('never targets a frame inside an inert subtree', async () => {
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
      await scenario('player keys never move focus out of the player', async () => {
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
});

describe('selection', () => {
  async function paint(extra: Record<string, unknown> = {}) {
    const onSelectionChange = vi.fn();
    const view = render(Player, {
      props: {
        blueprint: tree,
        catalog: catalogWithButton(),
        tier: 'developer',
        loaders,
        selectable: true,
        onSelectionChange,
        ...extra,
      },
    });
    await waitFor(
      () => {
        expect(view.container.querySelector('[data-tx-player-skeleton]')).toBeNull();
        expect(screen.getByRole('button', { name: 'Act', hidden: true })).toBeTruthy();
      },
      { timeout: 5000 }
    );
    await tick();
    const frame = (path: string) =>
      view.container.querySelector<HTMLElement>(`[data-tx-player-path="${path}"]`) as HTMLElement;
    const selected = () =>
      Array.from(view.container.querySelectorAll('[data-tx-player-selected]')).map((element) =>
        element.getAttribute('data-tx-player-path')
      );
    return { ...view, frame, selected, onSelectionChange };
  }

  const layoutLoader = async () =>
    import('../src/layouts/ContentLayout.svelte').then((m) => m.default);
  const focusStub = async () => import('./FocusStub.svelte').then((m) => m.default);

  function catalogWithButton(): RenderCatalog {
    const base = createPlayerCatalog();
    const spec = {
      id: 'test-button',
      label: 'Test button',
      props: [{ name: 'label', kind: 'string' as const }],
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

  /** page > [card A > [A1, A2], grid > [G1, G2], card B > button] */
  const tree = {
    id: 'layout-page',
    props: { title: 'Selection page' },
    children: [
      card('A', [card('A1'), card('A2')]),
      { id: 'layout-grid', props: { columns: 2 }, children: [card('G1'), card('G2')] },
      card('B', [{ id: 'test-button', props: { label: 'Act' } }]),
    ],
  };
  const PATH = {
    page: '0',
    A: '0.children.0',
    A1: '0.children.0.children.0',
    grid: '0.children.1',
    G1: '0.children.1.children.0',
    B: '0.children.2',
  };

  function key(target: Element, name: string, init: KeyboardEventInit = {}) {
    return fireEvent.keyDown(target, { key: name, bubbles: true, cancelable: true, ...init });
  }

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  describe('selection model', () => {
    const siblings = [PATH.A, PATH.grid, PATH.B];

    it('selection model replaces, toggles and ranges among siblings, and prunes', () => {
      // replaces, toggles and ranges among siblings
      {
        const one = applySelection(EMPTY_SELECTION, PATH.A, 'replace', siblings);
        expect(one).toEqual({ selected: [PATH.A], anchor: PATH.A });
        expect(applySelection(one, PATH.B, 'range', siblings).selected).toEqual(siblings);
        const toggled = applySelection(one, PATH.B, 'toggle', siblings);
        expect(toggled.selected).toEqual([PATH.A, PATH.B]);
        expect(applySelection(toggled, PATH.A, 'toggle', siblings).selected).toEqual([PATH.B]);
      }
      // never ranges across levels: an anchor outside the siblings starts fresh
      {
        const anchored = applySelection(EMPTY_SELECTION, PATH.A1, 'replace', [PATH.A1]);
        expect(applySelection(anchored, PATH.B, 'range', siblings)).toEqual({
          selected: [PATH.B],
          anchor: PATH.B,
        });
      }
      // prunes paths that are no longer frames, keeping the state object when nothing changes
      {
        const state = { selected: [PATH.A, PATH.B], anchor: PATH.B };
        expect(pruneSelection(state, new Set([PATH.A, PATH.B]))).toBe(state);
        expect(pruneSelection(state, new Set([PATH.A]))).toEqual({
          selected: [PATH.A],
          anchor: null,
        });
      }
    });
  });

  describe('selecting painted frames', () => {
    it('selecting painted frames: off by default, click, modifier clicks, controls untouched', async () => {
      await scenario('is off by default: clicks select nothing and report nothing', async () => {
        const { frame, selected, onSelectionChange, container } = await paint({
          selectable: false,
        });
        await fireEvent.click(frame(PATH.A));
        expect(selected()).toEqual([]);
        expect(onSelectionChange).not.toHaveBeenCalled();
        // The one announcer says only the paint result, never a selection.
        expect(container.querySelector('[data-tx-player-announcer]')?.textContent).not.toContain(
          'selected'
        );
      });
      await scenario(
        'click selects one frame, visibly and announced; another click replaces it',
        async () => {
          const { frame, selected, onSelectionChange, container } = await paint();
          await fireEvent.click(frame(PATH.A));
          expect(selected()).toEqual([PATH.A]);
          expect(onSelectionChange).toHaveBeenLastCalledWith([PATH.A]);
          const announcer = () =>
            container.querySelector('[data-tx-player-announcer]')?.textContent?.trim();
          expect(announcer()).toBe('A selected');
          await fireEvent.click(frame(PATH.B));
          expect(selected()).toEqual([PATH.B]);
          expect(announcer()).toBe('B selected');
          await fireEvent.click(frame(PATH.A), { ctrlKey: true });
          expect(announcer()).toBe('2 selected');
        }
      );
      await scenario(
        'Ctrl or Cmd click toggles; Shift click selects a sibling range, never across levels',
        async () => {
          const { frame, selected } = await paint();
          await fireEvent.click(frame(PATH.A));
          await fireEvent.click(frame(PATH.B), { ctrlKey: true });
          expect(selected()).toEqual([PATH.A, PATH.B]);
          await fireEvent.click(frame(PATH.A), { metaKey: true });
          expect(selected()).toEqual([PATH.B]);
          await fireEvent.click(frame(PATH.A));
          await fireEvent.click(frame(PATH.B), { shiftKey: true });
          expect(selected()).toEqual([PATH.A, PATH.grid, PATH.B]);
          await fireEvent.click(frame(PATH.A1), { shiftKey: true });
          expect(selected()).toEqual([PATH.A1]);
        }
      );
      await scenario('never hijacks a control inside a painted component', async () => {
        const { selected, onSelectionChange } = await paint();
        const act = screen.getByRole('button', { name: 'Act' });
        const clicked = vi.fn();
        act.addEventListener('click', clicked);
        await fireEvent.click(act);
        expect(clicked).toHaveBeenCalledTimes(1);
        expect(selected()).toEqual([]);
        expect(onSelectionChange).not.toHaveBeenCalled();
      });
    });
  });

  describe('keyboard selection, consistent with frame roving', () => {
    it('keyboard selection is consistent with frame roving', async () => {
      await scenario(
        'Space selects, Shift+Arrow extends among siblings, Escape clears before walking out',
        async () => {
          const { frame, selected, container } = await paint();
          frame(PATH.A).focus();
          await key(frame(PATH.A), ' ');
          expect(selected()).toEqual([PATH.A]);
          await key(frame(PATH.A), 'ArrowDown', { shiftKey: true });
          expect(document.activeElement).toBe(frame(PATH.grid));
          expect(selected()).toEqual([PATH.A, PATH.grid]);
          await key(frame(PATH.grid), 'ArrowDown', { shiftKey: true });
          expect(selected()).toEqual([PATH.A, PATH.grid, PATH.B]);
          await key(frame(PATH.B), 'Escape');
          expect(selected()).toEqual([]);
          expect(document.activeElement).toBe(frame(PATH.B));
          await key(frame(PATH.B), 'Escape');
          expect(document.activeElement).toBe(container.querySelector('.tx-player__label'));
        }
      );
      await scenario('plain arrows still rove without selecting; Ctrl+Space toggles', async () => {
        const { frame, selected } = await paint();
        frame(PATH.A).focus();
        await key(frame(PATH.A), 'ArrowDown');
        expect(document.activeElement).toBe(frame(PATH.grid));
        expect(selected()).toEqual([]);
        await key(frame(PATH.grid), ' ', { ctrlKey: true });
        await key(frame(PATH.grid), 'ArrowDown');
        await key(frame(PATH.B), ' ', { ctrlKey: true });
        expect(selected()).toEqual([PATH.grid, PATH.B]);
      });
    });
  });

  describe('containment', () => {
    it('containment and host control: inert frames, inactive players, host selection, state-only', async () => {
      await scenario('skips inert frames in ranges and ignores clicks inside them', async () => {
        const { frame, selected } = await paint();
        frame(PATH.grid).setAttribute('inert', '');
        await fireEvent.click(frame(PATH.G1));
        expect(selected()).toEqual([]);
        await fireEvent.click(frame(PATH.A));
        await fireEvent.click(frame(PATH.B), { shiftKey: true });
        expect(selected()).toEqual([PATH.A, PATH.B]);
      });
      await scenario('an inactive player takes no selection', async () => {
        const { frame, selected, onSelectionChange } = await paint({ active: false });
        await fireEvent.click(frame(PATH.A));
        expect(selected()).toEqual([]);
        expect(onSelectionChange).not.toHaveBeenCalled();
      });
    });
  });

  describe('host control and side effects', () => {
    it('paints the host selection and drops paths that are not frames', async () => {
      const { selected, onSelectionChange } = await paint({
        selection: [PATH.grid, '0.children.9', PATH.B],
      });
      expect(selected()).toEqual([PATH.grid, PATH.B]);
      expect(onSelectionChange).toHaveBeenLastCalledWith([PATH.grid, PATH.B]);
    });

    it('selection is state only: no state change, re-validation, network or intent', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      const onStateChange = vi.fn();
      const onDiagnostics = vi.fn();
      const { frame } = await paint({ onStateChange, onDiagnostics });
      expect(onDiagnostics).toHaveBeenCalledTimes(1);
      await fireEvent.click(frame(PATH.A));
      await fireEvent.click(frame(PATH.B), { shiftKey: true });
      frame(PATH.B).focus();
      await key(frame(PATH.B), 'Escape');
      expect(onStateChange).not.toHaveBeenCalled();
      expect(onDiagnostics).toHaveBeenCalledTimes(1);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });
});

describe('skip link', () => {
  // Vitest does not apply imported CSS, so the real stylesheet is injected.
  const css = readFileSync(join(process.cwd(), 'packages/player/src/player.css'), 'utf8');

  const layoutLoader = async () =>
    import('../src/layouts/ContentLayout.svelte').then((m) => m.default);

  /** The declarations of the first rule whose selector list is exactly `selector`. */
  function rule(selector: string): Record<string, string> {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`));
    if (!match?.[1]) throw new Error(`No rule for ${selector}`);
    return Object.fromEntries(
      match[1]
        .split(';')
        .map((declaration) => declaration.trim())
        .filter(Boolean)
        .map((declaration) => {
          const index = declaration.indexOf(':');
          return [declaration.slice(0, index).trim(), declaration.slice(index + 1).trim()];
        })
    );
  }

  afterEach(() => {
    for (const style of document.head.querySelectorAll('style[data-skip-test]')) style.remove();
  });

  describe('skip link visibility', () => {
    it('the skip link is invisible until focused and stays the first Tab stop', async () => {
      await scenario('has no visible box while unfocused, wherever the player sits', async () => {
        const style = document.createElement('style');
        style.dataset.skipTest = '';
        style.textContent = css;
        document.head.append(style);
        render(Player, {
          props: {
            blueprint: { id: 'layout-page', props: { title: 'Page' } },
            loaders: { 'layout-page': layoutLoader },
          },
        });
        await screen.findByRole('heading', { level: 1, name: 'Page' }, { timeout: 5000 });
        const skip = screen.getByRole('link', { name: 'Skip past Blueprint preview' });
        const computed = getComputedStyle(skip);
        expect(computed.clipPath).toBe('inset(50%)');
        // The stylesheet sizes it with logical properties.
        expect(computed.getPropertyValue('inline-size')).toBe('1px');
        expect(computed.getPropertyValue('block-size')).toBe('1px');
        expect(computed.overflow).toBe('hidden');
        // No offset trick: nothing moves the box onto host content above the player.
        expect(computed.transform === '' || computed.transform === 'none').toBe(true);
      });
      await scenario('declares a 1px clipped box unfocused and a normal box on focus', async () => {
        const hidden = rule('.tx-player__skip');
        expect(hidden).toMatchObject({
          'inline-size': '1px',
          'block-size': '1px',
          overflow: 'hidden',
          'clip-path': 'inset(50%)',
        });
        expect(hidden.transform).toBeUndefined();
        const shown = rule('.tx-player__skip:focus,\n.tx-player__skip:focus-visible');
        expect(shown).toMatchObject({
          'inline-size': 'auto',
          'block-size': 'auto',
          overflow: 'visible',
          'clip-path': 'none',
        });
      });
      await scenario('stays the first Tab stop', async () => {
        const { container } = render(Player, {
          props: {
            blueprint: { id: 'layout-page', props: { title: 'Page' } },
            loaders: { 'layout-page': layoutLoader },
          },
        });
        await screen.findByRole('heading', { level: 1, name: 'Page' }, { timeout: 5000 });
        const first = container.querySelector('a[href], button, [tabindex]:not([tabindex="-1"])');
        expect(first?.classList.contains('tx-player__skip')).toBe(true);
      });
    });
  });
});

describe('motion', () => {
  async function paint(extra: Record<string, unknown> = {}, children: unknown[] = []) {
    const view = render(Player, {
      props: { blueprint: page(children), loaders: PLAYER_LOADERS, ...extra },
    });
    await screen.findByRole('heading', { level: 1, name: 'Motion' }, { timeout: 5000 });
    await tick();
    return view;
  }

  // Vitest runs from the repository root, and does not apply imported CSS.
  const css = readFileSync(join(process.cwd(), 'packages/player/src/player.css'), 'utf8');
  /** The stylesheet without comments, for rule-level checks. */
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');

  const page = (children: unknown[] = []) => ({
    id: 'layout-page',
    props: { title: 'Motion' },
    children,
  });

  /** A controllable stand-in for `window.matchMedia('(prefers-reduced-motion: reduce)')`. */
  function mockReducedMotion(initial: boolean) {
    const listeners = new Set<() => void>();
    const media = {
      matches: initial,
      media: '(prefers-reduced-motion: reduce)',
      addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
    };
    vi.spyOn(window, 'matchMedia').mockImplementation(() => media as unknown as MediaQueryList);
    return {
      set(matches: boolean) {
        media.matches = matches;
        for (const listener of listeners) listener();
      },
    };
  }

  afterEach(() => {
    vi.restoreAllMocks();
    for (const style of document.head.querySelectorAll('style[data-motion-test]')) style.remove();
    document.body.innerHTML = '';
  });

  describe('motion policy in the stylesheet', () => {
    it('the stylesheet times every motion with tokens and zeroes them under reduced motion', () => {
      // times every player-owned transition and animation with the motion tokens
      {
        const declarations = [
          ...rules.matchAll(/(?:^|[;{\s])(transition|animation)(?:-duration)?\s*:\s*([^;}]+)/g),
        ];
        expect(declarations.length).toBeGreaterThan(0);
        for (const [, property, value] of declarations) {
          if (value?.includes('0s !important')) continue; // the reduced-motion override itself
          // A literal duration may only appear as a var() fallback.
          const outsideVars = value?.replace(/var\([^)]*\)/g, '') ?? '';
          expect(outsideVars, `${property}: ${value}`).not.toMatch(/\d+m?s\b/);
          expect(value, `${property}: ${value}`).toMatch(/var\(--tx-motion-(fast|base|slow)/);
        }
      }
      // scopes the reduced-motion override to the player and zeroes every motion token
      {
        const blocks = [
          ...rules.matchAll(/([^{}]*\{[^{}]*--tx-motion-base:\s*0ms !important[^{}]*\})/g),
        ].map((m) => m[1] ?? '');
        expect(blocks).toHaveLength(2);
        for (const block of blocks) {
          const selectors = (block.split('{')[0] ?? '')
            .split(',')
            .map((selector) => selector.trim());
          for (const selector of selectors) expect(selector.startsWith('.tx-player')).toBe(true);
          for (const token of [
            '--tx-motion-fast: 0ms',
            '--tx-motion-slow: 0ms',
            'animation-duration: 0s',
            'animation-delay: 0s',
            'transition-duration: 0s',
            'transition-delay: 0s',
            'scroll-behavior: auto',
          ]) {
            expect(block).toContain(token);
          }
        }
        expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.tx-player,/);
      }
    });
  });

  describe('motion policy on the player root', () => {
    it('the player root follows and overrides reduced motion and never animates blueprint motion', async () => {
      await scenario('follows prefers-reduced-motion live in auto mode', async () => {
        const media = mockReducedMotion(false);
        const { container } = await paint();
        const root = container.querySelector('[data-tx-player]') as HTMLElement;
        expect(root.hasAttribute('data-tx-motion')).toBe(false);
        media.set(true);
        await tick();
        expect(root.getAttribute('data-tx-motion')).toBe('reduce');
        media.set(false);
        await tick();
        expect(root.hasAttribute('data-tx-motion')).toBe(false);
      });
      await scenario('reduces motion when the host asks, whatever the user setting', async () => {
        mockReducedMotion(false);
        const { container } = await paint({ motion: 'reduce' });
        expect(container.querySelector('[data-tx-player]')?.getAttribute('data-tx-motion')).toBe(
          'reduce'
        );
      });
      await scenario(
        'zeroes the motion tokens and durations for everything painted inside',
        async () => {
          const style = document.createElement('style');
          style.dataset.motionTest = '';
          style.textContent = `${css}\n.motion-probe { transition: opacity var(--tx-motion-base, 200ms) ease; animation-duration: 3s; }`;
          document.head.append(style);
          const { container } = await paint({ motion: 'reduce' }, [
            { id: 'layout-card', props: { title: 'Card' } },
          ]);
          await waitFor(() =>
            expect(container.querySelector('.tx-player-layout--card')).not.toBeNull()
          );
          const card = container.querySelector('.tx-player-layout--card') as HTMLElement;
          card.classList.add('motion-probe');
          const computed = getComputedStyle(card);
          expect(computed.getPropertyValue('--tx-motion-base').trim()).toBe('0ms');
          expect(computed.getPropertyValue('--tx-motion-fast').trim()).toBe('0ms');
          expect(computed.animationDuration).toBe('0s');
          expect(computed.transitionDuration).toBe('0s');
        }
      );
      await scenario('never animates blueprint-declared motion in the document flow', async () => {
        const { container } = render(Player, {
          props: {
            blueprint: {
              id: 'layout-deck',
              props: { title: 'Motion deck' },
              children: [
                {
                  id: 'deck-slide',
                  props: { slideId: 'one', title: 'Fades', transition: 'fade-up' },
                  children: [
                    {
                      id: 'blocks-text',
                      props: {
                        block: {
                          type: 'list',
                          items: [{ text: 'Revealed' }],
                          step: 1,
                          reveal: 'fade-up',
                        },
                      },
                    },
                  ],
                },
              ],
            },
            loaders: PLAYER_LOADERS,
          },
        });
        expect(await screen.findByText('Revealed', {}, { timeout: 5000 })).toBeTruthy();
        expect(
          container.querySelector(
            '[data-transition], [data-reveal], [style*="animation"], [style*="transition"]'
          )
        ).toBeNull();
        expect(
          screen.getByText('Revealed').closest('[hidden], [aria-hidden="true"], [inert]')
        ).toBeNull();
      });
      await scenario('carries the motion option across the frame protocol', async () => {
        expect(sanitizeFrameOptions({ motion: 'reduce' })).toEqual({ motion: 'reduce' });
        expect(sanitizeFrameOptions({ motion: 'wild' })).toEqual({});
      });
    });
  });
});

describe('announcements', () => {
  const layoutLoader = async () =>
    import('../src/layouts/ContentLayout.svelte').then((m) => m.default);
  const loaders = { 'layout-page': layoutLoader, 'layout-card': layoutLoader };
  const page = (children: unknown[] = [], props: Record<string, unknown> = { title: 'Page' }) => ({
    id: 'layout-page',
    props,
    children,
  });
  const card = (title: string) => ({ id: 'layout-card', props: { title } });

  function announcer(container: Element): string {
    return container.querySelector('[data-tx-player-announcer]')?.textContent?.trim() ?? '';
  }

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('announcements model', () => {
    it('announcements model: templates, one paint message, selection counts and per-channel dedupe', () => {
      expect(formatAnnouncement('{count} of {total}', { count: 2 })).toBe('2 of {total}');
      // builds one polite paint message from its parts
      {
        const labels = DEFAULT_PLAYER_LABELS;
        expect(
          paintAnnouncement({ frames: 3, placeholders: 0, preview: false, status: null }, labels)
        ).toBe('Content ready: 3 sections.');
        expect(
          paintAnnouncement({ frames: 1, placeholders: 2, preview: true, status: 'Active' }, labels)
        ).toBe(
          `Content ready: 1 sections. 2 parts could not be shown. ${labels.previewWarning} Status: Active.`
        );
      }
      // names one selected frame, counts several, and accepts the plain-word label
      {
        const labels = DEFAULT_PLAYER_LABELS;
        expect(selectionAnnouncement([], labels)).toBe('');
        expect(selectionAnnouncement(['Revenue'], labels)).toBe('Revenue selected');
        expect(selectionAnnouncement(['A', 'B'], labels)).toBe('2 selected');
        expect(selectionAnnouncement(['A', 'B'], { ...labels, selected: 'seleccionados' })).toBe(
          '2 seleccionados'
        );
      }
      // dedupes per channel until reset
      {
        const a = createAnnouncer();
        expect(a.announce({ politeness: 'polite', text: 'One' })).toBe('One');
        expect(a.announce({ politeness: 'polite', text: 'One' })).toBeNull();
        expect(a.announce({ politeness: 'assertive', text: 'One' })).toBe('One');
        expect(a.announce({ politeness: 'polite', text: '' })).toBeNull();
        a.reset('polite');
        expect(a.announce({ politeness: 'polite', text: 'One' })).toBe('One');
      }
    });
  });

  describe('the player speaks through one polite region', () => {
    it('one polite region announces placeholders, previews and status once, leaving refusals to the alert', async () => {
      await scenario(
        'has exactly one live region; badge, skeleton and preview warning are not live',
        async () => {
          let release: (value: unknown) => void = () => {};
          const gate = new Promise((resolve) => {
            release = resolve;
          });
          const { container } = render(Player, {
            props: {
              blueprint: page([card('Pending')]),
              invalidPolicy: 'preview',
              loaders: { 'layout-page': layoutLoader, 'layout-card': () => gate },
            },
          });
          await screen.findByRole('heading', { level: 1, name: 'Page' }, { timeout: 5000 });
          expect(container.querySelector('[data-tx-player-skeleton]')).not.toBeNull();
          const live = Array.from(
            container.querySelectorAll('[aria-live], [role="status"], [role="alert"]')
          );
          expect(live).toEqual([container.querySelector('[data-tx-player-announcer]')]);
          expect(live[0]?.getAttribute('aria-live')).toBe('polite');
          expect(live[0]?.getAttribute('aria-atomic')).toBe('true');
          // Nothing is spoken while a node still loads.
          expect(announcer(container)).toBe('');
          release(await layoutLoader());
          await waitFor(() => expect(announcer(container)).toBe('Content ready: 2 sections.'));
        }
      );
      await scenario(
        'announces unresolved placeholders, the preview warning and a non-draft status',
        async () => {
          const { container } = render(Player, {
            props: {
              blueprint: page([{ id: 'not-a-component', props: {} }]),
              invalidPolicy: 'preview',
              status: 'active',
              loaders,
            },
          });
          await waitFor(() =>
            expect(announcer(container)).toBe(
              `Content ready: 1 sections. 1 parts could not be shown. ${DEFAULT_PLAYER_LABELS.previewWarning}`
            )
          );
          // An invalid draft shows "Invalid draft", not the host status, so no status part.
          render(Player, { props: { blueprint: page(), status: 'active', loaders } });
          await waitFor(() =>
            expect(
              Array.from(document.querySelectorAll('[data-tx-player-announcer]'))
                .at(-1)
                ?.textContent?.trim()
            ).toBe('Content ready: 1 sections. Status: Active.')
          );
        }
      );
      await scenario(
        'leaves a refusal to the notice: one assertive alert, a silent polite region',
        async () => {
          const { container } = render(Player, {
            props: {
              blueprint: { id: 'layout-doc', props: { href: 'javascript:alert(1)' } },
              loaders,
            },
          });
          await tick();
          expect(screen.getAllByRole('alert')).toHaveLength(1);
          expect(announcer(container)).toBe('');
        }
      );
      await scenario(
        'says nothing again when a state update repaints the same structure',
        async () => {
          const target = document.createElement('div');
          document.body.append(target);
          const mounted = mountPlayer(target, {
            blueprint: {
              format: LOCAL_STATE_FORMAT,
              version: 1,
              state: { title: { type: 'string', initial: 'First' } },
              blueprint: page([card('Card')], { title: { $state: 'title' } }),
            },
            loaders,
          });
          await waitFor(() => expect(announcer(target)).toBe('Content ready: 2 sections.'));
          const region = target.querySelector('[data-tx-player-announcer]') as HTMLElement;
          const changes: MutationRecord[] = [];
          const observer = new MutationObserver((records) => changes.push(...records));
          observer.observe(region, { childList: true, characterData: true, subtree: true });
          mounted.setState('title', 'Second');
          flushSync();
          await tick();
          expect(await screen.findByRole('heading', { level: 1, name: 'Second' })).toBeTruthy();
          expect(changes).toEqual([]);
          observer.disconnect();
          mounted.dispose();
        }
      );
      await scenario('speaks again after a refusal clears, even with the same text', async () => {
        const target = document.createElement('div');
        document.body.append(target);
        const mounted = mountPlayer(target, {
          blueprint: {
            format: LOCAL_STATE_FORMAT,
            version: 1,
            state: { note: { type: 'string', initial: 'Fine' } },
            blueprint: page([], { title: 'Page', description: { $state: 'note' } }),
          },
          loaders,
        });
        await waitFor(() => expect(announcer(target)).toBe('Content ready: 1 sections.'));
        mounted.setState('note', '<b>refused</b>');
        flushSync();
        await tick();
        expect(announcer(target)).toBe('');
        expect(target.querySelector('[role="alert"]')).not.toBeNull();
        mounted.setState('note', 'Fine again');
        flushSync();
        await waitFor(() => expect(announcer(target)).toBe('Content ready: 1 sections.'));
        mounted.dispose();
      });
      await scenario('uses the host’s localized templates', async () => {
        const { container } = render(Player, {
          props: {
            blueprint: page([card('Uno')]),
            loaders,
            labels: { painted: 'Contenido listo: {frames} secciones.' },
          },
        });
        await waitFor(() => expect(announcer(container)).toBe('Contenido listo: 2 secciones.'));
      });
    });
  });
});
