import { fireEvent, render, screen } from '@testing-library/svelte';
import { flushSync, tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createNavigationMenuController,
  motionBetween,
} from '../src/navigation-menu/controller.ts';
import Fixture from './navigation-menu-fixture.svelte';

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

/** A manual clock for the controller's timers. */
function clock() {
  let now = 0;
  let next = 1;
  const timers = new Map<number, { at: number; run: () => void }>();
  return {
    setTimer: (run: () => void, ms: number) => {
      const id = next++;
      timers.set(id, { at: now + ms, run });
      return id;
    },
    clearTimer: (id: unknown) => {
      timers.delete(id as number);
    },
    advance(ms: number) {
      const end = now + ms;
      for (;;) {
        const due = [...timers.entries()]
          .filter(([, t]) => t.at <= end)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        timers.delete(due[0]);
        now = due[1].at;
        due[1].run();
      }
      now = end;
    },
  };
}

describe('navigation menu controller', () => {
  function setup(delayDuration = 200) {
    const c = clock();
    const onChange = vi.fn();
    const menu = createNavigationMenuController({
      delayDuration,
      skipDelayDuration: 300,
      closeDelay: 150,
      onChange,
      ...c,
    });
    return { c, onChange, menu };
  }

  it('opens on hover after the delay, and a quick pass does not open', () => {
    const { c, onChange, menu } = setup();
    menu.pointerEnterTrigger('products');
    c.advance(199);
    expect(menu.value).toBe('');
    c.advance(1);
    expect(menu.value).toBe('products');
    menu.close();
    c.advance(1000);
    menu.pointerEnterTrigger('resources');
    menu.pointerLeave();
    c.advance(1000);
    expect(onChange.mock.calls.map(([v]) => v)).toEqual(['products', '']);
  });

  it('switches at once between triggers while open and right after closing', () => {
    const { c, menu } = setup();
    menu.pointerEnterTrigger('products');
    c.advance(200);
    menu.pointerEnterTrigger('resources');
    expect(menu.value).toBe('resources');
    menu.close();
    c.advance(299);
    menu.pointerEnterTrigger('products');
    expect(menu.value).toBe('products');
    menu.close();
    c.advance(300);
    menu.pointerEnterTrigger('resources');
    expect(menu.value).toBe('');
  });

  it('closes a hovered item after the grace period unless the pointer enters its content', () => {
    const { c, menu } = setup(0);
    menu.pointerEnterTrigger('products');
    menu.pointerLeave();
    c.advance(100);
    menu.pointerEnterContent();
    c.advance(1000);
    expect(menu.value).toBe('products');
    menu.pointerLeave();
    c.advance(150);
    expect(menu.value).toBe('');
  });

  it('keeps a clicked item open on pointer leave; a second click closes it', () => {
    const { c, menu } = setup();
    menu.toggle('products');
    expect([menu.value, menu.sticky]).toEqual(['products', true]);
    menu.pointerLeave();
    c.advance(1000);
    expect(menu.value).toBe('products');
    menu.toggle('products');
    expect(menu.value).toBe('');
    // A hover-opened item becomes sticky on click instead of closing.
    menu.pointerEnterTrigger('resources');
    c.advance(1000);
    menu.toggle('resources');
    expect([menu.value, menu.sticky]).toEqual(['resources', true]);
  });

  it('syncs a controlled value without notifying, and reports motion direction', () => {
    const { onChange, menu } = setup();
    menu.sync('products');
    expect(menu.value).toBe('products');
    expect(onChange).not.toHaveBeenCalled();
    const order = ['products', 'resources', 'pricing'];
    expect(motionBetween('products', 'resources', order)).toBe('from-end');
    expect(motionBetween('pricing', 'products', order)).toBe('from-start');
    expect(motionBetween('', 'products', order)).toBeUndefined();
  });
});

