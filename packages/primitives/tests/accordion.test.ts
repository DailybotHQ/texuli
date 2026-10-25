import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Fixture from './accordion-fixture.svelte';
import MissingRoot from './accordion-missing-root-fixture.svelte';

afterEach(cleanup);

const trigger = (name: string) => screen.getByRole('button', { name }) as HTMLElement;
const region = (name: string) => screen.queryByRole('region', { name });
const press = async (key: string, target: Element = document.activeElement as Element) => {
  await fireEvent.keyDown(target, { key });
};

describe('Accordion: structure (APG)', () => {
  it('renders each trigger as a button inside a level-3 heading, collapsed', () => {
    render(Fixture);
    const headings = screen.getAllByRole('heading', { level: 3 });
    expect(headings.map((h) => h.textContent?.trim())).toEqual([
      'Shipping',
      'Returns',
      'Warranty',
      'Support',
    ]);
    for (const heading of headings) {
      expect(heading.tagName).toBe('H3');
      expect(heading.querySelector('button')).not.toBeNull();
    }
    const shipping = trigger('Shipping');
    expect(shipping.getAttribute('aria-expanded')).toBe('false');
    expect(shipping.getAttribute('type')).toBe('button');
    expect(shipping.dataset.state).toBe('closed');
    expect(screen.queryAllByRole('region')).toHaveLength(0);
  });

  it('wires the trigger and its region to each other', async () => {
    render(Fixture);
    await fireEvent.click(trigger('Shipping'));
    const panel = region('Shipping');
    expect(panel).not.toBeNull();
    expect(trigger('Shipping').getAttribute('aria-controls')).toBe(panel?.id);
    expect(panel?.getAttribute('aria-labelledby')).toBe(trigger('Shipping').id);
    expect(panel?.textContent).toContain('Orders ship within two fictional days.');
  });

  it('gives every trigger a unique id', () => {
    render(Fixture);
    const ids = screen
      .getAllByRole('button')
      .map((button) => button.id)
      .filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(4);
  });

  it('takes the heading level from the header and keeps it in range', () => {
    const { unmount } = render(Fixture, { props: { level: 2 } });
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(4);
    unmount();
    render(Fixture, { props: { level: 9 as 6 } });
    expect(screen.getAllByRole('heading', { level: 6 })).toHaveLength(4);
  });

  it('keeps every trigger in the Tab order (no roving tabindex)', () => {
    render(Fixture);
    for (const name of ['Shipping', 'Returns', 'Support']) {
      expect(trigger(name).hasAttribute('tabindex')).toBe(false);
    }
  });

  it('marks every part with data-state and data-orientation', async () => {
    render(Fixture);
    await fireEvent.click(trigger('Returns'));
    const item = screen.getByTestId('item-returns');
    const heading = trigger('Returns').closest('h3') as HTMLElement;
    const panel = region('Returns') as HTMLElement;
    for (const part of [item, heading, trigger('Returns'), panel]) {
      expect(part.dataset.state).toBe('open');
      expect(part.dataset.orientation).toBe('vertical');
    }
    expect(screen.getByTestId('item-shipping').dataset.state).toBe('closed');
    expect(screen.getByTestId('root').dataset.orientation).toBe('vertical');
  });

  it('throws a clear error when an item has no root', () => {
    expect(() => render(MissingRoot)).toThrow('Missing Accordion.Root provider');
  });
});

