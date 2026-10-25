import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import PopoverFixture from './popover-fixture.svelte';

describe('Popover', () => {
  it('opens a non-modal panel, focuses its first control, and restores focus on Escape', async () => {
    const { container } = render(PopoverFixture);
    const trigger = screen.getByRole('button', { name: 'Filters' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    fireEvent.click(trigger);

    await waitFor(() => expect(trigger.getAttribute('aria-expanded')).toBe('true'));
    const panel = container.querySelector<HTMLElement>('[role="dialog"]');
    expect(panel).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Assigned to me' })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('checkbox', { name: 'Assigned to me' }));
    expect(panel?.getAttribute('aria-modal')).toBeNull();
    expect(screen.getByRole('button', { name: 'Outside action' }).hasAttribute('inert')).toBe(
      false
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(trigger.getAttribute('aria-expanded')).toBe('false'));
    expect(document.activeElement).toBe(trigger);
  });

  it('makes outside content inert and restores focus when a modal popover closes', async () => {
    render(PopoverFixture, { props: { modal: true } });
    const trigger = screen.getByRole('button', { name: 'Filters' });
    fireEvent.click(trigger);

    const panel = await screen.findByRole('dialog', { name: 'Filter tasks' });
    expect(panel.getAttribute('aria-modal')).toBe('true');
    // The modal features load lazily (non-modal popovers never bundle them).
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Outside action' }).hasAttribute('inert')).toBe(
        true
      )
    );
    expect(document.activeElement).toBe(screen.getByRole('checkbox', { name: 'Assigned to me' }));

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Filters' }).getAttribute('aria-expanded')).toBe(
        'false'
      )
    );
    expect(document.activeElement).toBe(trigger);
  });

  it('closes through its close part and keeps the bindable open state synchronized', async () => {
    render(PopoverFixture);
    const trigger = screen.getByRole('button', { name: 'Filters' });
    fireEvent.click(trigger);
    await screen.findByRole('dialog', { name: 'Filter tasks' });
    expect(screen.getByText('open', { selector: '[data-open-state]' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(trigger.getAttribute('aria-expanded')).toBe('false'));
    expect(screen.getByText('closed', { selector: '[data-open-state]' })).toBeTruthy();
    expect(document.activeElement).toBe(trigger);
  });

  describe('initialFocus', () => {
    async function open(props: { modal?: boolean; focusTarget?: 'search' | 'none' | 'outside' }) {
      render(PopoverFixture, { props });
      fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
      return screen.findByRole('dialog', { name: 'Filter tasks' });
    }

    it('focuses the target inside a non-modal popover on open', async () => {
      await open({ focusTarget: 'search' });
      await waitFor(() =>
        expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Search filters' }))
      );
    });

    it('focuses the target inside a modal popover on open', async () => {
      await open({ modal: true, focusTarget: 'search' });
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Outside action' }).hasAttribute('inert')).toBe(
          true
        )
      );
      expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Search filters' }));
    });

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