describe('NavigationMenu', () => {
  const trigger = (name: string) => screen.getByRole('button', { name });

  it('is a labelled navigation landmark of disclosure buttons', () => {
    render(Fixture);
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeTruthy();
    const products = trigger('Products');
    expect(products.getAttribute('aria-expanded')).toBe('false');
    expect(products.getAttribute('aria-controls')).toMatch(/content-products$/);
    expect(products.getAttribute('data-state')).toBe('closed');
    expect(screen.queryByRole('link', { name: 'Analytics' })).toBeNull();
    // The child snippet receives the trigger's props.
    expect(trigger('Resources').className).toBe('custom-trigger');
    expect(trigger('Resources').getAttribute('aria-expanded')).toBe('false');
  });

  it('opens with a click, shows the content labelled by its trigger, and reports the value', async () => {
    const onValueChange = vi.fn();
    render(Fixture, { props: { onValueChange } });
    await fireEvent.click(trigger('Products'));
    expect(trigger('Products').getAttribute('aria-expanded')).toBe('true');
    const panel = screen.getByRole('group', { name: 'Products' });
    expect(panel.id).toBe(trigger('Products').getAttribute('aria-controls'));
    expect(screen.getByRole('link', { name: 'Analytics' }).getAttribute('href')).toBe('/analytics');
    expect(onValueChange).toHaveBeenLastCalledWith('products');
    await fireEvent.click(trigger('Products'));
    expect(onValueChange).toHaveBeenLastCalledWith('');
  });

  it('Escape closes and returns focus to the trigger; ArrowDown enters the content', async () => {
    render(Fixture);
    const products = trigger('Products');
    products.focus();
    await fireEvent.click(products);
    await fireEvent.keyDown(products, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Analytics' }));
    await fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
    expect(screen.queryByRole('group')).toBeNull();
    expect(document.activeElement).toBe(products);
  });

  it('moves between top-level controls with the arrow keys, flipped in RTL', async () => {
    const first = render(Fixture);
    trigger('Products').focus();
    await fireEvent.keyDown(trigger('Products'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(trigger('Resources'));
    await fireEvent.keyDown(trigger('Resources'), { key: 'End' });
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Pricing' }));
    await fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(trigger('Products'));
    first.unmount();
    render(Fixture, { props: { dir: 'rtl' } });
    trigger('Products').focus();
    await fireEvent.keyDown(trigger('Products'), { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(trigger('Resources'));
  });

  it('closes when a link is chosen unless the handler prevents it', async () => {
    const onSelect = vi.fn((_name: string, event: MouseEvent) => event.preventDefault());
    render(Fixture, { props: { onSelect } });
    await fireEvent.click(trigger('Products'));
    await fireEvent.click(screen.getByRole('link', { name: 'Analytics' }));
    expect(onSelect).toHaveBeenCalledWith('analytics', expect.anything());
    expect(screen.queryByRole('group')).not.toBeNull();
    await fireEvent.click(screen.getByRole('link', { name: 'Automation' }));
    expect(screen.queryByRole('group')).toBeNull();
  });

  it('marks the current page and never renders an unsafe href', async () => {
    render(Fixture);
    expect(screen.getByRole('link', { name: 'Pricing' }).getAttribute('aria-current')).toBe('page');
    await fireEvent.click(trigger('Resources'));
    const unsafe = screen.getByText('Unsafe');
    expect(unsafe.hasAttribute('href')).toBe(false);
    expect(unsafe.hasAttribute('data-href-blocked')).toBe(true);
  });

  it('closes on an outside press and when focus moves to another item', async () => {
    render(Fixture);
    await fireEvent.click(trigger('Products'));
    await fireEvent.pointerDown(screen.getByRole('button', { name: 'After' }), { button: 0 });
    expect(screen.queryByRole('group')).toBeNull();
    await fireEvent.click(trigger('Products'));
    trigger('Resources').focus();
    await tick();
    expect(screen.queryByRole('group')).toBeNull();
  });

  it('opens on mouse hover after the delay, never on touch hover', async () => {
    vi.useFakeTimers();
    render(Fixture, { props: { delayDuration: 200 } });
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

  it('renders content in the viewport and bridges Tab between trigger, content and the next item', async () => {
    render(Fixture, { props: { viewport: true } });
    const viewport = screen.getByTestId('viewport');
    expect(viewport.getAttribute('data-state')).toBe('closed');
    const products = trigger('Products');
    products.focus();
    await fireEvent.click(products);
    expect(viewport.getAttribute('data-state')).toBe('open');
    expect(viewport.contains(screen.getByRole('link', { name: 'Analytics' }))).toBe(true);
    await fireEvent.keyDown(products, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Analytics' }));
    await fireEvent.keyDown(document.activeElement as Element, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(products);
    screen.getByRole('link', { name: 'Automation' }).focus();
    await fireEvent.keyDown(document.activeElement as Element, { key: 'Tab' });
    expect(document.activeElement).toBe(trigger('Resources'));
  });

  it('shows the indicator only while an item is open', async () => {
    render(Fixture);
    const indicator = screen.getByTestId('indicator');
    expect(indicator.getAttribute('aria-hidden')).toBe('true');
    expect(indicator.getAttribute('data-state')).toBe('hidden');
    await fireEvent.click(trigger('Products'));
    expect(indicator.getAttribute('data-state')).toBe('visible');
  });

  it('follows a controlled value', async () => {
    const view = render(Fixture, { props: { value: '' } });
    await view.rerender({ value: 'resources' });
    expect(trigger('Resources').getAttribute('aria-expanded')).toBe('true');
    await view.rerender({ value: '' });
    expect(trigger('Resources').getAttribute('aria-expanded')).toBe('false');
  });
});
