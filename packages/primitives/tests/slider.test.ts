import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  closestThumb,
  percentOf,
  sliderKeyAction,
  snapToStep,
  thumbBounds,
  valueFromPointer,
} from '../src/slider/index.ts';
import Fixture from './slider-fixture.svelte';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const slider = (name: string) => screen.getByRole('slider', { name });
const now = (name: string) => Number(slider(name).getAttribute('aria-valuenow'));
const key = (name: string, k: string, extra: Record<string, unknown> = {}) =>
  fireEvent.keyDown(slider(name), { key: k, ...extra });

/** happy-dom has no layout: give the root a 200 × 20 track at (100, 50). */
function mockTrack(root: HTMLElement) {
  vi.spyOn(root, 'getBoundingClientRect').mockReturnValue({
    left: 100,
    top: 50,
    width: 200,
    height: 20,
    right: 300,
    bottom: 70,
    x: 100,
    y: 50,
    toJSON: () => ({}),
  } as DOMRect);
  root.setPointerCapture = vi.fn();
  root.releasePointerCapture = vi.fn();
}

describe('slider math', () => {
  const scale = { min: 0, max: 100, step: 5 };

  it('snaps to the step from min and clamps, without float noise', () => {
    expect(snapToStep(42, scale)).toBe(40);
    expect(snapToStep(43, scale)).toBe(45);
    expect(snapToStep(-7, scale)).toBe(0);
    expect(snapToStep(130, scale)).toBe(100);
    expect(snapToStep(0.30000000000000004, { min: 0, max: 1, step: 0.1 })).toBe(0.3);
    expect(snapToStep(7, { min: 1, max: 11, step: 2 })).toBe(7);
    expect(snapToStep(6, { min: 1, max: 11, step: 2 })).toBe(7);
  });

  it('bounds a thumb by its neighbors and the minimum gap', () => {
    expect(thumbBounds([20, 80], 0, scale)).toEqual([0, 80]);
    expect(thumbBounds([20, 80], 1, scale)).toEqual([20, 100]);
    expect(thumbBounds([20, 80], 0, scale, 2)).toEqual([0, 70]);
    expect(thumbBounds([20, 25], 1, scale, 4)).toEqual([40, 100]);
  });

  it('turns a pointer into a value in every orientation and direction', () => {
    const rect = { left: 100, top: 50, width: 200, height: 100 };
    expect(valueFromPointer({ x: 150, y: 0 }, rect, scale, 'horizontal', false)).toBe(25);
    expect(valueFromPointer({ x: 150, y: 0 }, rect, scale, 'horizontal', true)).toBe(75);
    expect(valueFromPointer({ x: 0, y: 125 }, rect, scale, 'vertical', false)).toBe(25);
    expect(valueFromPointer({ x: 999, y: 0 }, rect, scale, 'horizontal', false)).toBe(100);
  });

  it('picks the nearest thumb, and the pointer side on a tie', () => {
    expect(closestThumb([20, 80], 30)).toBe(0);
    expect(closestThumb([20, 80], 60)).toBe(1);
    expect(closestThumb([50, 50], 60)).toBe(1);
    expect(closestThumb([50, 50], 40)).toBe(0);
  });

  it('maps keys like the APG, flipping horizontal arrows in RTL', () => {
    const options = { step: 1, largeStep: 10, orientation: 'horizontal' as const, rtl: false };
    expect(sliderKeyAction({ key: 'ArrowRight' } as KeyboardEvent, options)).toEqual({ by: 1 });
    expect(
      sliderKeyAction({ key: 'ArrowRight' } as KeyboardEvent, { ...options, rtl: true })
    ).toEqual({ by: -1 });
    expect(sliderKeyAction({ key: 'ArrowUp' } as KeyboardEvent, { ...options, rtl: true })).toEqual(
      { by: 1 }
    );
    expect(sliderKeyAction({ key: 'PageDown' } as KeyboardEvent, options)).toEqual({ by: -10 });
    expect(sliderKeyAction({ key: 'Home' } as KeyboardEvent, options)).toEqual({ to: 'low' });
    expect(sliderKeyAction({ key: 'ArrowUp', ctrlKey: true } as KeyboardEvent, options)).toBeNull();
    expect(sliderKeyAction({ key: 'a' } as KeyboardEvent, options)).toBeNull();
    expect(percentOf(25, 0, 50)).toBe(50);
    expect(percentOf(5, 5, 5)).toBe(0);
  });
});

