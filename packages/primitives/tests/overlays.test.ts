/// <reference types="node" />
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { getInertRegistry, resetInertRegistry } from '@texuli/core/inert';
import { flushSync, tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LONG_PRESS_MS } from '../src/context-menu/index.ts';
import ComboboxHarness from './ComboboxHarness.svelte';
import ContextMenuFixture from './context-menu-fixture.svelte';
import DialogFixture from './dialog-fixture.svelte';
import DialogMountedOpen from './fixtures/DialogMountedOpen.svelte';
import MenuHarness from './fixtures/MenuHarness.svelte';
import MenuChildTriggerFixture from './menu-child-trigger-fixture.svelte';
import MenubarFixture from './menubar-fixture.svelte';
import NavigationMenuFixture from './navigation-menu-fixture.svelte';
import PortalHarness from './PortalHarness.svelte';
import PopoverFixture from './popover-fixture.svelte';
import Fixture from './sheet-fixture.svelte';
import ToastContainedFixture from './toast-contained-fixture.svelte';
import ToastFixture from './toast-fixture.svelte';
import TooltipFixture from './tooltip-fixture.svelte';

// Overlay primitives: fixed findings and the dismissal, focus and inert edge
// cases the behavior suite (tests/behavior) does not drive.

describe('dialog-contained-focus', () => {
  /*
   * FIX-dialog-contained-focus: a dialog mounted already open keeps its initial
   * focus (the portal moves the node before the controller opens), and in
   * contained mode the backdrop stays in the container, below the content,
   * instead of entering the top layer over it.
   */

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
    getInertRegistry().clear();
  });

  it('mounted open: focuses inside the content after the portal moved it', async () => {
    for (const kind of ['dialog', 'sheet', 'alert'] as const) {
      // Moving a focused node blurs it in real browsers, so the portal must move
      // the content BEFORE initial focus: record where the input is when focused.
      const focusedWhere: string[] = [];
      const focus = HTMLElement.prototype.focus;
      const spy = vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function (
        this: HTMLElement,
        options?: FocusOptions
      ) {
        if (this.getAttribute('aria-label') === 'Search commands') {
          const portal = this.closest('[data-dialog-portal]');
          focusedWhere.push(portal?.parentElement === document.body ? 'portaled' : 'in place');
        }
        focus.call(this, options);
      });
      render(DialogMountedOpen, { props: { kind } });
      const input = await screen.findByRole('textbox', { name: 'Search commands' });
      // An alert dialog starts on Cancel, the least destructive action.
      const initial = kind === 'alert' ? screen.getByRole('button', { name: 'Cancel' }) : input;
      await waitFor(() => expect(document.activeElement, kind).toBe(initial));
      if (kind !== 'alert') {
        // The content was portaled (to body) and is still focused there.
        expect(input.closest('[data-dialog-portal]')?.parentElement, kind).toBe(document.body);
        expect(focusedWhere.length, kind).toBeGreaterThan(0);
        expect(
          focusedWhere.every((where) => where === 'portaled'),
          kind
        ).toBe(true);
      }
      spy.mockRestore();
      cleanup();
      getInertRegistry().clear();
    }
  });

  it('contained mode: keeps the backdrop out of the top layer, in the container, below the content', async () => {
    for (const kind of ['dialog', 'alert', 'sheet'] as const) {
      render(DialogMountedOpen, { props: { contained: true, kind } });
      const input = await screen.findByRole('textbox', { name: 'Search commands' });
      const backdrop = screen.getByTestId('backdrop');
      const container = document.querySelector('[data-container]') as HTMLElement;
      expect(container.contains(backdrop), kind).toBe(true);
      expect(container.contains(input), kind).toBe(true);
      // Never shown as a popover (that would put it in the top layer).
      expect(backdrop.hasAttribute('popover'), kind).toBe(false);
      expect(backdrop.getAttribute('data-contained'), kind).toBe('');
      const initial = kind === 'alert' ? screen.getByRole('button', { name: 'Cancel' }) : input;
      await waitFor(() => expect(document.activeElement, kind).toBe(initial));
      cleanup();
      getInertRegistry().clear();
    }
  });
});

