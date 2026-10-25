import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { getInertRegistry } from '@texuli/core/inert';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dismissDirection, releaseTarget, resolveSheetSide } from '../src/sheet/index.ts';
import Fixture from './sheet-fixture.svelte';

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

const isInert = (element: Element) =>
  getInertRegistry()
    .inertElements()
    .some((inert) => inert.contains(element));

/** Drag a drawer along y by `distance`, holding still before release (no fling). */
async function dragY(element: Element, distance: number, start: Element = element) {
  const pointer = { pointerId: 7, pointerType: 'touch', clientX: 100 };
  await fireEvent.pointerDown(start, { ...pointer, clientY: 100 });
  await fireEvent.pointerMove(element, { ...pointer, clientY: 100 + distance });
  await fireEvent.pointerMove(element, { ...pointer, clientY: 100 + distance });
  await fireEvent.pointerUp(element, { ...pointer, clientY: 100 + distance });
}

describe('sheet model', () => {
  it('drags toward the attached edge to dismiss', () => {
    expect(dismissDirection('bottom')).toEqual({ axis: 'y', sign: 1 });
    expect(dismissDirection('top')).toEqual({ axis: 'y', sign: -1 });
    expect(dismissDirection('right')).toEqual({ axis: 'x', sign: 1 });
    expect(dismissDirection('left')).toEqual({ axis: 'x', sign: -1 });
  });

  it('maps logical inline sides by direction and keeps physical sides fixed', () => {
    expect(resolveSheetSide('start', 'ltr')).toBe('left');
    expect(resolveSheetSide('start', 'rtl')).toBe('right');
    expect(resolveSheetSide('end', 'rtl')).toBe('left');
    expect(resolveSheetSide('left', 'rtl')).toBe('left');
  });

  it('settles on the nearest snap point, projecting the release speed', () => {
    // Full height 400: snap 1 sits at 0, snap 0.5 at 200, closed at 400.
    expect(releaseTarget(40, 0, 400, [1], true)).toBe(0);
    expect(releaseTarget(260, 0, 400, [1], true)).toBe(-1);
    expect(releaseTarget(40, 1, 400, [1], true)).toBe(-1);
    expect(releaseTarget(150, 0, 400, [0.5, 1], true)).toBe(0);
    expect(releaseTarget(90, 0, 400, [0.5, 1], true)).toBe(1);
    expect(releaseTarget(380, 0, 400, [0.5, 1], false)).toBe(0);
  });
});

