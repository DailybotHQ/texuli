import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyPosition,
  autoUpdate,
  canUseCssAnchor,
  clearPosition,
  computeDomPosition,
  computePosition,
  cssAnchorDeclarations,
  getContainerRect,
  getScrollAncestors,
  getViewportRect,
  intersectRects,
  layoutBox,
  listPlacements,
  measureRect,
  observeResize,
  type Placement,
  place,
  positionFloating,
  type Rect,
  readDirection,
  rect,
  snapToDevicePixel,
  supportsCssAnchorPositioning,
  type VirtualElement,
} from '../src/index.ts';

// ── a controllable page ──────────────────────────────────────────────────

const win = document.defaultView as unknown as Window & Record<string, unknown>;
const VIEWPORT = { width: 400, height: 300 };

function domRect(r: Rect): DOMRect {
  return {
    x: r.x,
    y: r.y,
    width: r.width,
    height: r.height,
    top: r.y,
    left: r.x,
    right: r.x + r.width,
    bottom: r.y + r.height,
    toJSON: () => ({}),
  } as DOMRect;
}

/** An element with a fixed box (viewport coordinates). */
function boxed<T extends HTMLElement>(element: T, box: Rect): T {
  element.getBoundingClientRect = () => domRect(box);
  Object.defineProperty(element, 'offsetWidth', { configurable: true, value: box.width });
  Object.defineProperty(element, 'offsetHeight', { configurable: true, value: box.height });
  return element;
}

/**
 * A floating element whose containing block starts at `origin` (a transformed
 * ancestor, say): its box is the origin plus whatever `translate` holds.
 */
function floatingAt(origin: { x: number; y: number }, size = { width: 80, height: 40 }) {
  const element = document.createElement('div');
  Object.defineProperty(element, 'offsetWidth', { configurable: true, value: size.width });
  Object.defineProperty(element, 'offsetHeight', { configurable: true, value: size.height });
  element.getBoundingClientRect = () => {
    // Layout: the containing block's origin plus the insets. Then the element's
    // own `scale` about its `transform-origin` (an entry animation), as a browser paints it.
    const left = Number.parseFloat(element.style.getPropertyValue('left')) || 0;
    const top = Number.parseFloat(element.style.getPropertyValue('top')) || 0;
    const scale = Number.parseFloat(element.style.getPropertyValue('scale')) || 1;
    const [ox = 0, oy = 0] = (element.style.getPropertyValue('transform-origin') || '0px 0px')
      .split(' ')
      .map((part) => Number.parseFloat(part) || 0);
    const x = origin.x + left + ox * (1 - scale);
    const y = origin.y + top + oy * (1 - scale);
    return domRect(rect(x, y, size.width * scale, size.height * scale));
  };
  document.body.append(element);
  return element;
}