describe('dialog', () => {
  afterEach(() => getInertRegistry().clear());

  describe('Dialog', () => {
    it('restores focus through the preventable close autofocus callback', async () => {
      const onCloseAutoFocus = vi.fn((event: { preventDefault(): void }) => event.preventDefault());
      render(DialogFixture, { props: { onCloseAutoFocus } });
      const trigger = screen.getByRole('button', { name: 'Open settings' });
      fireEvent.click(trigger);
      await screen.findByRole('dialog', { name: 'Settings' });
      const preferredFocus = screen.getByRole('button', { name: 'Preferred focus' });
      expect(document.activeElement).toBe(preferredFocus);

      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull());
      expect(onCloseAutoFocus).toHaveBeenCalledOnce();
      expect(document.activeElement).not.toBe(trigger);
    });

    it('keeps a contained dialog and its inert scope inside the supplied frame', async () => {
      const { container } = render(DialogFixture, { props: { contained: true } });
      const trigger = screen.getByRole('button', { name: 'Open settings' });
      fireEvent.click(trigger);

      const dialog = await screen.findByRole('dialog', { name: 'Settings' });
      const frame = container.querySelector('[data-dialog-frame]');
      expect(frame?.contains(dialog)).toBe(true);
      expect(frame?.querySelector('[data-dialog-overlay]')).toBeTruthy();
      const frameAction = screen.getByRole('button', { name: 'Frame action' });
      const outsideAction = screen.getByRole('button', { name: 'Outside action' });
      expect(
        getInertRegistry()
          .inertElements()
          .some((element) => element.contains(frameAction))
      ).toBe(true);
      expect(
        getInertRegistry()
          .inertElements()
          .some((element) => element.contains(outsideAction))
      ).toBe(false);
      expect(document.documentElement.style.overflow).toBe('');
    });
  });
});