describe('Accordion: single and multiple', () => {
  it('opens one item at a time in single mode and reports the value', async () => {
    const onValueChange = vi.fn();
    render(Fixture, { props: { onValueChange } });
    await fireEvent.click(trigger('Shipping'));
    await fireEvent.click(trigger('Returns'));
    expect(trigger('Shipping').getAttribute('aria-expanded')).toBe('false');
    expect(trigger('Returns').getAttribute('aria-expanded')).toBe('true');
    // Presence keeps the closing panel for one frame so CSS can paint "closed".
    await waitFor(() => expect(region('Shipping')).toBeNull());
    expect(onValueChange.mock.calls.map((call) => call[0])).toEqual(['shipping', 'returns']);
  });

  it('lets the open item close in single mode by default (collapsible)', async () => {
    const onValueChange = vi.fn();
    render(Fixture, { props: { onValueChange } });
    await fireEvent.click(trigger('Support'));
    await fireEvent.click(trigger('Support'));
    expect(trigger('Support').getAttribute('aria-expanded')).toBe('false');
    expect(onValueChange).toHaveBeenLastCalledWith('');
  });

  it('keeps the open item open when not collapsible, and says so with aria-disabled', async () => {
    const onValueChange = vi.fn();
    render(Fixture, { props: { collapsible: false, value: 'shipping', onValueChange } });
    expect(trigger('Shipping').getAttribute('aria-disabled')).toBe('true');
    expect(trigger('Returns').hasAttribute('aria-disabled')).toBe(false);
    await fireEvent.click(trigger('Shipping'));
    expect(trigger('Shipping').getAttribute('aria-expanded')).toBe('true');
    expect(onValueChange).not.toHaveBeenCalled();
    await fireEvent.click(trigger('Returns'));
    expect(trigger('Shipping').hasAttribute('aria-disabled')).toBe(false);
    expect(trigger('Returns').getAttribute('aria-disabled')).toBe('true');
  });

  it('opens items independently in multiple mode', async () => {
    const onValueChange = vi.fn();
    render(Fixture, { props: { type: 'multiple', onValueChange } });
    await fireEvent.click(trigger('Shipping'));
    await fireEvent.click(trigger('Support'));
    expect(region('Shipping')).not.toBeNull();
    expect(region('Support')).not.toBeNull();
    await fireEvent.click(trigger('Shipping'));
    await waitFor(() => expect(region('Shipping')).toBeNull());
    expect(onValueChange.mock.calls.map((call) => call[0])).toEqual([
      ['shipping'],
      ['shipping', 'support'],
      ['support'],
    ]);
  });

  it('starts from a given value', () => {
    render(Fixture, { props: { type: 'multiple', value: ['returns', 'support'] } });
    expect(region('Returns')).not.toBeNull();
    expect(region('Support')).not.toBeNull();
    expect(region('Shipping')).toBeNull();
  });
});

describe('Accordion: disabled', () => {
  it('disables an item so it cannot open', async () => {
    render(Fixture);
    const warranty = trigger('Warranty') as HTMLButtonElement;
    expect(warranty.disabled).toBe(true);
    expect(screen.getByTestId('item-warranty').hasAttribute('data-disabled')).toBe(true);
    await fireEvent.click(warranty);
    expect(warranty.getAttribute('aria-expanded')).toBe('false');
  });

  it('disables every item through the root', async () => {
    render(Fixture, { props: { disabled: true } });
    for (const name of ['Shipping', 'Returns', 'Warranty', 'Support']) {
      expect((trigger(name) as HTMLButtonElement).disabled).toBe(true);
    }
    expect(screen.getByTestId('root').hasAttribute('data-disabled')).toBe(true);
  });
});

describe('Accordion: keyboard', () => {
  it('moves with the arrow keys, skipping the disabled trigger and wrapping', async () => {
    render(Fixture);
    trigger('Returns').focus();
    await press('ArrowDown');
    expect(document.activeElement).toBe(trigger('Support'));
    await press('ArrowDown');
    expect(document.activeElement).toBe(trigger('Shipping'));
    await press('ArrowUp');
    expect(document.activeElement).toBe(trigger('Support'));
    await press('ArrowUp');
    expect(document.activeElement).toBe(trigger('Returns'));
  });

  it('leaves arrows held with a modifier to the platform', async () => {
    render(Fixture);
    trigger('Shipping').focus();
    for (const modifier of ['ctrlKey', 'metaKey', 'altKey'] as const) {
      await fireEvent.keyDown(trigger('Shipping'), { key: 'ArrowDown', [modifier]: true });
      expect(document.activeElement).toBe(trigger('Shipping'));
    }
  });

  it('jumps with Home and End', async () => {
    render(Fixture);
    trigger('Returns').focus();
    await press('End');
    expect(document.activeElement).toBe(trigger('Support'));
    await press('Home');
    expect(document.activeElement).toBe(trigger('Shipping'));
  });

  it('stops at the ends when loop is off', async () => {
    render(Fixture, { props: { loop: false } });
    trigger('Support').focus();
    await press('ArrowDown');
    expect(document.activeElement).toBe(trigger('Support'));
  });

  it('uses left and right in horizontal orientation, flipped in RTL', async () => {
    const { unmount } = render(Fixture, { props: { orientation: 'horizontal' } });
    trigger('Shipping').focus();
    await press('ArrowDown');
    expect(document.activeElement).toBe(trigger('Shipping'));
    await press('ArrowRight');
    expect(document.activeElement).toBe(trigger('Returns'));
    unmount();

    render(Fixture, { props: { orientation: 'horizontal', dir: 'rtl' } });
    trigger('Shipping').focus();
    await press('ArrowLeft');
    expect(document.activeElement).toBe(trigger('Returns'));
  });

  it('prevents the default action only when focus moves', async () => {
    render(Fixture);
    trigger('Shipping').focus();
    const moved = new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    });
    trigger('Shipping').dispatchEvent(moved);
    expect(moved.defaultPrevented).toBe(true);
    const other = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
    trigger('Shipping').dispatchEvent(other);
    expect(other.defaultPrevented).toBe(false);
  });

  it('keeps a nested accordion’s arrows inside it', async () => {
    render(Fixture, { props: { value: 'support', nested: true } });
    const email = trigger('Email');
    email.focus();
    await press('ArrowDown');
    expect(document.activeElement).toBe(trigger('Phone'));
    await press('ArrowDown');
    expect(document.activeElement).toBe(trigger('Email'));
    // The outer accordion still moves among its own triggers.
    trigger('Support').focus();
    await press('ArrowDown');
    expect(document.activeElement).toBe(trigger('Shipping'));
  });
});

