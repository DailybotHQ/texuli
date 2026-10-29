import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import type { FocusRestoreEvent } from '@texuli/core/focus-scope';
import { getInertRegistry } from '@texuli/core/inert';
import type { OverlayDismissEvent } from '@texuli/core/overlay';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createToastStore, resetToastStore } from '../src/components/toast/toast-store.ts';
import AlertDialogHarness from './fixtures/AlertDialogHarness.svelte';
import CommandHarness from './fixtures/CommandHarness.svelte';
import ContainedOverlayHarness from './fixtures/ContainedOverlayHarness.svelte';
import HoverCardFixture from './fixtures/HoverCardFixture.svelte';
import MenusHarness from './fixtures/MenusHarness.svelte';
import PopoverFixture from './fixtures/PopoverFixture.svelte';
import Harness from './fixtures/SheetHarness.svelte';
import TooltipHarness from './fixtures/TooltipHarness.svelte';
import ToastHarness from './ToastHarness.svelte';

// Styled overlays: confirm flows, initialFocus and dismissal pass-through,
// focus return, and toast lifecycles.

describe('dialog', () => {
  afterEach(() => {
    cleanup();
  });

  describe('AlertDialog', () => {
    it('confirms and closes when onConfirm resolves', async () => {
      const onConfirm = vi.fn(async () => undefined);
      render(AlertDialogHarness, {
        props: { open: false, onConfirm, destructive: false, confirmLabel: 'Confirm' },
      });
      await fireEvent.click(screen.getByRole('button', { name: 'Delete project' }));
      await screen.findByRole('alertdialog');
      await fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('alertdialog')).toBeNull();
      });
    });

    it('keeps the dialog open and shows an error when onConfirm rejects', async () => {
      render(AlertDialogHarness, {
        props: { open: false, fail: true },
      });
      await fireEvent.click(screen.getByRole('button', { name: 'Delete project' }));
      await screen.findByRole('alertdialog');
      await fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      await waitFor(() => {
        expect(screen.getByRole('alert').textContent).toContain(
          'Harbor could not delete the project.'
        );
      });
      expect(screen.getByRole('alertdialog')).toBeTruthy();
    });

    it('stays open while the confirm is pending; Escape cannot dismiss it', async () => {
      let resolveConfirm: (() => void) | undefined;
      const onConfirm = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveConfirm = resolve;
          })
      );
      render(AlertDialogHarness, { props: { open: false, onConfirm } });
      await fireEvent.click(screen.getByRole('button', { name: 'Delete project' }));
      const dialog = await screen.findByRole('alertdialog', { name: 'Delete project?' });
      await fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      await waitFor(() => {
        expect(dialog.getAttribute('aria-busy')).toBe('true');
      });

      await fireEvent.keyDown(dialog.ownerDocument, { key: 'Escape' });
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(screen.getByRole('alertdialog', { name: 'Delete project?' })).toBeTruthy();
      expect(onConfirm).toHaveBeenCalledTimes(1);

      resolveConfirm?.();
      await waitFor(() => {
        expect(screen.queryByRole('alertdialog')).toBeNull();
      });
    });
  });
});