describe('sheet', () => {
  beforeEach(() => {
    // happy-dom has no layout: give every element a 300 x 400 box.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ width: 300, height: 400 })
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    getInertRegistry().clear();
  });

  /** Drag a drawer along y by `distance`, holding still before release (no fling). */
  async function dragY(element: Element, distance: number, start: Element = element) {
    const pointer = { pointerId: 7, pointerType: 'touch', clientX: 100 };
    await fireEvent.pointerDown(start, { ...pointer, clientY: 100 });
    await fireEvent.pointerMove(element, { ...pointer, clientY: 100 + distance });
    await fireEvent.pointerMove(element, { ...pointer, clientY: 100 + distance });
    await fireEvent.pointerUp(element, { ...pointer, clientY: 100 + distance });
  }

  describe('Panel dismissal options (FIX-sheet-dismiss-outside)', () => {
    async function openPanel(props: Record<string, unknown>) {
      render(Fixture, { props: { kind: 'panel', ...props } });
      const trigger = screen.getByRole('button', { name: 'Show details' });
      trigger.focus();
      await fireEvent.click(trigger);
      await screen.findByRole('dialog', { name: 'Order details' });
      return { trigger, page: screen.getByRole('button', { name: 'Page action' }) };
    }

    it('dismissOutside: an outside press closes it, a press on the trigger does not', async () => {
      const { trigger, page } = await openPanel({ dismissOutside: true });
      await fireEvent.pointerDown(trigger);
      await tick();
      expect(screen.getByRole('dialog', { name: 'Order details' })).toBeTruthy();
      await fireEvent.pointerDown(page);
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });

    it('dismissOutside: focus moving outside closes it', async () => {
      const { page } = await openPanel({ dismissOutside: true });
      await waitFor(() =>
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Copy id' }))
      );
      page.focus();
      await fireEvent.focusIn(page);
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });

    it('closeOnEscape: Escape anywhere closes it; without it, only Escape from inside', async () => {
      const { page } = await openPanel({ closeOnEscape: true });
      page.focus();
      await fireEvent.keyDown(page, { key: 'Escape' });
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });

    it('by default an outside press, outside focus and Escape on the page leave it open', async () => {
      const { page } = await openPanel({});
      await fireEvent.pointerDown(page);
      page.focus();
      await fireEvent.focusIn(page);
      await fireEvent.keyDown(page, { key: 'Escape' });
      await tick();
      expect(screen.getByRole('dialog', { name: 'Order details' })).toBeTruthy();
    });
  });

  describe('Drawer (swipe to dismiss, snap points)', () => {
    it('dismisses on a quick flick, but not after the finger held still', async () => {
      render(Fixture, { props: { kind: 'drawer', open: true } });
      const drawer = await screen.findByRole('dialog', { name: 'Cart' });
      const pointer = { pointerId: 5, pointerType: 'touch', clientX: 100 };
      const flick = async (hold: number) => {
        await fireEvent.pointerDown(drawer, { ...pointer, clientY: 100 });
        await fireEvent.pointerMove(drawer, { ...pointer, clientY: 120 });
        await new Promise((resolve) => setTimeout(resolve, 20));
        await fireEvent.pointerMove(drawer, { ...pointer, clientY: 160 });
        if (hold) await new Promise((resolve) => setTimeout(resolve, hold));
        await fireEvent.pointerUp(drawer, { ...pointer, clientY: 160 });
      };
      await flick(150);
      expect(screen.getByRole('dialog', { name: 'Cart' })).toBe(drawer);
      await flick(0);
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });

    it('mirrors the drag for a top drawer and ignores drags that start in a field', async () => {
      render(Fixture, { props: { kind: 'drawer', side: 'top', open: true } });
      const drawer = await screen.findByRole('dialog', { name: 'Cart' });
      await dragY(drawer, 260, screen.getByRole('textbox', { name: 'Coupon' }));
      expect(screen.getByRole('dialog', { name: 'Cart' })).toBe(drawer);
      await dragY(drawer, 260);
      expect(screen.getByRole('dialog', { name: 'Cart' })).toBe(drawer);
      await dragY(drawer, -260);
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });

    it('does not press the button a drag ended on', async () => {
      const { container } = render(Fixture, {
        props: { kind: 'drawer', open: true, snapPoints: [0.5, 1] },
      });
      const drawer = await screen.findByRole('dialog', { name: 'Cart' });
      const checkout = screen.getByRole('button', { name: 'Checkout' });
      await dragY(drawer, -180, checkout);
      await fireEvent.click(checkout);
      expect(container.querySelector('[data-pressed]')?.textContent).toBe('0');
      await fireEvent.click(checkout);
      expect(container.querySelector('[data-pressed]')?.textContent).toBe('1');
    });
  });

  describe('ResponsiveModal', () => {
    const stubMedia = (matches: boolean) =>
      vi.stubGlobal('matchMedia', (query: string) => ({
        matches,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));

    it('is a bottom drawer on phones', async () => {
      stubMedia(true);
      render(Fixture, { props: { kind: 'responsive', open: true } });
      const dialog = await screen.findByRole('dialog', { name: 'Share' });
      await waitFor(() => expect(dialog.dataset.side).toBe('bottom'));
      expect(dialog.getAttribute('aria-modal')).toBe('true');
      await dragY(dialog, 260);
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });
  });
});

describe('popover', () => {
  describe('Popover', () => {
    describe('initialFocus', () => {
      async function open(props: { modal?: boolean; focusTarget?: 'search' | 'none' | 'outside' }) {
        render(PopoverFixture, { props });
        fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
        return screen.findByRole('dialog', { name: 'Filter tasks' });
      }

      it('falls back to the first control when the target resolves to nothing', async () => {
        await open({ focusTarget: 'none' });
        await waitFor(() =>
          expect(document.activeElement).toBe(
            screen.getByRole('checkbox', { name: 'Assigned to me' })
          )
        );
        cleanup();
        await open({ modal: true, focusTarget: 'none' });
        await waitFor(() =>
          expect(document.activeElement).toBe(
            screen.getByRole('checkbox', { name: 'Assigned to me' })
          )
        );
      });

      it('ignores a target outside the content', async () => {
        await open({ focusTarget: 'outside' });
        await waitFor(() =>
          expect(document.activeElement).toBe(
            screen.getByRole('checkbox', { name: 'Assigned to me' })
          )
        );
      });
    });
  });
});

describe('tooltip', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  describe('Tooltip compound primitive', () => {
    it('opens on a touch long press and closes when the press ends', async () => {
      vi.useFakeTimers();
      render(TooltipFixture);
      const trigger = screen.getByRole('button', { name: 'First action' });

      await fireEvent.pointerDown(trigger, { pointerType: 'touch' });
      await vi.advanceTimersByTimeAsync(499);
      expect(screen.queryByRole('tooltip')).toBeNull();
      await vi.advanceTimersByTimeAsync(1);
      expect(screen.getByRole('tooltip').textContent).toBe('First hint');
      await fireEvent.pointerUp(trigger, { pointerType: 'touch' });
      expect(screen.queryByRole('tooltip')).toBeNull();
    });

    it('does not open a disabled tooltip and restores the bound open state after dismissal', async () => {
      render(TooltipFixture);
      const disabled = screen.getByRole('button', { name: 'Disabled action' });
      await fireEvent.focusIn(disabled);
      expect(screen.queryByRole('tooltip')).toBeNull();

      const trigger = screen.getByRole('button', { name: 'First action' });
      await fireEvent.focusIn(trigger);
      expect(screen.getByText('open', { selector: '[data-open-state]' })).toBeTruthy();
      await fireEvent.keyDown(document, { key: 'Escape', bubbles: true });
      expect(screen.getByText('closed', { selector: '[data-open-state]' })).toBeTruthy();
    });
  });
});

