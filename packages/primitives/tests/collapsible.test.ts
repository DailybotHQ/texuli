import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import CollapsibleHarness from './fixtures/CollapsibleHarness.svelte';

afterEach(cleanup);

describe('@texuli/primitives/collapsible', () => {
  it('renders an APG disclosure button with linked, initially collapsed content', () => {
    render(CollapsibleHarness);
    const trigger = screen.getByRole('button', { name: 'Shipping details' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.getAttribute('aria-controls')).toBe('shipping-content');
    expect(trigger.getAttribute('data-state')).toBe('closed');
    expect(
      document.querySelector<HTMLElement>('#shipping-content')?.getAttribute('aria-hidden')
    ).toBe('true');
    expect(document.querySelector<HTMLElement>('#shipping-content')?.hasAttribute('inert')).toBe(
      true
    );
    expect(document.getElementById(trigger.getAttribute('aria-controls') ?? '')).not.toBeNull();
  });

  it('toggles by activation and reports each requested change', async () => {
    const { container } = render(CollapsibleHarness);
    const trigger = screen.getByRole('button', { name: 'Shipping details' });

    await fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(trigger.getAttribute('data-state')).toBe('open');
    expect(
      screen.getByText('Orders ship within two fictional days.').closest('[hidden]')
    ).toBeNull();
    expect(screen.getByLabelText('Open state').textContent).toBe('true');
    expect(screen.getByLabelText('Open changes').textContent).toBe('true');

    await fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByLabelText('Open changes').textContent).toBe('true,false');

    const content = container.querySelector<HTMLElement>('#shipping-content');
    expect(content?.dataset.state).toBe('closed');
    expect(content?.getAttribute('aria-hidden')).toBe('true');
    expect(content?.hasAttribute('inert')).toBe(true);
  });

  it('starts open when defaultOpen is true and preserves the control relation after exit', async () => {
    const { container } = render(CollapsibleHarness, { props: { initialOpen: true } });
    const trigger = screen.getByRole('button', { name: 'Shipping details' });
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(
      screen.getByText('Orders ship within two fictional days.').closest('[hidden]')
    ).toBeNull();

    await fireEvent.click(trigger);
    const content = container.querySelector<HTMLElement>('#shipping-content');
    expect(content).not.toBeNull();
    expect(content?.getAttribute('data-state')).toBe('closed');
    expect(content?.getAttribute('aria-hidden')).toBe('true');
    expect(content?.hasAttribute('inert')).toBe(true);
    expect(document.getElementById(trigger.getAttribute('aria-controls') ?? '')).toBe(content);
  });

  it('does not open when disabled', async () => {
    render(CollapsibleHarness, { props: { disabled: true } });
    const trigger = screen.getByRole('button', { name: 'Shipping details' });
    expect((trigger as HTMLButtonElement).disabled).toBe(true);
    await fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByLabelText('Open changes').textContent).toBe('');
  });
});
