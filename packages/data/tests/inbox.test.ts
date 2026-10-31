import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import {
  filterInbox,
  markAllRead,
  newArrivals,
  resolveInboxLabels,
  setRead,
  unreadCount,
} from '../src/activity/inbox/index.ts';
import * as engine from '../src/engines/activity/index.ts';
import InboxHarness from './fixtures/InboxHarness.svelte';

afterEach(() => cleanup());

const notes = [
  { id: 'a', title: 'A', at: 1, read: false },
  { id: 'b', title: 'B', at: 2, read: true },
  { id: 'c', title: 'C', at: 3, read: false },
];

describe('notification inbox model (G19)', () => {
  it('counts unread, marks read, unread and all, filters and finds new arrivals, purely', () => {
    expect(unreadCount(notes)).toBe(2);
    const next = setRead(notes, ['a', 'b'], true);
    expect(next.map((note) => note.read)).toEqual([true, true, false]);
    expect(next[1]).toBe(notes[1]); // unchanged items keep their identity
    expect(notes[0]?.read).toBe(false); // the input is untouched
    expect(setRead(next, ['b'], false)[1]?.read).toBe(false);
    expect(unreadCount(markAllRead(notes))).toBe(0);
    expect(filterInbox(notes, 'unread').map((note) => note.id)).toEqual(['a', 'c']);
    expect(filterInbox(notes, 'all')).toHaveLength(3);
    expect(newArrivals(new Set(['a', 'b']), notes).map((note) => note.id)).toEqual(['c']);
    // The framework-free engine exports the same helpers.
    expect(engine.setRead).toBe(setRead);
    expect(resolveInboxLabels({ title: 'Inbox', arrived: 3 as never }).arrived(1)).toBe(
      '1 new notification.'
    );
  });
});

