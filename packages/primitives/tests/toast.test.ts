import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createToastManager } from '../src/toast/manager.ts';
import ToastFixture from './toast-fixture.svelte';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('createToastManager', () => {
  it('lists toasts published in the same millisecond newest first', () => {
    let id = 0;
    const manager = createToastManager({ now: () => 1000, createId: () => `t${++id}` });
    manager.publish({ title: 'First' });
    manager.publish({ title: 'Second' });
    manager.publish({ title: 'Third' });
    expect(manager.list().map((item) => item.title)).toEqual(['Third', 'Second', 'First']);
  });

  it('orders by priority then recency and enforces max', () => {
    let t = 0;
    const manager = createToastManager({
      max: 2,
      now: () => ++t,
      createId: () => `id-${t}`,
    });
    manager.publish({ title: 'low', priority: 'low' });
    manager.publish({ title: 'high', priority: 'high' });
    manager.publish({ title: 'normal', priority: 'normal' });
    const list = manager.list();
    expect(list).toHaveLength(2);
    expect(list[0]?.priority).toBe('high');
    expect(list[1]?.priority).toBe('normal');
  });

  it('dismisses by id and clears all', () => {
    const manager = createToastManager({ createId: () => 'a' });
    const id = manager.publish({ title: 'One' });
    expect(manager.list()).toHaveLength(1);
    manager.dismiss(id);
    expect(manager.list()).toHaveLength(0);
    manager.publish({ id: 'x', title: 'X' });
    manager.publish({ id: 'y', title: 'Y' });
    manager.dismissAll();
    expect(manager.list()).toHaveLength(0);
  });
});

describe('Toast region', () => {
  it('renders a labelled region and published toast content', async () => {
    const { getByRole, getByText } = render(ToastFixture);
    expect(getByRole('region', { name: 'Notifications' })).toBeTruthy();
    await fireEvent.click(getByRole('button', { name: 'Publish toast' }));
    expect(getByText('File saved')).toBeTruthy();
    expect(getByText('Undo is available.')).toBeTruthy();
  });

  it('dismisses from Close and Action', async () => {
    const { getByRole, queryByText } = render(ToastFixture);
    await fireEvent.click(getByRole('button', { name: 'Publish toast' }));
    expect(queryByText('File saved')).toBeTruthy();
    await fireEvent.click(getByRole('button', { name: 'Dismiss notification' }));
    expect(queryByText('File saved')).toBeNull();

    await fireEvent.click(getByRole('button', { name: 'Publish toast' }));
    await fireEvent.click(getByRole('button', { name: 'Undo' }));
    expect(queryByText('File saved')).toBeNull();
  });

  it('auto-dismisses after duration when not paused', async () => {
    vi.useFakeTimers();
    const { getByRole, queryByText } = render(ToastFixture, {
      props: { duration: 1000 },
    });
    await fireEvent.click(getByRole('button', { name: 'Publish toast' }));
    expect(queryByText('File saved')).toBeTruthy();
    await vi.advanceTimersByTimeAsync(1100);
    expect(queryByText('File saved')).toBeNull();
  });

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

  it('focuses a toast action on F6', async () => {
    const { getByRole } = render(ToastFixture, { props: { duration: 0 } });
    await fireEvent.click(getByRole('button', { name: 'Publish toast' }));
    const action = getByRole('button', { name: 'Undo' });
    await fireEvent.keyDown(document, { key: 'F6' });
    expect(document.activeElement).toBe(action);
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