describe('menu', () => {
  const trigger = () => screen.getByRole('button', { name: 'Actions' });
  const focused = () => {
    const active = document.activeElement as HTMLElement | null;
    return active?.textContent?.trim() ?? '';
  };
  const key = async (key: string, target: Element = document.activeElement ?? document.body) => {
    await fireEvent.keyDown(target, { key });
    await tick();
  };

  async function openWith(keyName = 'Enter', props: Record<string, unknown> = {}) {
    const log: string[] = [];
    const view = render(MenuHarness, { props: { log, ...props } });
    trigger().focus();
    await key(keyName, trigger());
    await screen.findByRole('menu');
    return { ...view, log };
  }

  describe('Menu keyboard (APG menu)', () => {
    it('keeps the menu open when onSelect prevents the default', async () => {
      const { log } = await openWith('Enter', { keepOpenOnRename: true });
      await key('Enter');
      expect(log).toContain('rename');
      expect(screen.getByRole('menu')).toBeTruthy();
    });
  });

  describe('Menu checkbox and radio items', () => {
    it('reports mixed, and checks a mixed item on the next choice', async () => {
      await openWith();
      const mixed = screen.getByRole('menuitemcheckbox', { name: 'Mixed' });
      expect(mixed.getAttribute('aria-checked')).toBe('mixed');
      expect(mixed.getAttribute('data-state')).toBe('indeterminate');
      await fireEvent.click(mixed);
      await tick();
      expect(mixed.getAttribute('aria-checked')).toBe('true');
    });
  });

  describe('Menu submenus', () => {
    async function toShare() {
      const opened = await openWith();
      await key('s');
      expect(focused()).toBe('Share');
      return opened;
    }

    it('closes every level when a submenu item runs', async () => {
      const { log } = await toShare();
      await key('ArrowRight');
      await waitFor(() => expect(focused()).toBe('Email'));
      await key('ArrowDown');
      await key('Enter');
      await waitFor(() => expect(screen.queryAllByRole('menu')).toHaveLength(0));
      expect(log).toContain('link');
      expect(document.activeElement).toBe(trigger());
    });

    it('closes an open submenu when the highlight moves to another item', async () => {
      await toShare();
      await key('ArrowRight');
      await waitFor(() => expect(screen.getAllByRole('menu')).toHaveLength(2));
      await key('ArrowLeft');
      await key('ArrowDown');
      expect(focused()).toBe('Grid off');
      expect(screen.getAllByRole('menu')).toHaveLength(1);
    });
  });
});

describe('menu-child-trigger', () => {
  /*
   * A trigger rendered through a `child` snippet must register its element with
   * the menu, like the built-in one: the menu anchors to it and returns focus to
   * it when it closes (FIX-menu-trigger-child). Menu.Trigger backs Menu,
   * DropdownMenu and Menubar; ContextMenu.Trigger backs ContextMenu.
   */

  afterEach(cleanup);

  const actions = () => screen.getByRole('button', { name: 'Actions' });
  const region = () => screen.getByRole('button', { name: 'Canvas' });
  async function key(name: string, target: Element = document.activeElement ?? document.body) {
    await fireEvent.keyDown(target, { key: name });
    await tick();
  }

  describe('Menu.Trigger with a child snippet', () => {
    it('renders the custom element with the trigger props and links it to the menu', async () => {
      render(MenuChildTriggerFixture);
      expect(actions().classList.contains('custom-trigger')).toBe(true);
      expect(actions().getAttribute('aria-haspopup')).toBe('menu');
      actions().focus();
      await key('Enter', actions());
      const menu = await screen.findByRole('menu');
      expect(actions().getAttribute('aria-controls')).toBe(menu.id);
      expect(menu.getAttribute('aria-labelledby')).toBe(actions().id);
    });

    it('returns focus to the custom trigger on Escape', async () => {
      render(MenuChildTriggerFixture);
      actions().focus();
      await key('Enter', actions());
      await screen.findByRole('menu');
      expect(document.activeElement?.textContent?.trim()).toBe('Rename');
      await key('Escape');
      await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
      expect(document.activeElement).toBe(actions());
    });
  });

  describe('ContextMenu.Trigger with a child snippet', () => {
    it('registers the custom element, so focus returns to it on Escape', async () => {
      render(MenuChildTriggerFixture);
      region().focus();
      await fireEvent.contextMenu(region());
      await screen.findByRole('menu');
      expect(document.activeElement?.textContent?.trim()).toBe('Paste');
      await key('Escape');
      await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
      expect(document.activeElement).toBe(region());
    });
  });
});

