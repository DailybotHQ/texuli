import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import EmptyState from '../src/components/empty/EmptyState.svelte';
import ErrorState from '../src/components/empty/ErrorState.svelte';

afterEach(cleanup);

describe('EmptyState', () => {
  it('renders title, description and default illustration', () => {
    const view = render(EmptyState, {
      props: {
        title: 'No notes yet',
        description: 'Create a note to get started.',
      },
    });
    expect(view.getByText('No notes yet')).toBeTruthy();
    expect(view.getByText('Create a note to get started.')).toBeTruthy();
    expect(view.container.querySelector('[data-tx-empty-icon]')).toBeTruthy();
    expect(view.container.querySelector('[data-tx-empty]')?.getAttribute('data-size')).toBe('md');
  });

  it('supports sm size and custom illustration plus actions', () => {
    const illustration = createRawSnippet(() => ({
      render: () => '<span data-custom-ill>★</span>',
    }));
    const action = createRawSnippet(() => ({
      render: () => '<button type="button">Add note</button>',
    }));
    const view = render(EmptyState, {
      props: {
        title: 'Empty',
        size: 'sm',
        illustration,
        action,
      },
    });
    expect(view.container.querySelector('[data-size="sm"]')).toBeTruthy();
    expect(view.container.querySelector('[data-custom-ill]')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Add note' })).toBeTruthy();
  });
});

describe('ErrorState', () => {
  it('is a live alert with title and message', () => {
    const view = render(ErrorState, {
      props: {
        title: 'Could not load',
        message: 'The network is offline (simulated).',
      },
    });
    const alert = view.getByRole('alert');
    expect(alert.textContent).toContain('Could not load');
    expect(alert.textContent).toContain('The network is offline');
  });

  it('runs onRetry through a pending Button', async () => {
    let resolve!: () => void;
    const gate = new Promise<void>((r) => {
      resolve = r;
    });
    const onRetry = vi.fn(() => gate);
    const view = render(ErrorState, {
      props: { onRetry, retryLabel: 'Try again' },
    });
    const btn = view.getByRole('button', { name: 'Try again' });
    await fireEvent.click(btn);
    expect(onRetry).toHaveBeenCalledOnce();
    await waitFor(() => expect(btn.getAttribute('aria-busy')).toBe('true'));
    resolve();
    await waitFor(() => expect(btn.getAttribute('aria-busy')).not.toBe('true'));
  });

  it('uses default title when omitted', () => {
    const view = render(ErrorState, { props: {} });
    expect(view.getByText('Something went wrong')).toBeTruthy();
  });
});