describe('NotificationInbox (G19)', () => {
  const state = () =>
    JSON.parse(screen.getByTestId('state').textContent ?? '{}') as {
      filter: string;
      archived: string[];
      opened: string[];
      read: boolean[];
    };

  it('shows unread state, toggles read, marks all, keeps items in the unread view, runs item actions and announces arrivals', async () => {
    render(InboxHarness);
    const inbox = screen.getByRole('region', { name: /Notifications/ });
    const heading = within(inbox).getByRole('heading', { level: 2 });
    expect(heading.textContent?.replace(/\s+/g, ' ').trim()).toBe('Notifications 2, 2 unread');
    const items = () => within(inbox).getAllByRole('article');
    expect(items()).toHaveLength(3);
    // Unread items say so before their title; times are machine-readable.
    expect(items()[0]?.textContent).toContain('Unread:');
    expect(items()[2]?.textContent).not.toContain('Unread:');
    expect(items()[0]?.querySelector('time')?.getAttribute('datetime')).toBe(
      '2026-10-28T09:00:00.000Z'
    );
    expect(items()[0]?.querySelector('time')?.textContent).toBe('Today, 9:00 AM');

    // URL policy: the relative app route is refused at the default untrusted tier, https passes.
    expect(within(items()[0] as HTMLElement).queryByRole('link')).toBeNull();
    expect(
      within(items()[0] as HTMLElement).getByRole('button', { name: 'Ada mentioned you' })
    ).toBeTruthy();
    expect(
      within(items()[1] as HTMLElement)
        .getByRole('link', { name: 'Export ready' })
        .getAttribute('href')
    ).toBe('https://app.example.com/exports/7');

    // Toggle one item read; its name starts with the visible text.
    await fireEvent.click(screen.getByRole('button', { name: 'Mark as read: Export ready' }));
    expect(state().read).toEqual([false, true, true]);
    expect(screen.getByRole('button', { name: 'Mark as unread: Export ready' })).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Mark as unread: Export ready' }));
    expect(state().read).toEqual([false, false, true]);

    // Opening an unread item marks it read and calls onOpen.
    await fireEvent.click(screen.getByRole('button', { name: 'Ada mentioned you' }));
    expect(state().opened).toEqual(['n1']);
    expect(state().read[0]).toBe(true);

    // The unread view lists unread items and keeps those read while it is open.
    const views = within(inbox).getByRole('group', { name: 'Show' });
    await fireEvent.click(within(views).getByRole('button', { name: 'Unread' }));
    expect(state().filter).toBe('unread');
    expect(within(views).getByRole('button', { name: 'Unread' }).getAttribute('aria-pressed')).toBe(
      'true'
    );
    expect(items()).toHaveLength(1);
    const toggle = screen.getByRole('button', { name: 'Mark as read: Export ready' });
    toggle.focus();
    await fireEvent.click(toggle);
    expect(items()).toHaveLength(1);
    expect(document.activeElement).toBe(toggle);
    await fireEvent.click(within(views).getByRole('button', { name: 'All' }));
    await fireEvent.click(within(views).getByRole('button', { name: 'Unread' }));
    expect(within(inbox).getByText('You are all caught up.')).toBeTruthy();
    await fireEvent.click(within(views).getByRole('button', { name: 'All' }));

    // Mark all read: aria-disabled once nothing is unread (it never loses focus).
    await fireEvent.click(screen.getByRole('button', { name: 'Mark as unread: Weekly digest' }));
    const markAll = screen.getByRole('button', { name: 'Mark all as read' });
    expect(markAll.getAttribute('aria-disabled')).toBe('false');
    await fireEvent.click(markAll);
    expect(state().read).toEqual([true, true, true]);
    expect(markAll.getAttribute('aria-disabled')).toBe('true');
    expect(heading.textContent?.trim()).toBe('Notifications');

    // Per-item actions receive their item.
    await fireEvent.click(screen.getByRole('button', { name: 'Archive Weekly digest' }));
    expect(state().archived).toEqual(['n3']);

    // A new unread arrival is announced politely; the first render was not.
    const status = inbox.querySelector('[role="status"]') as HTMLElement;
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toBe('');
    await fireEvent.click(screen.getByRole('button', { name: 'Simulate arrival' }));
    await tick();
    expect(status.textContent).toBe('1 new notification.');
    expect(items()).toHaveLength(4);
    // A second batch of the same size is spoken again: the status clears, then refills.
    const spoken: string[] = [];
    const observer = new MutationObserver(() => spoken.push(status.textContent ?? ''));
    observer.observe(status, { childList: true, characterData: true, subtree: true });
    await fireEvent.click(screen.getByRole('button', { name: 'Simulate arrival' }));
    await waitFor(() => expect(spoken.at(-1)).toBe('1 new notification.'));
    observer.disconnect();
    expect(spoken).toContain('');
    expect(items()).toHaveLength(5);
  });

  it('renders app routes at the developer tier and never renders unsafe links', async () => {
    render(InboxHarness, { props: { hrefTrust: 'developer' } });
    expect(screen.getByRole('link', { name: 'Ada mentioned you' }).getAttribute('href')).toBe(
      '/deals/d1'
    );
    cleanup();
    const { default: Inbox } = await import('../src/activity/inbox/NotificationInbox.svelte');
    render(Inbox, {
      props: {
        now: 0,
        hrefTrust: 'developer',
        items: [
          { id: 'x', title: 'Bad <b>link</b>', at: 0, read: false, href: 'javascript:alert(1)' },
        ],
      },
    });
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('Bad <b>link</b>')).toBeTruthy();
  });

  it('hides mark-unread for hosts that persist only mark-read, and reports mark-unread separately (G50)', async () => {
    const { default: Inbox } = await import('../src/activity/inbox/NotificationInbox.svelte');
    const items = [
      { id: 'u', title: 'Unread one', at: 0, read: false },
      { id: 'r', title: 'Read one', at: 0, read: true },
    ];
    const changes: [string[], boolean][] = [];
    const unread: string[][] = [];
    for (const allowMarkUnread of [false, true]) {
      render(Inbox, {
        props: {
          now: 0,
          items,
          allowMarkUnread,
          onReadChange: (ids: string[], read: boolean) => changes.push([ids, read]),
          onMarkUnread: (ids: string[]) => unread.push(ids),
        },
      });
      // Unread items always offer "Mark read".
      await fireEvent.click(screen.getByRole('button', { name: 'Mark as read: Unread one' }));
      const toggle = screen.queryByRole('button', { name: 'Mark as unread: Read one' });
      expect(toggle === null, `allowMarkUnread ${allowMarkUnread}`).toBe(!allowMarkUnread);
      if (toggle) await fireEvent.click(toggle);
      cleanup();
    }
    expect(changes).toEqual([
      [['u'], true],
      [['u'], true],
      [['r'], false],
    ]);
    expect(unread).toEqual([['r']]);
  });

  it('tells mark all, a row toggle and opening apart, and routes mark all to onMarkAllRead when given (G106)', async () => {
    const { default: Inbox } = await import('../src/activity/inbox/NotificationInbox.svelte');
    const items = [{ id: 'u', title: 'Only unread', at: 0, read: false }];
    const calls: unknown[][] = [];
    const onReadChange = (ids: string[], read: boolean, context?: { source: string }) => {
      calls.push(['change', ids, read, context?.source]);
    };
    render(Inbox, { props: { now: 0, items, onReadChange, onOpen: () => {} } });
    await fireEvent.click(screen.getByRole('button', { name: 'Mark all as read' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Mark as read: Only unread' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Only unread' }));
    cleanup();
    render(Inbox, {
      props: {
        now: 0,
        items,
        onReadChange,
        onMarkAllRead: (ids: string[]) => {
          calls.push(['all', ids]);
        },
      },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Mark all as read' }));
    expect(calls).toEqual([
      ['change', ['u'], true, 'all'],
      ['change', ['u'], true, 'item'],
      ['change', ['u'], true, 'open'],
      ['all', ['u']],
    ]);
  });

  it('marks the control that started a pending save busy until it settles, and announces a failure (G106)', async () => {
    const { default: Inbox } = await import('../src/activity/inbox/NotificationInbox.svelte');
    const items = [
      { id: 'u', title: 'First', at: 0, read: false },
      { id: 'v', title: 'Second', at: 0, read: false },
    ];
    let settle: { resolve: () => void; reject: (error: Error) => void } | undefined;
    const pendingSave = () =>
      new Promise<void>((resolve, reject) => {
        settle = { resolve, reject };
      });
    let saves = 0;
    render(Inbox, {
      props: {
        now: 0,
        items,
        onReadChange: () => {
          saves += 1;
          return pendingSave();
        },
        onMarkAllRead: () => pendingSave(),
      },
    });
    const status = () => document.querySelector('.tx-inbox [role="status"]')?.textContent ?? '';
    const busy = (button: HTMLElement) => [
      button.getAttribute('aria-busy'),
      button.getAttribute('aria-disabled'),
      Boolean(button.querySelector('[data-tx-inbox-spinner]')),
      button.classList.contains('tx-inbox__button'),
    ];
    const row = screen.getByRole('button', { name: 'Mark as read: First' });
    const other = screen.getByRole('button', { name: 'Mark as read: Second' });
    row.focus();
    await fireEvent.click(row);
    expect(busy(row)).toEqual(['true', 'true', true, true]);
    // Only the control that started the save is pending; a second click does nothing.
    expect(busy(other)).toEqual([null, null, false, true]);
    await fireEvent.click(row);
    expect(saves).toBe(1);
    expect(document.activeElement).toBe(row);
    settle?.resolve();
    await waitFor(() => expect(busy(row)).toEqual([null, null, false, true]));
    expect(status()).toBe('');

    const all = screen.getByRole('button', { name: 'Mark all as read' });
    await fireEvent.click(all);
    expect(busy(all)).toEqual(['true', 'true', true, true]);
    settle?.reject(new Error('offline'));
    await waitFor(() => expect(status()).toBe('Could not update the read state. Try again.'));
    // Settled: still two unread, so "Mark all" is enabled again.
    expect(busy(all)).toEqual([null, 'false', false, true]);
  });
});