describe('context-menu', () => {
  afterEach(() => vi.useRealTimers());

  const region = () => screen.getByTestId('region');

  async function rightClick(target: Element, x = 40, y = 30) {
    await fireEvent.pointerDown(target, {
      button: 2,
      pointerType: 'mouse',
      clientX: x,
      clientY: y,
    });
    return fireEvent.contextMenu(target, { button: 2, clientX: x, clientY: y });
  }

  describe('ContextMenu', () => {
    it('moves to a new right click while open, and a plain press on the region closes it', async () => {
      render(ContextMenuFixture);
      await rightClick(region(), 10, 10);
      const menu = await screen.findByRole('menu');
      await rightClick(region(), 120, 80);
      expect(screen.getByRole('menu')).toBe(menu);
      await fireEvent.pointerDown(region(), { button: 0, pointerType: 'mouse' });
      await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    });

    it('opens on a touch long press, and the lift is not a click', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      const clicks = vi.fn();
      render(ContextMenuFixture);
      region().addEventListener('click', clicks);
      const touch = {
        pointerId: 9,
        pointerType: 'touch',
        isPrimary: true,
        clientX: 50,
        clientY: 40,
      };
      await fireEvent.pointerDown(region(), touch);
      vi.advanceTimersByTime(LONG_PRESS_MS - 50);
      await tick();
      expect(screen.queryByRole('menu')).toBeNull();
      vi.advanceTimersByTime(60);
      await tick();
      expect(screen.getByRole('menu')).toBeTruthy();
      // Some browsers also fire contextmenu for the long press: no second open.
      expect(await fireEvent.contextMenu(region(), { clientX: 50, clientY: 40 })).toBe(false);
      await fireEvent.pointerUp(region(), touch);
      await fireEvent.click(region());
      expect(clicks).not.toHaveBeenCalled();
      expect(screen.getByRole('menu')).toBeTruthy();
    });

    it('does not open when a long press moves (a scroll) or lifts early', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      render(ContextMenuFixture);
      const touch = {
        pointerId: 4,
        pointerType: 'touch',
        isPrimary: true,
        clientX: 50,
        clientY: 40,
      };
      await fireEvent.pointerDown(region(), touch);
      await fireEvent.pointerMove(region(), { ...touch, clientY: 70 });
      vi.advanceTimersByTime(LONG_PRESS_MS * 2);
      await tick();
      expect(screen.queryByRole('menu')).toBeNull();
      await fireEvent.pointerDown(region(), touch);
      await fireEvent.pointerUp(region(), touch);
      vi.advanceTimersByTime(LONG_PRESS_MS * 2);
      await tick();
      expect(screen.queryByRole('menu')).toBeNull();
    });
  });
});