describe('Slider: APG roles and values', () => {
  it('exposes a focusable slider with its value, bounds and orientation', () => {
    render(Fixture);
    const thumb = slider('Volume');
    expect(thumb.getAttribute('tabindex')).toBe('0');
    expect(thumb.getAttribute('aria-valuenow')).toBe('40');
    expect(thumb.getAttribute('aria-valuemin')).toBe('0');
    expect(thumb.getAttribute('aria-valuemax')).toBe('100');
    expect(thumb.getAttribute('aria-orientation')).toBe('horizontal');
    expect(thumb.dataset.state).toBe('inactive');
  });

  it('speaks a value text when given one', () => {
    render(Fixture, { props: { getValueText: (value: number) => `${value} percent` } });
    expect(slider('Volume').getAttribute('aria-valuetext')).toBe('40 percent');
  });

  it('positions the thumb and range with logical properties', () => {
    render(Fixture);
    expect(slider('Volume').style.getPropertyValue('inset-inline-start')).toBe('40%');
    const range = screen.getByTestId('range');
    expect(range.style.getPropertyValue('inset-inline-start')).toBe('0%');
    expect(range.style.getPropertyValue('inset-inline-end')).toBe('60%');
  });

  it('uses block positions when vertical', () => {
    render(Fixture, { props: { orientation: 'vertical' } });
    expect(slider('Volume').getAttribute('aria-orientation')).toBe('vertical');
    expect(slider('Volume').style.getPropertyValue('inset-block-end')).toBe('40%');
    expect(slider('Volume').style.getPropertyValue('inset-inline-start')).toBe('');
  });

  it('renders decorative ticks, marked when inside the range', () => {
    render(Fixture, { props: { max: 10, value: 4, ticks: true } });
    const ticks = Array.from(document.querySelectorAll<HTMLElement>('[data-tx-slider-tick]'));
    expect(ticks).toHaveLength(11);
    expect(ticks.every((tick) => tick.getAttribute('aria-hidden') === 'true')).toBe(true);
    expect(ticks.filter((tick) => tick.hasAttribute('data-selected'))).toHaveLength(5);
    expect(ticks[10]?.style.getPropertyValue('inset-inline-start')).toBe('100%');
  });
});

describe('Slider: keyboard', () => {
  it('steps with the arrows, pages with PageUp and PageDown, jumps with Home and End', async () => {
    const onValueCommit = vi.fn();
    render(Fixture, { props: { step: 5, onValueCommit } });
    await key('Volume', 'ArrowRight');
    expect(now('Volume')).toBe(45);
    await key('Volume', 'ArrowUp');
    expect(now('Volume')).toBe(50);
    await key('Volume', 'ArrowLeft');
    await key('Volume', 'ArrowDown');
    expect(now('Volume')).toBe(40);
    await key('Volume', 'PageUp');
    expect(now('Volume')).toBe(90);
    await key('Volume', 'End');
    expect(now('Volume')).toBe(100);
    await key('Volume', 'ArrowRight');
    expect(now('Volume')).toBe(100);
    await key('Volume', 'Home');
    expect(now('Volume')).toBe(0);
    expect(onValueCommit).toHaveBeenLastCalledWith(0);
  });

  it('honors a custom large step', async () => {
    render(Fixture, { props: { largeStep: 25 } });
    await key('Volume', 'PageDown');
    expect(now('Volume')).toBe(15);
  });

  it('flips horizontal arrows in RTL', async () => {
    render(Fixture, { props: { dir: 'rtl' } });
    await key('Volume', 'ArrowLeft');
    expect(now('Volume')).toBe(41);
    await key('Volume', 'ArrowRight');
    expect(now('Volume')).toBe(40);
  });

  it('prevents the page from scrolling only for keys it handles', async () => {
    render(Fixture);
    const handled = new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    });
    slider('Volume').dispatchEvent(handled);
    expect(handled.defaultPrevented).toBe(true);
    const ignored = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    slider('Volume').dispatchEvent(ignored);
    expect(ignored.defaultPrevented).toBe(false);
  });

  it('keeps decimal steps exact', async () => {
    render(Fixture, { props: { min: 0, max: 1, step: 0.1, value: 0.2 } });
    await key('Volume', 'ArrowRight');
    expect(slider('Volume').getAttribute('aria-valuenow')).toBe('0.3');
  });
});