/** Manual animation frames. */
let frames: FrameRequestCallback[] = [];
const flushFrames = () => {
  const due = frames;
  frames = [];
  for (const run of due) run(0);
};

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  observed = new Set<Element>();
  disconnected = false;
  readonly callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    FakeResizeObserver.instances.push(this);
  }
  observe(target: Element) {
    this.observed.add(target);
  }
  unobserve(target: Element) {
    this.observed.delete(target);
  }
  disconnect() {
    this.disconnected = true;
    this.observed.clear();
  }
  fire(target: Element) {
    this.callback([{ target } as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
}

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  target: Element | undefined;
  disconnected = false;
  readonly callback: IntersectionObserverCallback;
  readonly options: IntersectionObserverInit;
  constructor(callback: IntersectionObserverCallback, options: IntersectionObserverInit) {
    this.callback = callback;
    this.options = options;
    FakeIntersectionObserver.instances.push(this);
  }
  observe(target: Element) {
    this.target = target;
  }
  disconnect() {
    this.disconnected = true;
  }
  ratio(intersectionRatio: number) {
    this.callback(
      [{ intersectionRatio, target: this.target } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver
    );
  }
}

const globalsToRestore: [string, PropertyDescriptor | undefined][] = [];
function setWindow(name: string, value: unknown) {
  globalsToRestore.push([name, Object.getOwnPropertyDescriptor(win, name)]);
  Object.defineProperty(win, name, { configurable: true, writable: true, value });
}

/** Fresh fakes for every test (and between merged sub-cases). */
function setUp() {
  frames = [];
  FakeResizeObserver.instances = [];
  FakeIntersectionObserver.instances = [];
  setWindow('visualViewport', {
    offsetLeft: 0,
    offsetTop: 0,
    ...VIEWPORT,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  setWindow('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback));
  setWindow('cancelAnimationFrame', () => {
    frames = [];
  });
  setWindow('ResizeObserver', FakeResizeObserver);
  setWindow('IntersectionObserver', FakeIntersectionObserver);
}

function tearDown() {
  for (const [name, descriptor] of globalsToRestore.splice(0).reverse()) {
    if (descriptor) Object.defineProperty(win, name, descriptor);
    else delete win[name];
  }
  document.body.replaceChildren();
  document.documentElement.removeAttribute('dir');
}

beforeEach(setUp);
afterEach(tearDown);

// ── measuring ────────────────────────────────────────────────────────────

describe('measuring the page', () => {
  it('reads element and virtual references in viewport coordinates, and 3 related cases', () => {
    {
      // reads element and virtual references in viewport coordinates
      const element = boxed(document.createElement('button'), rect(10, 20, 30, 40));
      expect(measureRect(element)).toEqual(rect(10, 20, 30, 40));
      const pointer: VirtualElement = { getBoundingClientRect: () => domRect(rect(55, 66, 0, 0)) };
      expect(measureRect(pointer)).toEqual(rect(55, 66, 0, 0));
    }
    tearDown();
    setUp();
    {
      // uses the visual viewport (pinch zoom, on-screen keyboard), else the layout viewport
      setWindow('visualViewport', { offsetLeft: 5, offsetTop: 7, width: 200, height: 150 });
      expect(getViewportRect(win)).toEqual(rect(5, 7, 200, 150));
      setWindow('visualViewport', null);
      const root = document.documentElement;
      Object.defineProperty(root, 'clientWidth', { configurable: true, value: 390 });
      Object.defineProperty(root, 'clientHeight', { configurable: true, value: 700 });
      expect(getViewportRect(win)).toEqual(rect(0, 0, 390, 700));
    }
    tearDown();
    setUp();
    {
      // measures a container’s padding box without borders and scrollbars
      const container = boxed(document.createElement('div'), rect(100, 50, 220, 120));
      Object.defineProperty(container, 'clientLeft', { configurable: true, value: 2 });
      Object.defineProperty(container, 'clientTop', { configurable: true, value: 3 });
      Object.defineProperty(container, 'clientWidth', { configurable: true, value: 200 });
      Object.defineProperty(container, 'clientHeight', { configurable: true, value: 110 });
      expect(getContainerRect(container)).toEqual(rect(102, 53, 200, 110));
    }
    tearDown();
    setUp();
    // intersects rects, and gives an empty rect when they do not meet
    expect(intersectRects(rect(0, 0, 100, 100), rect(50, 60, 100, 100))).toEqual(
      rect(50, 60, 50, 40)
    );
    expect(intersectRects(rect(0, 0, 10, 10), rect(50, 50, 10, 10))).toEqual(rect(50, 50, 0, 0));
  });
  it('lists every scrolling ancestor, nearest first, across shadow roots, then the window; reads the rendered direction', () => {
    {
      // lists every scrolling ancestor, nearest first, across shadow roots, then the window
      const outer = document.createElement('div');
      outer.style.overflowY = 'auto';
      const plain = document.createElement('div');
      const host = document.createElement('div');
      const shadow = host.attachShadow({ mode: 'open' });
      const inner = document.createElement('div');
      inner.style.overflow = 'scroll';
      const target = document.createElement('span');
      inner.append(target);
      shadow.append(inner);
      plain.append(host);
      outer.append(plain);
      document.body.append(outer);
      expect(getScrollAncestors(target)).toEqual([inner, outer, win]);
      expect(getScrollAncestors(undefined)).toEqual([]);
    }
    tearDown();
    setUp();
    {
      // reads the rendered direction
      const element = document.createElement('span');
      document.body.append(element);
      expect(readDirection(element)).toBe('ltr');
      element.style.direction = 'rtl';
      expect(readDirection(element)).toBe('rtl');
      expect(readDirection(undefined)).toBe('ltr');
    }
  });
});

// ── computing ────────────────────────────────────────────────────────────

describe('computeDomPosition', () => {
  it('measures the page and returns exactly what the math computes, and 3 related cases', () => {
    {
      // measures the page and returns exactly what the math computes
      const reference = boxed(document.createElement('button'), rect(100, 100, 40, 20));
      const floating = boxed(document.createElement('div'), rect(0, 0, 80, 40));
      document.body.append(reference, floating);
      const options = { placement: 'bottom-start' as const, offset: 8, flip: true, shift: true };
      expect(computeDomPosition(reference, floating, options)).toEqual(
        computePosition(
          rect(100, 100, 40, 20),
          { width: 80, height: 40 },
          {
            ...options,
            direction: 'ltr',
            boundary: rect(0, 0, 400, 300),
          }
        )
      );
    }
    tearDown();
    setUp();
    {
      // flips at the viewport edge
      const reference = boxed(document.createElement('button'), rect(100, 270, 40, 20));
      const floating = boxed(document.createElement('div'), rect(0, 0, 80, 40));
      document.body.append(reference, floating);
      const result = computeDomPosition(reference, floating, { placement: 'bottom', flip: true });
      expect(result.placement).toBe('top');
      expect(result.y).toBe(230);
    }
    tearDown();
    setUp();
    {
      // contained mode keeps the floating element inside the visible part of the container
      const container = boxed(document.createElement('div'), rect(50, 40, 200, 500));
      const reference = boxed(document.createElement('button'), rect(220, 60, 20, 20));
      const floating = boxed(document.createElement('div'), rect(0, 0, 80, 40));
      container.append(reference, floating);
      document.body.append(container);
      const result = computeDomPosition(reference, floating, {
        placement: 'bottom',
        shift: true,
        contain: container,
      });
      // The container runs past the 300 px viewport: the boundary is their overlap.
      expect(result.x).toBe(250 - 80);
      const below = boxed(document.createElement('button'), rect(100, 280, 20, 10));
      container.append(below);
      const clamped = computeDomPosition(below, floating, {
        placement: 'bottom',
        shift: true,
        contain: container,
      });
      expect(clamped.y).toBe(300 - 40);
    }
    tearDown();
    setUp();
    {
      // reads right-to-left from the reference, so start means inline-start
      const reference = boxed(document.createElement('button'), rect(200, 100, 40, 20));
      const floating = boxed(document.createElement('div'), rect(0, 0, 80, 40));
      reference.style.direction = 'rtl';
      document.body.append(reference, floating);
      const result = computeDomPosition(reference, floating, { placement: 'bottom-start' });
      expect(result.placement).toBe('bottom-end');
      expect(result.x).toBe(240 - 80);
      expect(
        computeDomPosition(reference, floating, { placement: 'bottom-start', direction: 'ltr' }).x
      ).toBe(200);
    }
  });
});

// ── applying ─────────────────────────────────────────────────────────────

describe('applyPosition', () => {
  const result = computePosition(
    rect(100, 100, 40, 20),
    { width: 80, height: 40 },
    {
      placement: 'bottom',
      offset: 8,
      arrow: { width: 10, height: 6 },
    }
  );
  it('lands on the computed viewport pixels whatever the containing block, and 3 related cases', () => {
    {
      // lands on the computed viewport pixels whatever the containing block
      // The containing block starts at (30, 12): a transformed ancestor, the top layer, a margin.
      const floating = floatingAt({ x: 30, y: 12 });
      applyPosition(floating, result);
      expect(floating.style.getPropertyValue('position')).toBe('fixed');
      // Insets from the containing block's origin, not a transform.
      expect(floating.style.getPropertyValue('left')).toBe(`${result.x - 30}px`);
      expect(floating.style.getPropertyValue('top')).toBe(`${result.y - 12}px`);
      expect(floating.style.getPropertyValue('translate')).toBe('');
      // Auto margins (the popover UA style) must not re-center the box.
      expect(floating.style.getPropertyValue('right')).toBe('auto');
      expect(floating.style.getPropertyValue('bottom')).toBe('auto');
      // One compositing layer every time, so text rasterizes the same way.
      expect(floating.style.getPropertyValue('will-change')).toBe('transform');
      expect(floating.getBoundingClientRect().x).toBe(result.x);
      expect(floating.getBoundingClientRect().y).toBe(result.y);
      // Applying again (an update) measures from the last translate, not from zero.
      const moved = { ...result, x: result.x + 15, y: result.y - 4 };
      applyPosition(floating, moved, { strategy: 'absolute' });
      expect(floating.style.getPropertyValue('position')).toBe('absolute');
      expect(floating.getBoundingClientRect().x).toBe(moved.x);
      expect(floating.getBoundingClientRect().y).toBe(moved.y);
      expect(floating.dataset.placement).toBe('bottom');
      expect(floating.dataset.side).toBe('bottom');
    }
    tearDown();
    setUp();
    {
      // places the arrow and exposes the available size on request
      const floating = floatingAt({ x: 0, y: 0 });
      const arrow = boxed(document.createElement('span'), rect(0, 0, 10, 6));
      floating.append(arrow);
      applyPosition(floating, result, { arrowElement: arrow, exposeSize: true });
      // The arrow is centered on the reference (x 120) along the floating's top edge.
      const arrowX = (result.arrow?.x ?? 0) - 5;
      expect(arrow.style.getPropertyValue('left')).toBe(`${arrowX}px`);
      expect(arrow.style.getPropertyValue('top')).toBe('-6px');
      expect(arrow.dataset.side).toBe('top');
      expect(floating.style.getPropertyValue('--texuli-available-width')).toBe('80px');
      expect(floating.style.getPropertyValue('--texuli-available-height')).toBe('40px');
    }
    tearDown();
    setUp();
    {
      // snaps a coordinate to the device pixel grid
      // DPR 1: whole CSS pixels.
      expect(snapToDevicePixel(10.3, 1)).toBe(10);
      expect(snapToDevicePixel(10.5, 1)).toBe(11);
      expect(snapToDevicePixel(-3.2, 1)).toBe(-3);
      // DPR 2: half CSS pixels.
      expect(snapToDevicePixel(10.3, 2)).toBe(10.5);
      expect(snapToDevicePixel(10.2, 2)).toBe(10);
      // DPR 2.625 (Pixel 7): multiples of 1/2.625 CSS px, i.e. whole device pixels.
      const snapped = snapToDevicePixel(10.3, 2.625);
      expect(snapped * 2.625).toBeCloseTo(27, 10);
      expect(snapToDevicePixel(100.19, 2.625) * 2.625).toBeCloseTo(263, 10);
      // A missing, zero or non-finite ratio counts as 1.
      expect(snapToDevicePixel(10.3)).toBe(10);
      expect(snapToDevicePixel(10.3, 0)).toBe(10);
      expect(snapToDevicePixel(10.3, Number.NaN)).toBe(10);
    }
    tearDown();
    setUp();
    // lands on whole device pixels at DPR
    for (const ratio of [1, 2, 2.625]) {
      vi.stubGlobal('devicePixelRatio', ratio);
      try {
        // A fractional result in a containing block at a fractional origin (in layout units, 1/64 px).
        const floating = floatingAt({ x: 30.375, y: 12.8125 });
        const fractional = { ...result, x: 101.37, y: 57.83 };
        applyPosition(floating, fractional);
        const box = floating.getBoundingClientRect();
        for (const value of [box.x, box.y]) {
          expect(Math.abs(value * ratio - Math.round(value * ratio)), String(ratio)).toBeLessThan(
            1e-3
          );
        }
        // Within half a device pixel of the computed position.
        expect(Math.abs(box.x - fractional.x), String(ratio)).toBeLessThanOrEqual(
          0.5 / ratio + 1e-9
        );
        expect(Math.abs(box.y - fractional.y), String(ratio)).toBeLessThanOrEqual(
          0.5 / ratio + 1e-9
        );
        // The arrow offset inside the panel is on the grid too; sizes are not rounded.
        const arrow = boxed(document.createElement('span'), rect(0, 0, 10, 6));
        floating.append(arrow);
        const sized = {
          ...fractional,
          width: 80.33,
          height: 40.67,
          arrow: { x: 33.3, y: 0, side: 'top' as const },
        };
        applyPosition(floating, sized, { arrowElement: arrow, exposeSize: true });
        const ax = Number.parseFloat(arrow.style.getPropertyValue('left'));
        expect(Math.abs(ax * ratio - Math.round(ax * ratio)), String(ratio)).toBeLessThan(1e-3);
        expect(floating.style.getPropertyValue('--texuli-available-width'), String(ratio)).toBe(
          '80.33px'
        );
        expect(floating.style.getPropertyValue('--texuli-available-height'), String(ratio)).toBe(
          '40.67px'
        );
      } finally {
        vi.unstubAllGlobals();
      }
    }
  });
  it('places by the layout box, whatever the entry animation is doing, and 3 related cases', () => {
    // places by the layout box, whatever the entry animation is doing
    vi.stubGlobal('devicePixelRatio', 2.625);
    try {
      const fractional = { ...result, x: 101.37, y: 57.83 };
      const landed: Array<{ x: number; y: number }> = [];
      // The same placement measured at rest and mid-animation (scale 0.96, 0.98).
      for (const scale of ['', '0.96', '0.98']) {
        const floating = floatingAt({ x: 30.375, y: 12.8125 });
        floating.style.setProperty('transform-origin', '40px 20px');
        if (scale) floating.style.setProperty('scale', scale);
        applyPosition(floating, fractional);
        floating.style.removeProperty('scale'); // the animation ends
        const box = floating.getBoundingClientRect();
        landed.push({ x: box.x, y: box.y });
      }
      expect(landed[1]).toEqual(landed[0]);
      expect(landed[2]).toEqual(landed[0]);
      expect(
        Math.abs((landed[0]?.x ?? 0) * 2.625 - Math.round((landed[0]?.x ?? 0) * 2.625))
      ).toBeLessThan(1e-3);
    } finally {
      vi.unstubAllGlobals();
    }
    tearDown();
    setUp();
    // ignores float residue below a layout unit in the measured origin
    vi.stubGlobal('devicePixelRatio', 2.625);
    try {
      const fractional = { ...result, x: 101.37, y: 57.83 };
      const at = (origin: { x: number; y: number }) => {
        const floating = floatingAt(origin);
        applyPosition(floating, fractional);
        return [floating.style.getPropertyValue('left'), floating.style.getPropertyValue('top')];
      };
      // A residue of 1e-4 px (undoing a scale mid-animation) writes the same insets.
      expect(at({ x: 30.375 + 1e-4, y: 12.8125 - 1e-4 })).toEqual(at({ x: 30.375, y: 12.8125 }));
    } finally {
      vi.unstubAllGlobals();
    }
    tearDown();
    setUp();
    {
      // measures the layout box under translate, scale and transform
      const element = floatingAt({ x: 0, y: 0 });
      element.style.setProperty('left', '100px');
      element.style.setProperty('top', '50px');
      element.style.setProperty('scale', '0.5');
      element.style.setProperty('transform-origin', '40px 20px');
      expect(layoutBox(element)).toEqual({ x: 100, y: 50 });
      element.style.setProperty('rotate', '10deg');
      // Rotation is not undone: the bounding box is used as is.
      expect(layoutBox(element).x).toBe(element.getBoundingClientRect().x);
    }
    tearDown();
    setUp();
    {
      // clearPosition removes everything it wrote
      const floating = floatingAt({ x: 0, y: 0 });
      applyPosition(floating, result, { exposeSize: true });
      clearPosition(floating);
      expect(floating.getAttribute('style') ?? '').toBe('');
      expect(floating.dataset.placement).toBeUndefined();
      expect(floating.dataset.side).toBeUndefined();
    }
  });
});

// ── auto-update ──────────────────────────────────────────────────────────

describe('autoUpdate', () => {
  function scene() {
    const scroller = document.createElement('div');
    scroller.style.overflow = 'auto';
    const reference = boxed(document.createElement('button'), rect(100, 100, 40, 20));
    const floating = boxed(document.createElement('div'), rect(0, 0, 80, 40));
    scroller.append(reference);
    document.body.append(scroller, floating);
    return { scroller, reference, floating };
  }
  it('updates at once, then at most once per frame on scroll and resize, and 3 related cases', () => {
    {
      // updates at once, then at most once per frame on scroll and resize
      const { scroller, reference, floating } = scene();
      const update = vi.fn();
      const stop = autoUpdate(reference, floating, update);
      expect(update).toHaveBeenCalledTimes(1);

      scroller.dispatchEvent(new Event('scroll'));
      scroller.dispatchEvent(new Event('scroll'));
      win.dispatchEvent(new Event('resize'));
      expect(update).toHaveBeenCalledTimes(1);
      flushFrames();
      expect(update).toHaveBeenCalledTimes(2);

      win.dispatchEvent(new Event('scroll'));
      flushFrames();
      expect(update).toHaveBeenCalledTimes(3);

      stop();
      scroller.dispatchEvent(new Event('scroll'));
      win.dispatchEvent(new Event('resize'));
      flushFrames();
      expect(update).toHaveBeenCalledTimes(3);
    }
    tearDown();
    setUp();
    {
      // listens passively on every scroll ancestor and the visual viewport
      const { scroller, reference, floating } = scene();
      const add = vi.spyOn(scroller, 'addEventListener');
      const visual = win.visualViewport as unknown as {
        addEventListener: ReturnType<typeof vi.fn>;
      };
      const stop = autoUpdate(reference, floating, () => {});
      expect(add).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true });
      expect(visual.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function), {
        passive: true,
      });
      expect(visual.addEventListener).toHaveBeenCalledWith('scroll', expect.any(Function), {
        passive: true,
      });
      stop();
    }
    tearDown();
    setUp();
    {
      // shares one ResizeObserver per window and disconnects it when nothing is left
      const first = scene();
      const second = scene();
      const updateA = vi.fn();
      const updateB = vi.fn();
      const stopA = autoUpdate(first.reference, first.floating, updateA);
      const stopB = autoUpdate(second.reference, second.floating, updateB);
      expect(FakeResizeObserver.instances).toHaveLength(1);
      const [observer] = FakeResizeObserver.instances;
      expect(observer?.observed.size).toBe(4);

      observer?.fire(first.floating);
      flushFrames();
      expect(updateA).toHaveBeenCalledTimes(2);
      expect(updateB).toHaveBeenCalledTimes(1);

      stopA();
      expect(observer?.observed.size).toBe(2);
      expect(observer?.disconnected).toBe(false);
      stopB();
      expect(observer?.disconnected).toBe(true);
      // A later observer starts fresh.
      const stopC = observeResize(first.reference, () => {});
      expect(FakeResizeObserver.instances).toHaveLength(2);
      stopC();
    }
    tearDown();
    setUp();
    {
      // notices the anchor moving without a scroll or a resize
      const { reference, floating } = scene();
      const root = document.documentElement;
      Object.defineProperty(root, 'clientWidth', { configurable: true, value: 400 });
      Object.defineProperty(root, 'clientHeight', { configurable: true, value: 300 });
      const update = vi.fn();
      const stop = autoUpdate(reference, floating, update, { elementResize: false });
      const [first] = FakeIntersectionObserver.instances;
      // The root margin cuts the viewport down to the anchor's box.
      expect(first?.options.rootMargin).toBe('-100px -260px -180px -100px');
      first?.ratio(1); // the initial report: in place
      expect(update).toHaveBeenCalledTimes(1);

      // Content above pushes the anchor down by 30 px.
      reference.getBoundingClientRect = () => domRect(rect(100, 130, 40, 20));
      first?.ratio(0.4);
      flushFrames();
      expect(update).toHaveBeenCalledTimes(2);
      expect(first?.disconnected).toBe(true);
      const [, second] = FakeIntersectionObserver.instances;
      expect(second?.options.rootMargin).toBe('-130px -260px -150px -100px');
      stop();
      expect(second?.disconnected).toBe(true);
    }
  });

  it('follows an animated anchor frame by frame when asked', () => {
    const { reference, floating } = scene();
    const update = vi.fn();
    const stop = autoUpdate(reference, floating, update, {
      ancestorScroll: false,
      ancestorResize: false,
      elementResize: false,
      layoutShift: false,
      animationFrame: true,
    });
    expect(update).toHaveBeenCalledTimes(1);
    flushFrames();
    expect(update).toHaveBeenCalledTimes(1);
    reference.getBoundingClientRect = () => domRect(rect(104, 100, 40, 20));
    flushFrames();
    expect(update).toHaveBeenCalledTimes(2);
    stop();
    reference.getBoundingClientRect = () => domRect(rect(140, 100, 40, 20));
    flushFrames();
    expect(update).toHaveBeenCalledTimes(2);
  });
});

// ── CSS anchor positioning ───────────────────────────────────────────────

/**
 * Evaluates the declarations the way a browser lays out an anchored, fixed
 * box: `anchor(<edge>)` in `top`/`left` is the edge's coordinate, and in
 * `bottom`/`right` its distance from the far side of the viewport.
 */
function layOut(
  declarations: Record<string, string>,
  anchor: Rect,
  size: { width: number; height: number }
): { x: number; y: number } {
  const edge = (name: string) =>
    ({
      top: anchor.y,
      bottom: anchor.y + anchor.height,
      left: anchor.x,
      right: anchor.x + anchor.width,
    })[name] ?? Number.NaN;
  const value = (property: 'top' | 'bottom' | 'left' | 'right') => {
    const text = declarations[property];
    if (text === undefined) return undefined;
    const match = /^(?:calc\()?anchor\((\w+)\)(?: ([+-]) ([\d.]+)px\))?$/.exec(text);
    if (!match) throw new Error(`unexpected ${property}: ${text}`);
    const [, name = '', sign, amount = '0'] = match;
    const vertical = property === 'top' || property === 'bottom';
    const center = vertical ? anchor.y + anchor.height / 2 : anchor.x + anchor.width / 2;
    const coordinate = name === 'center' ? center : edge(name);
    const delta = (sign === '-' ? -1 : 1) * Number(amount);
    if (property === 'top' || property === 'left') return coordinate + delta;
    const extent = property === 'bottom' ? VIEWPORT.height : VIEWPORT.width;
    return extent - coordinate + delta;
  };
  const top = value('top');
  const left = value('left');
  const bottom = value('bottom');
  const right = value('right');
  let x = left ?? VIEWPORT.width - (right ?? 0) - size.width;
  let y = top ?? VIEWPORT.height - (bottom ?? 0) - size.height;
  if (declarations.translate === '-50% 0') x -= size.width / 2;
  if (declarations.translate === '0 -50%') y -= size.height / 2;
  return { x, y };
}

describe('CSS anchor positioning', () => {
  it('places every placement exactly where the math does, and 2 related cases', () => {
    {
      // places every placement exactly where the math does
      const anchor = rect(150, 120, 46, 22);
      const size = { width: 90, height: 34 };
      const offsets = [0, 8, { mainAxis: 6, crossAxis: 5 }, { mainAxis: -3, crossAxis: -7 }];
      for (const placement of listPlacements()) {
        for (const offset of offsets) {
          const declarations = cssAnchorDeclarations('--a', placement as Placement, offset);
          expect(declarations.position).toBe('fixed');
          expect(declarations['position-anchor']).toBe('--a');
          expect(
            layOut(declarations, anchor, size),
            `${placement} ${JSON.stringify(offset)}`
          ).toEqual(place(anchor, size, placement, offset));
        }
      }
    }
    tearDown();
    setUp();
    // is used only when it gives the same result as the script path
    expect(canUseCssAnchor({ placement: 'top', offset: 8 })).toBe(true);
    for (const option of [
      { flip: true },
      { shift: true },
      { size: true },
      { arrow: { width: 8, height: 4 } },
    ]) {
      expect(canUseCssAnchor({ placement: 'top', ...option })).toBe(false);
    }
    tearDown();
    setUp();
    {
      // detects support only when called, through CSS.supports
      expect(supportsCssAnchorPositioning(undefined)).toBe(false);
      const supports = vi.fn(() => true);
      expect(supportsCssAnchorPositioning({ CSS: { supports } } as unknown as Window)).toBe(true);
      expect(supports).toHaveBeenCalledWith('anchor-name', '--texuli-probe');
      expect(supports).toHaveBeenCalledWith('top', 'anchor(bottom)');
      expect(
        supportsCssAnchorPositioning({ CSS: { supports: () => false } } as unknown as Window)
      ).toBe(false);
    }
  });
});

describe('positionFloating', () => {
  const pair = () => {
    const reference = boxed(document.createElement('button'), rect(100, 100, 40, 20));
    const floating = floatingAt({ x: 0, y: 0 });
    document.body.append(reference);
    return { reference, floating };
  };
  it('hands placement to CSS anchor positioning where the browser has it, and 3 related cases', () => {
    {
      // hands placement to CSS anchor positioning where the browser has it
      setWindow('CSS', { supports: () => true });
      const { reference, floating } = pair();
      reference.style.setProperty('anchor-name', '--author');
      const position = positionFloating(reference, floating, {
        placement: 'bottom-start',
        offset: 4,
      });
      expect(position.mode).toBe('css-anchor');
      const name = reference.style.getPropertyValue('anchor-name').split(', ')[1] ?? '';
      expect(reference.style.getPropertyValue('anchor-name')).toBe(`--author, ${name}`);
      expect(floating.style.getPropertyValue('position-anchor')).toBe(name);
      expect(floating.style.getPropertyValue('top')).toBe('calc(anchor(bottom) + 4px)');
      expect(floating.dataset.placement).toBe('bottom-start');
      // CSS tracks scrolling by itself: no listeners, no observers.
      expect(FakeResizeObserver.instances).toHaveLength(0);
      position.destroy();
      position.destroy();
      expect(reference.style.getPropertyValue('anchor-name')).toBe('--author');
      expect(floating.style.getPropertyValue('position-anchor')).toBe('');
      expect(floating.dataset.placement).toBeUndefined();
    }
    tearDown();
    setUp();
    {
      // measures and auto-updates when CSS cannot give the same result
      setWindow('CSS', { supports: () => true });
      const { reference, floating } = pair();
      const onPosition = vi.fn();
      const position = positionFloating(reference, floating, {
        placement: 'bottom',
        flip: true,
        onPosition,
      });
      expect(position.mode).toBe('script');
      expect(onPosition).toHaveBeenCalledTimes(1);
      expect(floating.getBoundingClientRect().y).toBe(120);
      reference.getBoundingClientRect = () => domRect(rect(100, 140, 40, 20));
      win.dispatchEvent(new Event('resize'));
      flushFrames();
      expect(floating.getBoundingClientRect().y).toBe(160);
      position.destroy();
      expect(floating.getAttribute('style') ?? '').toBe('');
      win.dispatchEvent(new Event('resize'));
      flushFrames();
      expect(onPosition).toHaveBeenCalledTimes(2);
    }
    tearDown();
    setUp();
    {
      // uses the script path for a virtual reference, without support, or when told to
      const { reference, floating } = pair();
      const pointer: VirtualElement = {
        getBoundingClientRect: () => domRect(rect(30, 40, 0, 0)),
        contextElement: reference,
      };
      setWindow('CSS', { supports: () => true });
      const virtual = positionFloating(pointer, floating, { placement: 'right-start' });
      expect(virtual.mode).toBe('script');
      expect(floating.getBoundingClientRect()).toMatchObject({ x: 30, y: 40 });
      virtual.destroy();
      expect(
        positionFloating(reference, floating, { placement: 'top', cssAnchor: 'never' }).mode
      ).toBe('script');
      setWindow('CSS', { supports: () => false });
      expect(positionFloating(reference, floating, { placement: 'top' }).mode).toBe('script');
    }
    tearDown();
    setUp();
    {
      // sameWidth sets min-inline-size from the anchor and re-applies on update
      const { reference, floating } = pair();
      // Trigger is 40px wide from pair(); ceil stays 40.
      const position = positionFloating(reference, floating, {
        placement: 'bottom-start',
        flip: true,
        sameWidth: true,
        cssAnchor: 'never',
      });
      expect(position.mode).toBe('script');
      expect(floating.style.getPropertyValue('min-inline-size')).toBe('40px');
      expect(floating.dataset.txSameWidth).toBe('');
      // Trailing rAF (WebKit font settle) still keeps the same min.
      flushFrames();
      expect(floating.style.getPropertyValue('min-inline-size')).toBe('40px');
      // Anchor grows (font settle / layout). autoUpdate's ResizeObserver calls
      // the same update path; exercise it directly here.
      reference.getBoundingClientRect = () => domRect(rect(100, 100, 96.2, 20));
      position.update();
      expect(floating.style.getPropertyValue('min-inline-size')).toBe('97px');
      position.destroy();
      expect(floating.style.getPropertyValue('min-inline-size')).toBe('');
      expect(floating.dataset.txSameWidth).toBeUndefined();
    }
  });
});