describe('menubar', () => {
  afterEach(cleanup);

  const trigger = (name: string) => screen.getByRole('menuitem', { name }) as HTMLElement;
  const focused = () => (document.activeElement as HTMLElement | null)?.textContent?.trim() ?? '';
  const openMenus = () => screen.queryAllByRole('menu');
  async function key(name: string, target: Element = document.activeElement ?? document.body) {
    await fireEvent.keyDown(target, { key: name });
    await tick();
  }

  describe('Menubar: keyboard between triggers', () => {
    it('swaps the arrows in RTL', async () => {
      render(MenubarFixture, { props: { dir: 'rtl' } });
      trigger('File').focus();
      await key('ArrowLeft');
      expect(focused()).toBe('Edit');
    });
  });

  describe('Menubar: opening and moving between menus', () => {
    it('carries the open menu along with ArrowRight and ArrowLeft from inside it', async () => {
      const onValueChange = vi.fn();
      render(MenubarFixture, { props: { onValueChange } });
      trigger('File').focus();
      await key('Enter');
      await screen.findByRole('menu');
      await key('ArrowRight');
      expect(focused()).toBe('Undo');
      expect(trigger('File').getAttribute('aria-expanded')).toBe('false');
      expect(trigger('Edit').getAttribute('aria-expanded')).toBe('true');
      expect(openMenus()).toHaveLength(1);
      await key('ArrowRight');
      expect(focused()).toBe('Zoom in');
      await key('ArrowLeft');
      expect(focused()).toBe('Undo');
      expect(onValueChange.mock.calls.map((call) => call[0])).toEqual([
        'file',
        'edit',
        'view',
        'edit',
      ]);
    });
  });

  describe('Menubar: pointer', () => {
    it('opens on hover only after the first open', async () => {
      render(MenubarFixture);
      await fireEvent.pointerEnter(trigger('Edit'), { pointerType: 'mouse' });
      await tick();
      expect(openMenus()).toHaveLength(0);
      await fireEvent.click(trigger('File'), { detail: 1 });
      await screen.findByRole('menu');
      await fireEvent.pointerEnter(trigger('Edit'), { pointerType: 'mouse' });
      await tick();
      expect(trigger('Edit').getAttribute('aria-expanded')).toBe('true');
      expect(trigger('File').getAttribute('aria-expanded')).toBe('false');
      // Touch has no hover: a touch "enter" does not switch menus.
      await fireEvent.pointerEnter(trigger('View'), { pointerType: 'touch' });
      await tick();
      expect(trigger('Edit').getAttribute('aria-expanded')).toBe('true');
    });
  });

  describe('Menubar: controlled value', () => {
    it('opens the menu named by value', async () => {
      render(MenubarFixture, { props: { value: 'view' } });
      await screen.findByRole('menu');
      expect(trigger('View').getAttribute('aria-expanded')).toBe('true');
    });
  });
});

describe('navigation-menu', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  describe('NavigationMenu', () => {
    const trigger = (name: string) => screen.getByRole('button', { name });

    it('marks the current page and never renders an unsafe href', async () => {
      render(NavigationMenuFixture);
      expect(screen.getByRole('link', { name: 'Pricing' }).getAttribute('aria-current')).toBe(
        'page'
      );
      await fireEvent.click(trigger('Resources'));
      const unsafe = screen.getByText('Unsafe');
      expect(unsafe.hasAttribute('href')).toBe(false);
      expect(unsafe.hasAttribute('data-href-blocked')).toBe(true);
    });

    it('opens on mouse hover after the delay, never on touch hover', async () => {
      vi.useFakeTimers();
      render(NavigationMenuFixture, { props: { delayDuration: 200 } });
      await fireEvent.pointerEnter(trigger('Products'), { pointerType: 'touch' });
      vi.advanceTimersByTime(1000);
      flushSync();
      expect(screen.queryByRole('group')).toBeNull();
      await fireEvent.pointerEnter(trigger('Products'), { pointerType: 'mouse' });
      vi.advanceTimersByTime(199);
      flushSync();
      expect(screen.queryByRole('group')).toBeNull();
      vi.advanceTimersByTime(1);
      flushSync();
      expect(screen.getByRole('group', { name: 'Products' })).toBeTruthy();
    });

    it('measures the indicator from the inline start, flipped in RTL', async () => {
      // Stub rects: the list spans 0..400 inline; the Products trigger 100..160.
      const stubRect = (element: Element, left: number, right: number, top = 0) => {
        Object.defineProperty(element, 'getBoundingClientRect', {
          configurable: true,
          value: () =>
            ({
              left,
              right,
              top,
              bottom: top + 24,
              width: right - left,
              height: 24,
              x: left,
              y: top,
              toJSON: () => ({}),
            }) as DOMRect,
        });
      };
      const offsetOf = (indicator: Element): string | undefined =>
        indicator
          .getAttribute('style')
          ?.match(/--tx-navigation-menu-indicator-offset:\s*(-?[\d.]+)px/)?.[1] ??
        (indicator as HTMLElement).style.getPropertyValue(
          '--tx-navigation-menu-indicator-offset'
        ) ??
        undefined;

      const ltr = render(NavigationMenuFixture);
      stubRect(screen.getByRole('list'), 0, 400);
      stubRect(trigger('Products'), 100, 160);
      await fireEvent.click(trigger('Products'));
      // LTR: the inline start edge is the left edge of the list.
      expect(offsetOf(screen.getByTestId('indicator'))).toBe('100');
      ltr.unmount();

      render(NavigationMenuFixture, { props: { dir: 'rtl' } });
      stubRect(screen.getByRole('list'), 0, 400);
      stubRect(trigger('Products'), 100, 160);
      await fireEvent.click(trigger('Products'));
      // RTL: the inline start edge is the right edge, so the offset flips.
      expect(offsetOf(screen.getByTestId('indicator'))).toBe('240');
    });
  });
});