describe('contained overlays and dismissal callbacks (G53)', () => {
  afterEach(() => {
    cleanup();
  });

  const kinds = ['dialog', 'alert', 'palette'] as const;
  const roleOf = (kind: (typeof kinds)[number]) => (kind === 'alert' ? 'alertdialog' : 'dialog');

  for (const kind of kinds) {
    it(`${kind}: mode="contained" renders in the container and scopes inertness to it`, async () => {
      render(ContainedOverlayHarness, { props: { kind } });
      const dialog = await screen.findByRole(roleOf(kind));
      const frame = screen.getByTestId('frame');
      expect(frame.contains(dialog)).toBe(true);
      const inert = getInertRegistry().inertElements();
      const frameAction = screen.getByRole('button', { name: 'Frame action', hidden: true });
      const outside = screen.getByRole('button', { name: 'Outside action', hidden: true });
      expect(inert.some((element) => element.contains(frameAction))).toBe(true);
      expect(inert.some((element) => element.contains(outside))).toBe(false);
      expect(document.documentElement.style.overflow).toBe('');
    });

    it(`${kind}: onDismissRequest can veto an Escape`, async () => {
      const onDismissRequest = vi.fn((event: OverlayDismissEvent) => event.preventDefault());
      render(ContainedOverlayHarness, { props: { kind, onDismissRequest } });
      const dialog = await screen.findByRole(roleOf(kind));
      await fireEvent.keyDown(dialog, { key: 'Escape' });
      expect(onDismissRequest).toHaveBeenCalled();
      expect(screen.getByRole(roleOf(kind))).toBeTruthy();
    });

    it(`${kind}: onCloseAutoFocus runs on close and can keep focus where it is`, async () => {
      const onCloseAutoFocus = vi.fn((event: FocusRestoreEvent) => event.preventDefault());
      const view = render(ContainedOverlayHarness, { props: { kind, onCloseAutoFocus } });
      await screen.findByRole(roleOf(kind));
      const outside = screen.getByRole('button', { name: 'Outside action', hidden: true });
      outside.focus();
      await view.rerender({ kind, onCloseAutoFocus, open: false });
      await waitFor(() => expect(screen.queryByRole(roleOf(kind))).toBeNull());
      await waitFor(() => expect(onCloseAutoFocus).toHaveBeenCalled());
    });
  }
});

describe('popover', () => {
  afterEach(() => {
    cleanup();
  });

  describe('Popover', () => {
    it('passes initialFocus through to the primitive content', async () => {
      render(PopoverFixture, { props: { label: 'Account menu', focusDone: true } });
      await fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
      await screen.findByRole('dialog', { name: 'Account menu' });
      expect(screen.getByRole('button', { name: 'Settings' })).toBeTruthy();
      await waitFor(() =>
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Done' }))
      );
    });
  });

  describe('HoverCard', () => {
    it('opens on pointer enter after delay and renders the arrow surface', async () => {
      render(HoverCardFixture, {
        props: { openDelay: 0, closeDelay: 0, label: 'Jordan Lee' },
      });
      const trigger = screen.getByRole('button', { name: 'Jordan Lee' });
      await fireEvent.pointerEnter(trigger);
      const content = await screen.findByRole('dialog', { name: 'Jordan Lee' });
      expect(content.className).toContain('tx-hover-card');
      expect(content.querySelector('[data-tx-hover-card-arrow]')).toBeTruthy();
      expect(screen.getByText('Mathematician · example.com')).toBeTruthy();
    });
  });
});