describe('Accordion: content', () => {
  it('keeps closed content in the DOM but hidden with forceMount', async () => {
    render(Fixture, { props: { forceMount: true } });
    const hidden = document.getElementById(trigger('Shipping').getAttribute('aria-controls') ?? '');
    expect(hidden).not.toBeNull();
    expect(hidden?.hidden).toBe(true);
    expect(region('Shipping')).toBeNull();
    await fireEvent.click(trigger('Shipping'));
    expect(region('Shipping')?.hidden).toBe(false);
  });

  it('exposes its measured size as CSS variables for height animations', async () => {
    render(Fixture);
    await fireEvent.click(trigger('Returns'));
    flushSync();
    const panel = region('Returns') as HTMLElement;
    expect(panel.style.getPropertyValue('--tx-accordion-content-height')).toMatch(/^\d+px$/);
    expect(panel.style.getPropertyValue('--tx-accordion-content-width')).toMatch(/^\d+px$/);
  });
});

describe('Accordion: exit animation (presence)', () => {
  it('keeps a closing panel mounted until its exit animation ends', async () => {
    const style = document.createElement('style');
    style.textContent =
      "[role='region'][data-state='closed'] { animation-name: tx-close; animation-duration: 300ms; }";
    document.head.append(style);
    try {
      render(Fixture);
      await fireEvent.click(trigger('Returns'));
      const panel = region('Returns') as HTMLElement;
      await fireEvent.click(trigger('Returns'));
      flushSync();
      // Closing, but still in the DOM, visible to the animation and not hidden.
      expect(panel.isConnected).toBe(true);
      expect(panel.dataset.state).toBe('closed');
      expect(panel.hidden).toBe(false);
      // A re-render while exiting (another item opens) must not cut the exit short.
      await fireEvent.click(trigger('Shipping'));
      flushSync();
      expect(panel.isConnected).toBe(true);
      panel.dispatchEvent(new Event('animationend'));
      flushSync();
      expect(panel.isConnected).toBe(false);
    } finally {
      style.remove();
    }
  });
});

describe('Accordion: composition', () => {
  it('spreads trigger props on a child snippet element', async () => {
    render(Fixture, { props: { childTrigger: true } });
    const custom = trigger('Shipping');
    expect(custom.tagName).toBe('SPAN');
    expect(custom.classList.contains('custom-trigger')).toBe(true);
    expect(custom.getAttribute('aria-expanded')).toBe('false');
    await fireEvent.click(custom);
    expect(custom.getAttribute('aria-expanded')).toBe('true');
    expect(region('Shipping')).not.toBeNull();
  });

  it('lets a consumer click handler cancel the toggle', async () => {
    const onTriggerClick = vi.fn((event: MouseEvent) => event.preventDefault());
    render(Fixture, { props: { onTriggerClick } });
    await fireEvent.click(trigger('Shipping'));
    expect(onTriggerClick).toHaveBeenCalledOnce();
    expect(trigger('Shipping').getAttribute('aria-expanded')).toBe('false');
  });
});