describe('toast', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  describe('Toast region', () => {
    it('pauses the timer while the viewport is hovered', async () => {
      vi.useFakeTimers();
      const { getByRole, queryByText, container } = render(ToastFixture, {
        props: { duration: 1000 },
      });
      await fireEvent.click(getByRole('button', { name: 'Publish toast' }));
      const viewport = container.querySelector('[data-tx-toast-viewport]')!;
      await fireEvent.pointerEnter(viewport);
      await vi.advanceTimersByTimeAsync(1500);
      expect(queryByText('File saved')).toBeTruthy();
      await fireEvent.pointerLeave(viewport);
      await vi.advanceTimersByTimeAsync(1100);
      expect(queryByText('File saved')).toBeNull();
    });

    it('dismisses when swiped past the threshold', async () => {
      const { getByRole, queryByText, container } = render(ToastFixture, {
        props: { duration: 0 },
      });
      await fireEvent.click(getByRole('button', { name: 'Publish toast' }));
      const root = container.querySelector('[data-tx-toast-root]')!;
      await fireEvent.pointerDown(root, { clientX: 0, pointerId: 1, button: 0 });
      await fireEvent.pointerMove(root, { clientX: 80, pointerId: 1 });
      await fireEvent.pointerUp(root, { clientX: 80, pointerId: 1 });
      expect(queryByText('File saved')).toBeNull();
    });
  });

  describe('contained position read (G99)', () => {
    /** Queued animation frames, run by hand so each test controls when they fire. */
    let frames: Map<number, FrameRequestCallback>;
    let reads: Element[];
    let hosts: HTMLElement[];

    beforeEach(() => {
      frames = new Map();
      reads = [];
      hosts = [];
      let next = 0;
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
        next += 1;
        frames.set(next, callback);
        return next;
      });
      vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
        frames.delete(id);
      });
      // happy-dom reports an unset position as '': report 'static' as browsers do.
      const original = window.getComputedStyle.bind(window);
      vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) => {
        reads.push(element);
        const style = original(element, pseudo);
        return new Proxy(style, {
          get: (target, key) =>
            key === 'position' ? target.position || 'static' : Reflect.get(target, key, target),
        });
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
      for (const host of hosts) host.remove();
    });

    function host(style = ''): HTMLElement {
      const element = document.createElement('div');
      element.setAttribute('style', style);
      document.body.append(element);
      hosts.push(element);
      return element;
    }

    function runFrames(): void {
      const queued = [...frames.values()];
      frames.clear();
      for (const callback of queued) callback(performance.now());
    }

    it('never reads the container style synchronously while it mounts', () => {
      for (const positioned of [undefined, false, true]) {
        const container = host('position: relative');
        reads.length = 0;
        const view = render(ToastContainedFixture, { props: { container, positioned } });
        flushSync();
        expect(reads.filter((element) => element === container)).toEqual([]);
        expect(container.querySelector('[data-tx-toast-viewport]')).toBeTruthy();
        view.unmount();
      }
    });

    it('never reads the style of a container declared positioned, even after a frame', () => {
      const container = host();
      render(ToastContainedFixture, { props: { container, positioned: true } });
      flushSync();
      runFrames();
      expect(reads).not.toContain(container);
      expect(container.style.position).toBe('');
    });

    it('positions a static container one frame after mount, and restores it on unmount', () => {
      const container = host();
      const view = render(ToastContainedFixture, { props: { container } });
      flushSync();
      expect(container.style.position).toBe('');
      runFrames();
      expect(reads).toContain(container);
      expect(container.style.position).toBe('relative');
      view.unmount();
      expect(container.style.position).toBe('');
    });

    it('leaves an already positioned container alone after the deferred read', () => {
      const container = host('position: absolute');
      render(ToastContainedFixture, { props: { container } });
      flushSync();
      runFrames();
      expect(reads).toContain(container);
      expect(container.style.position).toBe('absolute');
    });

    it('cancels the pending read when it unmounts before the frame', () => {
      const container = host();
      const view = render(ToastContainedFixture, { props: { container } });
      flushSync();
      expect(frames.size).toBe(1);
      view.unmount();
      expect(frames.size).toBe(0);
      expect(() => runFrames()).not.toThrow();
      expect(reads).not.toContain(container);
      expect(container.style.position).toBe('');
    });

    it('moves the pending read to a new container, and restores the old one', async () => {
      const first = host();
      const second = host();
      const view = render(ToastContainedFixture, { props: { container: first } });
      flushSync();
      // Changed before the first frame: only the new container is read.
      await view.rerender({ container: second });
      flushSync();
      expect(frames.size).toBe(1);
      runFrames();
      expect(reads).not.toContain(first);
      expect(second.style.position).toBe('relative');
      expect(second.querySelector('[data-tx-toast-viewport]')).toBeTruthy();
      // Changed after it: the old container gets its position back.
      await view.rerender({ container: first });
      flushSync();
      expect(second.style.position).toBe('');
      runFrames();
      expect(first.style.position).toBe('relative');
      expect(first.querySelector('[data-tx-toast-viewport]')).toBeTruthy();
    });
  });
});