describe('sheet', () => {
  afterEach(cleanup);

  describe('styled sheet family', () => {
    it('defaults Sheet to logical start and resolves it against RTL trigger direction', async () => {
      render(Harness, { props: { dir: 'rtl' } });
      await fireEvent.click(screen.getByRole('button', { name: 'Open sheet' }));
      const dialog = await screen.findByRole('dialog', { name: 'Filters' });

      await waitFor(() => expect(dialog.getAttribute('data-side')).toBe('right'));
      expect(dialog.getAttribute('dir')).toBe('rtl');
      expect(dialog.className).toContain('tx-sheet--md');
      expect(dialog.hasAttribute('data-tx-sheet')).toBe(true);
      expect(dialog.getAttribute('aria-modal')).toBe('true');
    });

    it('forwards dismissOutside and closeOnEscape to DetailPanel and a non-modal Sheet', async () => {
      render(Harness, { props: { dismissOutside: true } });
      await fireEvent.click(screen.getByRole('button', { name: 'Open details' }));
      await screen.findByRole('dialog', { name: 'Order details' });
      await fireEvent.pointerDown(screen.getByRole('button', { name: 'Open details' }));
      expect(screen.getByRole('dialog', { name: 'Order details' })).toBeTruthy();
      await fireEvent.pointerDown(screen.getByRole('button', { name: 'Page action' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      cleanup();

      render(Harness, { props: { sheetModal: false, closeOnEscape: true } });
      await fireEvent.click(screen.getByRole('button', { name: 'Open sheet' }));
      const sheet = await screen.findByRole('dialog', { name: 'Filters' });
      expect(sheet.hasAttribute('aria-modal')).toBe(false);
      const page = screen.getByRole('button', { name: 'Page action' });
      page.focus();
      await fireEvent.keyDown(page, { key: 'Escape' });
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });
  });
});

describe('tooltip', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  describe('Tooltip', () => {
    it('renders shortcut kbd chips when provided', async () => {
      const { getByRole, container } = render(TooltipHarness, {
        props: {
          content: 'Save',
          shortcut: ['⌘', 'S'],
          open: true,
        },
      });
      // Controlled open may need a tick for content mount.
      await vi.waitFor(() => {
        expect(container.ownerDocument.querySelector('[role="tooltip"]')).toBeTruthy();
      });
      const shortcuts = container.ownerDocument.querySelector('[data-tx-tooltip-shortcuts]');
      expect(shortcuts).toBeTruthy();
      expect(shortcuts?.querySelectorAll('[data-tx-kbd]').length).toBe(2);
      expect(getByRole('button', { name: 'Save draft' })).toBeTruthy();
    });
  });
});

describe('menus', () => {
  afterEach(() => cleanup());

  describe('DropdownMenu', () => {
    it('runs an item and closes', async () => {
      render(MenusHarness, { props: { mode: 'dropdown', open: true } });
      await screen.findByRole('menu');
      await fireEvent.click(screen.getByRole('menuitem', { name: /New file/i }));
      await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
      expect(screen.getByLabelText('Log').textContent).toContain('new');
    });
  });

  describe('Menubar', () => {
    it('renders top-level triggers and opens a menu', async () => {
      render(MenusHarness, { props: { mode: 'menubar' } });
      const bar = screen.getByRole('menubar', { name: 'Application' });
      expect(bar.className).toContain('tx-menubar');
      const file = screen.getByRole('menuitem', { name: 'File' });
      await fireEvent.click(file);
      const menu = await screen.findByRole('menu');
      expect(menu.className).toContain('tx-menu-content');
      expect(screen.getByRole('menuitem', { name: 'New' })).toBeTruthy();
    });
  });
});

describe('command', () => {
  afterEach(cleanup);

  describe('Command palette', () => {
    it('opens from the ⌘K trigger and lists recent items', async () => {
      render(CommandHarness, { props: { mode: 'palette', open: false, shortcut: false } });
      expect(screen.queryByRole('dialog')).toBeNull();
      await fireEvent.click(screen.getByRole('button', { name: /Search commands/i }));
      const dialog = await screen.findByRole('dialog', { name: 'Command palette' });
      expect(dialog).toBeTruthy();
      expect(screen.getByRole('option', { name: /Open inbox/i })).toBeTruthy();
    });

    it('returns focus to the trigger when a parent-opened palette closes with Escape', async () => {
      // WCAG 2.4.3 (PLAN_006 T-88 R1): opened through bind:open by its trigger,
      // not by the palette's own shortcut, the palette must still give focus
      // back to the element that had it, never drop it to the body.
      render(CommandHarness, { props: { mode: 'palette', open: false, shortcut: false } });
      const trigger = screen.getByRole('button', { name: /Search commands/i });
      trigger.focus();
      await fireEvent.click(trigger);
      const dialog = await screen.findByRole('dialog', { name: 'Command palette' });
      await fireEvent.keyDown(dialog, { key: 'Escape' });
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      await waitFor(() => expect(document.activeElement).toBe(trigger));
    });
  });

  describe('Command.Trigger options', () => {
    it('adds a search glyph and a narrow collapse that keeps the label as the name', async () => {
      const { default: Trigger } = await import('../src/components/command/CommandTrigger.svelte');
      const plain = render(Trigger, { props: { label: 'Search the site' } });
      expect(plain.container.querySelector('.tx-command-trigger__icon')).toBeNull();
      expect(plain.container.querySelector('button')?.hasAttribute('aria-label')).toBe(false);
      cleanup();
      const slim = render(Trigger, { props: { label: 'Search the site', collapse: 'narrow' } });
      const button = slim.getByRole('button', { name: 'Search the site' });
      expect(button.dataset.collapse).toBe('narrow');
      // The name comes from the label text in the button, never an aria-label
      // that could differ from what sighted users see (WCAG 2.5.3).
      expect(button.hasAttribute('aria-label')).toBe(false);
      expect(button.querySelector('.tx-command-trigger__label')?.textContent).toBe(
        'Search the site'
      );
      expect(button.querySelector('.tx-command-trigger__icon')?.getAttribute('aria-hidden')).toBe(
        'true'
      );
      cleanup();
      const iconOnly = render(Trigger, { props: { label: 'Find', icon: true } });
      expect(iconOnly.container.querySelector('.tx-command-trigger__icon')).not.toBeNull();
      expect(iconOnly.getByRole('button', { name: /Find/ }).dataset.collapse).toBeUndefined();
    });
  });
});

describe('toast', () => {
  afterEach(() => {
    cleanup();
    resetToastStore();
  });

  describe('createToastStore', () => {
    it('uses the store duration over the per-kind default, and the toast option over both', () => {
      const persistent = createToastStore({ duration: 0 });
      persistent.success('Saved');
      persistent.error('Failed', { duration: 1200 });
      expect(persistent.items().map((item) => item.duration)).toEqual([1200, 0]);
      const defaults = createToastStore();
      defaults.success('Saved');
      expect(defaults.items()[0]?.duration).toBe(4000);
    });

    it('resolves promise toasts to success or error', async () => {
      const store = createToastStore({ duration: 0, createId: () => 'p1' });
      let resolve!: (v: string) => void;
      const pending = new Promise<string>((r) => {
        resolve = r;
      });
      store.promise(pending, {
        loading: 'Working…',
        success: (v) => `Done: ${v}`,
        error: 'Failed',
      });
      expect(store.items()[0]?.pending).toBe(true);
      resolve('ok');
      await waitFor(() => {
        expect(store.items()[0]?.kind).toBe('success');
        expect(store.items()[0]?.title).toBe('Done: ok');
        expect(store.items()[0]?.pending).toBe(false);
      });
    });
  });

  describe('Toaster', () => {
    it('dismisses after a rejecting action and rethrows the error asynchronously', async () => {
      const store = createToastStore({ duration: 0 });
      const failure = new Error('Undo failed upstream.');
      const thrown: unknown[] = [];
      const original = globalThis.queueMicrotask.bind(globalThis);
      // Wrap every microtask so a rethrow is captured instead of reaching Vitest.
      const spy = vi.spyOn(globalThis, 'queueMicrotask').mockImplementation((callback) => {
        original(() => {
          try {
            callback();
          } catch (error) {
            thrown.push(error);
          }
        });
      });
      try {
        store.info('Archived', {
          action: { label: 'Undo', onClick: () => Promise.reject(failure) },
        });
        const view = render(ToastHarness, { props: { store } });
        await fireEvent.click(view.getByRole('button', { name: 'Undo' }));
        await waitFor(() =>
          expect(
            within(view.getByRole('region', { name: 'Notifications' })).queryByText('Archived')
          ).toBeNull()
        );
        await waitFor(() => expect(thrown).toContain(failure));
      } finally {
        spy.mockRestore();
      }
    });

    it('keeps a toast whose retryOnError action rejects, shows the error, and settles once on a retry (G57)', async () => {
      const store = createToastStore({ duration: 0 });
      const thrown: unknown[] = [];
      const original = globalThis.queueMicrotask.bind(globalThis);
      const spy = vi.spyOn(globalThis, 'queueMicrotask').mockImplementation((callback) => {
        original(() => {
          try {
            callback();
          } catch (error) {
            thrown.push(error);
          }
        });
      });
      try {
        const failure = new Error('Offline.');
        let attempts = 0;
        const onSettle = vi.fn();
        const id = store.info('Archived', {
          action: {
            label: 'Undo',
            retryOnError: true,
            errorText: (error) => `Undo failed: ${(error as Error).message}`,
            onClick: () => {
              attempts += 1;
              return attempts === 1 ? Promise.reject(failure) : Promise.resolve();
            },
          },
          onSettle,
        });
        const view = render(ToastHarness, { props: { store } });
        const region = view.getByRole('region', { name: 'Notifications' });
        await fireEvent.click(view.getByRole('button', { name: 'Undo' }));
        await waitFor(() => expect(within(region).getByText('Undo failed: Offline.')).toBeTruthy());
        expect(store.items()[0]?.error).toBe('Undo failed: Offline.');
        expect(region.querySelector('[data-tx-toast-root]')?.getAttribute('data-error')).toBe(
          'true'
        );
        expect(onSettle).not.toHaveBeenCalled();
        await waitFor(() => expect(thrown).toContain(failure));
        // The retry succeeds: the toast leaves and settles once with 'action'.
        await fireEvent.click(view.getByRole('button', { name: 'Undo' }));
        await waitFor(() => expect(within(region).queryByText('Archived')).toBeNull());
        expect(attempts).toBe(2);
        expect(onSettle.mock.calls).toEqual([['action']]);
        store.dismiss(id);
        expect(onSettle).toHaveBeenCalledTimes(1);
      } finally {
        spy.mockRestore();
      }
    });

    it('keeps the toast mounted while an async action runs, then dismisses', async () => {
      const store = createToastStore({ duration: 0 });
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      store.info('Archived', { action: { label: 'Undo', onClick: () => gate } });
      const view = render(ToastHarness, { props: { store } });
      await fireEvent.click(view.getByRole('button', { name: 'Undo' }));
      // While the action promise is pending the toast stays interactive: not
      // leaving, not inert, and its action control still reachable.
      expect(
        view.container.ownerDocument.querySelector('[data-tx-toast-root][data-leaving="true"]')
      ).toBeNull();
      expect(view.getByRole('button', { name: 'Undo' })).toBeTruthy();
      release();
      await waitFor(() =>
        expect(
          within(view.getByRole('region', { name: 'Notifications' })).queryByText('Archived')
        ).toBeNull()
      );
    });
  });

  describe('settle reasons, pause and announcements (G9, G45)', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('settles every toast exactly once with the reason it left', async () => {
      const cases: {
        reason: 'timeout' | 'dismiss' | 'action';
        leave: (store: ReturnType<typeof createToastStore>, id: string) => Promise<void>;
      }[] = [
        {
          reason: 'timeout',
          leave: async () => {
            vi.advanceTimersByTime(1000);
          },
        },
        {
          reason: 'dismiss',
          leave: async (store, id) => {
            store.dismiss(id);
          },
        },
        {
          reason: 'dismiss',
          leave: async () => {
            await fireEvent.click(screen.getByRole('button', { name: /Dismiss notification/ }));
          },
        },
        {
          reason: 'action',
          leave: async () => {
            await fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
            await vi.runAllTimersAsync();
          },
        },
      ];
      for (const { reason, leave } of cases) {
        vi.useFakeTimers();
        const store = createToastStore();
        const onSettle = vi.fn();
        const onClick = vi.fn();
        const id = store.info('Archived', {
          duration: 1000,
          action: { label: 'Undo', onClick },
          onSettle,
        });
        render(ToastHarness, { props: { store } });
        await leave(store, id);
        expect(store.items(), reason).toEqual([]);
        // Later timers, dismissals and a second action never settle it again.
        vi.advanceTimersByTime(5000);
        store.dismiss(id);
        store.dismiss();
        await store.action(id);
        expect(onSettle.mock.calls, reason).toEqual([[reason]]);
        expect(onClick).toHaveBeenCalledTimes(reason === 'action' ? 1 : 0);
        cleanup();
        vi.useRealTimers();
      }
    });

    it('settles a toast pushed out by the max cap as a dismissal', () => {
      const store = createToastStore({ duration: 0, max: 1 });
      const first = vi.fn();
      store.info('First', { onSettle: first });
      store.info('Second');
      expect(first.mock.calls).toEqual([['dismiss']]);
    });

    it('pauses and resumes the timers from the host, keeping the remaining time', () => {
      vi.useFakeTimers();
      const store = createToastStore();
      const onSettle = vi.fn();
      store.success('Saved', { duration: 1000, onSettle });
      vi.advanceTimersByTime(400);
      store.pause();
      expect(store.isPaused()).toBe(true);
      vi.advanceTimersByTime(5000);
      expect(store.items()).toHaveLength(1);
      // Holds stack by key: the host hold alone keeps the timers paused.
      store.pause('drawer');
      store.resume('drawer');
      vi.advanceTimersByTime(5000);
      expect(store.items()).toHaveLength(1);
      store.resume();
      vi.advanceTimersByTime(599);
      expect(store.items()).toHaveLength(1);
      vi.advanceTimersByTime(1);
      expect(store.items()).toHaveLength(0);
      expect(onSettle.mock.calls).toEqual([['timeout']]);
    });

    it('pauses while the pointer or focus is in the region, running caller handlers too', async () => {
      vi.useFakeTimers();
      const store = createToastStore();
      store.info('Synced', { duration: 1000 });
      const onpointerenter = vi.fn();
      const onfocusin = vi.fn();
      const view = render(ToastHarness, { props: { store, onpointerenter, onfocusin } });
      const wrapper = view.container.ownerDocument.querySelector(
        '[data-probe="toaster"]'
      ) as HTMLElement;
      expect(wrapper.hasAttribute('data-tx-toaster')).toBe(true);
      await fireEvent.pointerEnter(wrapper);
      expect(onpointerenter).toHaveBeenCalledTimes(1);
      expect(store.isPaused()).toBe(true);
      vi.advanceTimersByTime(5000);
      expect(store.items()).toHaveLength(1);
      await fireEvent.focusIn(wrapper);
      expect(onfocusin).toHaveBeenCalledTimes(1);
      await fireEvent.pointerLeave(wrapper);
      // Focus still holds the timers.
      expect(store.isPaused()).toBe(true);
      await fireEvent.focusOut(wrapper);
      expect(store.isPaused()).toBe(false);
      vi.advanceTimersByTime(1000);
      expect(store.items()).toHaveLength(0);
    });

    it('exposes the announcement of each toast and of the newest one', () => {
      let now = 0;
      const store = createToastStore({ duration: 0, now: () => ++now });
      const saved = store.success('Saved', { description: 'Draft 3 is live' });
      store.error('Sync failed');
      expect(store.announcement(saved)).toEqual({
        message: 'Saved. Draft 3 is live',
        politeness: 'polite',
      });
      expect(store.announcement()).toEqual({ message: 'Sync failed', politeness: 'assertive' });
      expect(store.items().map((item) => item.announcement.politeness)).toEqual([
        'assertive',
        'polite',
      ]);
      expect(store.announcement('missing')).toBeUndefined();
    });
  });

  describe('Toaster viewport placement and motion', () => {
    it('keeps a dismissed toast mounted, inert, for its exit motion', async () => {
      const store = createToastStore({ duration: 0 });
      store.success('Copied');
      const view = render(ToastHarness, { props: { store } });
      store.dismiss();
      await waitFor(() => {
        const leaving = view.container.ownerDocument.querySelector('[data-leaving="true"]');
        expect(leaving).toBeTruthy();
        expect(leaving?.hasAttribute('inert')).toBe(true);
        expect(leaving?.getAttribute('aria-hidden')).toBe('true');
      });
      await waitFor(() => {
        expect(
          within(view.getByRole('region', { name: 'Notifications' })).queryByText('Copied')
        ).toBeNull();
      });
    });

    it('removes a dismissed toast at once with reduced motion', async () => {
      const original = globalThis.matchMedia;
      globalThis.matchMedia = ((query: string) => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      })) as typeof globalThis.matchMedia;
      try {
        const store = createToastStore({ duration: 0 });
        store.success('Copied');
        const view = render(ToastHarness, { props: { store } });
        store.dismiss();
        await Promise.resolve();
        expect(view.container.ownerDocument.querySelector('[data-leaving]')).toBeNull();
        expect(
          within(view.getByRole('region', { name: 'Notifications' })).queryByText('Copied')
        ).toBeNull();
      } finally {
        globalThis.matchMedia = original;
      }
    });
  });
});