describe('Slider: range (multiple thumbs)', () => {
  it('exposes each thumb with its neighbor as its bound', () => {
    render(Fixture, { props: { type: 'multiple' } });
    expect(slider('Minimum').getAttribute('aria-valuemax')).toBe('80');
    expect(slider('Maximum').getAttribute('aria-valuemin')).toBe('20');
    const range = screen.getByTestId('range');
    expect(range.style.getPropertyValue('inset-inline-start')).toBe('20%');
    expect(range.style.getPropertyValue('inset-inline-end')).toBe('20%');
  });

  it('never lets thumbs cross, and keeps the minimum gap', async () => {
    const onValueChange = vi.fn();
    render(Fixture, { props: { type: 'multiple', minStepsBetweenThumbs: 10, onValueChange } });
    await key('Minimum', 'End');
    expect(now('Minimum')).toBe(70);
    await key('Maximum', 'Home');
    expect(now('Maximum')).toBe(80);
    expect(onValueChange).toHaveBeenLastCalledWith([70, 80]);
    expect(slider('Maximum').getAttribute('aria-valuemin')).toBe('80');
  });
});

describe('Slider: disabled', () => {
  it('takes the thumb out of the Tab order and ignores keys', async () => {
    const onValueChange = vi.fn();
    render(Fixture, { props: { disabled: true, onValueChange } });
    expect(slider('Volume').getAttribute('tabindex')).toBe('-1');
    expect(slider('Volume').getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByTestId('root').hasAttribute('data-disabled')).toBe(true);
    await key('Volume', 'ArrowRight');
    expect(now('Volume')).toBe(40);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('ignores the pointer', async () => {
    render(Fixture, { props: { disabled: true } });
    const root = screen.getByTestId('root');
    mockTrack(root);
    await fireEvent.pointerDown(root, {
      clientX: 250,
      clientY: 60,
      button: 0,
      pointerId: 1,
      pointerType: 'mouse',
    });
    expect(now('Volume')).toBe(40);
  });
});

describe('Slider: pointer and touch', () => {
  it('jumps to the pressed point, drags, then commits once on release', async () => {
    const onValueChange = vi.fn();
    const onValueCommit = vi.fn();
    render(Fixture, { props: { onValueChange, onValueCommit } });
    const root = screen.getByTestId('root');
    mockTrack(root);
    await fireEvent.pointerDown(root, {
      clientX: 250,
      clientY: 60,
      button: 0,
      pointerId: 7,
      pointerType: 'mouse',
    });
    expect(now('Volume')).toBe(75);
    expect(document.activeElement).toBe(slider('Volume'));
    expect(slider('Volume').dataset.state).toBe('active');
    expect(root.setPointerCapture).toHaveBeenCalledWith(7);
    await fireEvent.pointerMove(root, { clientX: 140, clientY: 60, pointerId: 7 });
    expect(now('Volume')).toBe(20);
    expect(onValueCommit).not.toHaveBeenCalled();
    await fireEvent.pointerUp(root, { clientX: 140, clientY: 60, pointerId: 7 });
    expect(onValueCommit).toHaveBeenCalledExactlyOnceWith(20);
    expect(slider('Volume').dataset.state).toBe('inactive');
    // Moving after release does nothing.
    await fireEvent.pointerMove(root, { clientX: 300, clientY: 60, pointerId: 7 });
    expect(now('Volume')).toBe(20);
    expect(onValueChange.mock.calls.map((call) => call[0])).toEqual([75, 20]);
  });

  it('works with touch pointers and keeps the page from scrolling during a drag', async () => {
    render(Fixture);
    const root = screen.getByTestId('root');
    mockTrack(root);
    expect(root.style.getPropertyValue('touch-action')).toBe('none');
    await fireEvent.pointerDown(root, {
      clientX: 120,
      clientY: 60,
      pointerId: 3,
      pointerType: 'touch',
    });
    expect(now('Volume')).toBe(10);
    await fireEvent.pointerCancel(root, { pointerId: 3 });
    expect(slider('Volume').dataset.state).toBe('inactive');
  });

  it('ignores the right mouse button', async () => {
    render(Fixture);
    const root = screen.getByTestId('root');
    mockTrack(root);
    await fireEvent.pointerDown(root, {
      clientX: 250,
      clientY: 60,
      button: 2,
      pointerId: 1,
      pointerType: 'mouse',
    });
    expect(now('Volume')).toBe(40);
  });

  it('stops a dragged thumb at its neighbor instead of crossing it', async () => {
    render(Fixture, { props: { type: 'multiple' } });
    const root = screen.getByTestId('root');
    mockTrack(root);
    await fireEvent.pointerDown(root, {
      clientX: 140,
      clientY: 60,
      button: 0,
      pointerId: 1,
      pointerType: 'mouse',
    });
    await fireEvent.pointerMove(root, { clientX: 290, clientY: 60, pointerId: 1 });
    expect(now('Minimum')).toBe(80);
    expect(now('Maximum')).toBe(80);
  });

  it('moves the nearest thumb of a range, and flips in RTL', async () => {
    const { unmount } = render(Fixture, { props: { type: 'multiple' } });
    let root = screen.getByTestId('root');
    mockTrack(root);
    await fireEvent.pointerDown(root, {
      clientX: 260,
      clientY: 60,
      button: 0,
      pointerId: 1,
      pointerType: 'mouse',
    });
    expect(now('Maximum')).toBe(80);
    expect(document.activeElement).toBe(slider('Maximum'));
    unmount();

    render(Fixture, { props: { dir: 'rtl' } });
    root = screen.getByTestId('root');
    mockTrack(root);
    await fireEvent.pointerDown(root, {
      clientX: 150,
      clientY: 60,
      button: 0,
      pointerId: 1,
      pointerType: 'mouse',
    });
    expect(now('Volume')).toBe(75);
  });
});

describe('Slider: forms', () => {
  it('submits one field per thumb and restores the start values on reset', async () => {
    render(Fixture, { props: { type: 'multiple', name: 'price' } });
    const form = screen.getByTestId('form') as HTMLFormElement;
    expect(new FormData(form).getAll('price')).toEqual(['20', '80']);
    await key('Minimum', 'ArrowRight');
    expect(new FormData(form).getAll('price')).toEqual(['21', '80']);
    form.reset();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(now('Minimum')).toBe(20);
    expect(new FormData(form).getAll('price')).toEqual(['20', '80']);
  });

  it('keeps the field out of the form while disabled', () => {
    render(Fixture, { props: { name: 'volume', disabled: true } });
    expect(new FormData(screen.getByTestId('form') as HTMLFormElement).getAll('volume')).toEqual(
      []
    );
  });

  it('submits nothing without a name', () => {
    render(Fixture);
    expect(document.querySelectorAll('[data-tx-form-bridge]')).toHaveLength(0);
  });
});

describe('Slider: composition', () => {
  it('spreads thumb props, position and keyboard on a child element', async () => {
    render(Fixture, { props: { childThumb: true } });
    const thumb = slider('Volume');
    expect(thumb.tagName).toBe('BUTTON');
    expect(thumb.classList.contains('custom-thumb')).toBe(true);
    expect(thumb.style.getPropertyValue('inset-inline-start')).toBe('40%');
    await key('Volume', 'ArrowRight');
    expect(now('Volume')).toBe(41);
  });
});