describe('combobox-teardown', () => {
  afterEach(() => {
    cleanup();
    resetInertRegistry();
  });

  /** Collects errors that escape to the window or as unhandled rejections. */
  function watchUnhandled() {
    const errors: unknown[] = [];
    const onError = (event: ErrorEvent) => errors.push(event.error ?? event.message);
    const onRejection = (event: PromiseRejectionEvent) => errors.push(event.reason);
    const onProcess = (reason: unknown) => errors.push(reason);
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    process.on('unhandledRejection', onProcess);
    process.on('uncaughtException', onProcess);
    return {
      errors,
      stop() {
        window.removeEventListener('error', onError);
        window.removeEventListener('unhandledrejection', onRejection);
        process.off('unhandledRejection', onProcess);
        process.off('uncaughtException', onProcess);
      },
    };
  }

  describe('@texuli/primitives/combobox teardown', () => {
    it('unmounts mid-open, inside a modal scope, without an unhandled error', async () => {
      const outside = document.body.appendChild(document.createElement('div'));
      // A modal elsewhere on the page: the list would exempt itself while open.
      const scope = getInertRegistry().inertOutside(outside);
      const watch = watchUnhandled();
      try {
        const view = render(ComboboxHarness);
        const input = screen.getByRole('combobox', { name: 'Colors' });
        // Open (the list mounts and its overlay engages), then unmount in the same tick.
        void fireEvent.input(input, { target: { value: 'ja' } });
        view.unmount();
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(watch.errors).toEqual([]);
        expect(
          getInertRegistry()
            .exemptions()
            .map((entry) => entry.label)
        ).not.toContain('combobox');
      } finally {
        watch.stop();
        scope.release();
        outside.remove();
      }
    });

    it('opens and closes repeatedly inside a modal scope, releasing its exemption each time', async () => {
      const outside = document.body.appendChild(document.createElement('div'));
      const scope = getInertRegistry().inertOutside(outside);
      const view = render(ComboboxHarness);
      const input = screen.getByRole('combobox', { name: 'Colors' });
      for (let i = 0; i < 3; i += 1) {
        await fireEvent.input(input, { target: { value: 'ja' } });
        expect(screen.getByRole('listbox')).toBeTruthy();
        await fireEvent.keyDown(input, { key: 'Escape' });
      }
      view.unmount();
      expect(getInertRegistry().exemptions()).toEqual([]);
      scope.release();
      outside.remove();
    });
  });
});

describe('portal', () => {
  afterEach(cleanup);

  function portalRoot(doc: Document): HTMLElement | null {
    return doc.querySelector('[data-tx-portal]');
  }

  describe('Portal', () => {
    it('moves the portal root to a reactive custom target', async () => {
      const view = render(PortalHarness);
      const doc = view.container.ownerDocument;
      await fireEvent.click(view.getByRole('button', { name: /Use frame target/i }));
      const root = portalRoot(doc);
      const frame = doc.querySelector('[data-custom-target]');
      expect(root?.parentElement).toBe(frame);
    });
  });
});