describe('Sheet (modal dialog on an edge)', () => {
  it('opens a logical start sheet on the right in RTL', async () => {
    render(Fixture, { props: { side: 'start', dir: 'rtl' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Open filters' }));
    const sheet = await screen.findByRole('dialog', { name: 'Filters' });
    await waitFor(() => expect(sheet.getAttribute('data-side')).toBe('right'));
  });

  it('opens on a side as a named modal dialog and restores focus on Escape', async () => {
    render(Fixture, { props: { side: 'left' } });
    const trigger = screen.getByRole('button', { name: 'Open filters' });
    await fireEvent.click(trigger);
    const sheet = await screen.findByRole('dialog', { name: 'Filters' });
    expect(sheet.getAttribute('aria-modal')).toBe('true');
    expect(sheet.dataset.side).toBe('left');
    expect(sheet.hasAttribute('data-snap-point')).toBe(false);
    expect(sheet.contains(document.activeElement)).toBe(true);
    expect(isInert(screen.getByRole('button', { name: 'Page action' }))).toBe(true);
    await fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });
});

describe('Panel (non-modal)', () => {
  it('takes focus but leaves the page usable, and closes on Escape from inside', async () => {
    render(Fixture, { props: { kind: 'panel' } });
    const trigger = screen.getByRole('button', { name: 'Show details' });
    trigger.focus();
    await fireEvent.click(trigger);
    const panel = await screen.findByRole('dialog', { name: 'Order details' });
    expect(panel.hasAttribute('aria-modal')).toBe(false);
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Copy id' }))
    );
    const page = screen.getByRole('button', { name: 'Page action' });
    expect(isInert(page)).toBe(false);
    expect(document.documentElement.style.overflow).toBe('');
    // Working with the page neither dismisses it nor is captured by it.
    await fireEvent.pointerDown(page);
    page.focus();
    await fireEvent.keyDown(page, { key: 'Escape' });
    await tick();
    expect(screen.getByRole('dialog', { name: 'Order details' })).toBe(panel);
    screen.getByRole('button', { name: 'Copy id' }).focus();
    await fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });
});

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
  it('springs back from a short drag and dismisses past halfway', async () => {
    render(Fixture, { props: { kind: 'drawer', open: true } });
    const drawer = await screen.findByRole('dialog', { name: 'Cart' });
    expect(drawer.dataset.side).toBe('bottom');
    expect(drawer.style.touchAction).toBe('pan-x');
    await dragY(drawer, 60);
    expect(screen.getByRole('dialog', { name: 'Cart' })).toBe(drawer);
    expect(drawer.style.transform).toBe('');
    await dragY(drawer, 260);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

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

  it('follows the finger while dragging, never past fully open', async () => {
    render(Fixture, { props: { kind: 'drawer', open: true } });
    const drawer = await screen.findByRole('dialog', { name: 'Cart' });
    const pointer = { pointerId: 3, pointerType: 'mouse', button: 0, clientX: 50 };
    await fireEvent.pointerDown(drawer, { ...pointer, clientY: 100 });
    await fireEvent.pointerMove(drawer, { ...pointer, clientY: 180 });
    expect(drawer.style.transform).toBe('translateY(80px)');
    expect(drawer.hasAttribute('data-dragging')).toBe(true);
    await fireEvent.pointerMove(drawer, { ...pointer, clientY: 20 });
    expect(drawer.style.transform).toBe('translateY(0px)');
    await fireEvent.pointerCancel(drawer, { ...pointer, clientY: 20 });
    expect(drawer.hasAttribute('data-dragging')).toBe(false);
  });

  it('moves between snap points by drag and by the handle button', async () => {
    const onSnapPointChange = vi.fn();
    render(Fixture, {
      props: { kind: 'drawer', open: true, snapPoints: [0.5, 1], onSnapPointChange },
    });
    const drawer = await screen.findByRole('dialog', { name: 'Cart' });
    expect(drawer.dataset.snapPoint).toBe('0.5');
    expect(drawer.style.transform).toBe('translateY(50%)');
    await dragY(drawer, -180);
    expect(onSnapPointChange).toHaveBeenLastCalledWith(1);
    expect(drawer.style.transform).toBe('');
    // A later press (a new task) is a real press again.
    await new Promise((resolve) => setTimeout(resolve));
    const handle = screen.getByRole('button', { name: 'Resize cart' });
    await fireEvent.click(handle);
    expect(drawer.dataset.snapPoint).toBe('0.5');
    await fireEvent.click(handle);
    expect(drawer.dataset.snapPoint).toBe('1');
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

  it('renders a decorative grip without snap points', async () => {
    const { container } = render(Fixture, { props: { kind: 'drawer', open: true } });
    await screen.findByRole('dialog', { name: 'Cart' });
    const grip = container.ownerDocument.querySelector('[data-drawer-handle]');
    expect(grip?.tagName).toBe('DIV');
    expect(grip?.getAttribute('aria-hidden')).toBe('true');
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

  it('is a centered dialog on wide screens', async () => {
    stubMedia(false);
    render(Fixture, { props: { kind: 'responsive', open: true } });
    const dialog = await screen.findByRole('dialog', { name: 'Share' });
    expect(dialog.dataset.side).toBe('center');
    expect(dialog.style.touchAction).toBe('');
  });

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
