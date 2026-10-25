import { getOwnerWindow } from '../env/index.ts';
import {
  type ComputePositionOptions,
  type ComputePositionResult,
  computePosition,
} from '../position-math/index.ts';
import {
  getContainerRect,
  getViewportRect,
  intersectRects,
  measureRect,
  type PositionReference,
  readDirection,
  referenceElement,
} from './measure.ts';

export interface DomPositionOptions extends Omit<ComputePositionOptions, 'boundary' | 'direction'> {
  /**
   * Contained mode: keep the floating element inside this container (its
   * visible part) instead of the viewport. Default: the viewport.
   */
  contain?: Element;
  /** Text direction. Default: the reference element's computed direction. */
  direction?: 'ltr' | 'rtl';
  /**
   * Keep the floating element's `min-inline-size` at least the anchor's border
   * box width (select/combobox listboxes). Re-applied on every position update
   * so a late font or layout settle, or an anchor resize, stays in sync.
   * Longer content may still grow wider. Does not set `width` / `inline-size`.
   */
  sameWidth?: boolean;
}

/**
 * Sets `min-inline-size` from the anchor's current border-box width. Call in
 * the same frame as placement so the list measures with the settled trigger.
 * Uses `min-inline-size` (logical) so content can grow; never sets `width`.
 */
export function applySameWidth(reference: PositionReference, floating: HTMLElement): void {
  const width = measureRect(reference).width;
  if (!(width > 0)) return;
  // Ceil so a subpixel trigger never outgrows the list under WebKit rounding.
  floating.style.setProperty('min-inline-size', `${Math.ceil(width)}px`);
  floating.dataset.txSameWidth = '';
}

/** Removes a `min-inline-size` written by `applySameWidth`. */
export function clearSameWidth(floating: HTMLElement): void {
  if (!('txSameWidth' in floating.dataset)) return;
  floating.style.removeProperty('min-inline-size');
  delete floating.dataset.txSameWidth;
}

/**
 * Measures the reference, the floating element and the boundary (the visual
 * viewport, or the container in contained mode) and runs the placement math.
 * Coordinates are in viewport space; `applyPosition` converts them for the
 * floating element's containing block.
 */
export function computeDomPosition(
  reference: PositionReference,
  floating: HTMLElement,
  options: DomPositionOptions
): ComputePositionResult {
  if (options.sameWidth) applySameWidth(reference, floating);
  const anchor = referenceElement(reference);
  const ownerWindow = getOwnerWindow(floating) ?? getOwnerWindow(anchor);
  const viewport = ownerWindow ? getViewportRect(ownerWindow) : undefined;
  let boundary = viewport;
  if (options.contain) {
    const container = getContainerRect(options.contain);
    const visible = viewport ? intersectRects(container, viewport) : container;
    boundary = visible.width > 0 && visible.height > 0 ? visible : container;
  }
  const { contain: _contain, direction, sameWidth: _sameWidth, ...math } = options;
  return computePosition(
    measureRect(reference),
    { width: floating.offsetWidth, height: floating.offsetHeight },
    { ...math, direction: direction ?? readDirection(anchor), ...(boundary ? { boundary } : {}) }
  );
}

export type PositionStrategy = 'fixed' | 'absolute';

export interface ApplyPositionOptions {
  /** `fixed` (default) or `absolute`. Either way the result lands on the same pixels. */
  strategy?: PositionStrategy;
  /** An arrow element inside the floating element, placed from `result.arrow`. */
  arrowElement?: HTMLElement;
  /** Expose the clamped size as `--texuli-available-width` / `-height` (with `size`). */
  exposeSize?: boolean;
}

/**
 * Rounds a viewport coordinate to the device pixel grid:
 * `Math.round(value * ratio) / ratio`. A positioned panel that starts on a
 * fractional device pixel rasterizes its text differently from frame to frame
 * (and slightly blurred); on the grid it is crisp and stable. A missing,
 * zero or non-finite ratio counts as 1 (whole CSS pixels).
 */
export function snapToDevicePixel(value: number, devicePixelRatio = 1): number {
  const ratio = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.round(value * ratio) / ratio;
}

const toLayoutUnit = (value: number) => Math.round(value * 64) / 64;

/** The insets last written to each floating element, to find its containing block. */
const applied = new WeakMap<HTMLElement, { x: number; y: number }>();

const lengths = (value: string): string[] => value.trim().split(/\s+/);

/** A computed length, resolving a percentage against `basis`. */
function resolveLength(value: string | undefined, basis: number): number {
  if (!value) return 0;
  const number = Number.parseFloat(value);
  if (!Number.isFinite(number)) return 0;
  return value.endsWith('%') ? (number / 100) * basis : number;
}

/**
 * The element's layout box in viewport coordinates: its bounding box with its
 * **own** `translate`, `scale` and `transform` undone (about its
 * `transform-origin`). An entry animation (`scale: 0.96` to `1`, a slide)
 * must not move where the element is placed: the bounding box alone would
 * depend on how far the animation had run. Rotation and skew are not undone
 * (the bounding box is used as is); ancestors' transforms stay measured, as
 * they should.
 */
export function layoutBox(element: HTMLElement): { x: number; y: number } {
  const box = element.getBoundingClientRect();
  const view = getOwnerWindow(element);
  if (!view?.getComputedStyle) return box;
  const style = view.getComputedStyle(element);
  const width = element.offsetWidth;
  const height = element.offsetHeight;
  const rotate = style.getPropertyValue('rotate');
  if (rotate && rotate !== 'none') return box;

  let a = 1;
  let d = 1;
  let e = 0;
  let f = 0;
  const transform = style.getPropertyValue('transform');
  if (transform && transform !== 'none') {
    const values = (/\(([^)]*)\)/.exec(transform)?.[1] ?? '').split(',').map(Number);
    const is3d = transform.startsWith('matrix3d');
    const [ma, mb, mc, md, me, mf] = is3d
      ? [values[0], values[1], values[4], values[5], values[12], values[13]]
      : values;
    if (
      ma === undefined ||
      md === undefined ||
      Math.abs(mb ?? 0) > 1e-9 ||
      Math.abs(mc ?? 0) > 1e-9
    ) {
      return box;
    }
    a = ma;
    d = md;
    e = me ?? 0;
    f = mf ?? 0;
  }
  const scale = style.getPropertyValue('scale');
  let sx = 1;
  let sy = 1;
  if (scale && scale !== 'none') {
    const [first, second] = lengths(scale);
    const factor = (value: string) => Number.parseFloat(value) / (value.endsWith('%') ? 100 : 1);
    sx = first ? factor(first) : 1;
    sy = second === undefined ? sx : factor(second);
  }
  const translate = style.getPropertyValue('translate');
  let tx = 0;
  let ty = 0;
  if (translate && translate !== 'none') {
    const [first, second] = lengths(translate);
    tx = resolveLength(first, width);
    ty = resolveLength(second, height);
  }
  const [originX, originY] = lengths(style.getPropertyValue('transform-origin') || '');
  const ox = resolveLength(originX, width);
  const oy = resolveLength(originY, height);
  // translate · scale · transform, about the origin: x' = L + ox + tx + sx·(a·(0 - ox) + e).
  const scaleX = sx * a;
  const scaleY = sy * d;
  if (scaleX <= 0 || scaleY <= 0) return box;
  return {
    x: box.x - ox - tx - sx * (e - a * ox),
    y: box.y - oy - ty - sy * (f - d * oy),
  };
}

/**
 * Writes a result to the floating element: `position` and `top`/`left`
 * insets from its containing block's origin. The origin is measured, not
 * assumed, so a transformed or zoomed ancestor, the top layer and margins all
 * land the element on the computed viewport pixels; the element's own
 * transforms (an entry animation) are left out of the measurement
 * ({@link layoutBox}). Those pixels are snapped to the device pixel grid
 * ({@link snapToDevicePixel}, with the window's `devicePixelRatio`), and so is
 * the arrow's offset; the exposed available size is not rounded. The offset
 * is written as insets, not a transform, so the layout position itself is on
 * the grid and nothing is left for paint to snap one way or the other, and
 * the element always gets its own compositing layer (`will-change:
 * transform`) so its text rasterizes the same way every time.
 * Physical `top`/`left` are geometry here: right-to-left placement is
 * already resolved by the math. Also sets `data-placement` and `data-side`
 * for styling.
 */
export function applyPosition(
  floating: HTMLElement,
  result: ComputePositionResult,
  options: ApplyPositionOptions = {}
): void {
  const style = floating.style;
  style.setProperty('position', options.strategy ?? 'fixed');
  // `right`/`bottom` auto: with the popover UA style (`inset: 0; margin: auto`)
  // the auto margins would otherwise re-center the box as `left`/`top` change.
  style.setProperty('right', 'auto');
  style.setProperty('bottom', 'auto');
  const last = applied.get(floating);
  if (!last) {
    style.setProperty('top', '0px');
    style.setProperty('left', '0px');
  }
  const box = layoutBox(floating);
  // Layout positions are multiples of 1/64 px (layout units). Measured mid-animation,
  // undoing the element's own scale leaves float residue that would otherwise vary
  // with the animation's progress; rounding to the unit removes it (and costs at most
  // 1/128 px under a scaled ancestor).
  const originX = toLayoutUnit(box.x - (last?.x ?? 0));
  const originY = toLayoutUnit(box.y - (last?.y ?? 0));
  const ratio = getOwnerWindow(floating)?.devicePixelRatio ?? 1;
  // Snap where the element lands (origin + inset), not the inset itself.
  const x = snapToDevicePixel(result.x, ratio) - originX;
  const y = snapToDevicePixel(result.y, ratio) - originY;
  style.setProperty('top', `${y}px`);
  style.setProperty('left', `${x}px`);
  // Always its own compositing layer: otherwise the browser rasterizes the panel's
  // text one way when it happens to be composited (an entry animation, a transient)
  // and another way when it is painted with the page. Like the former inline
  // `translate`, this also keeps the panel a containing block for nested fixed layers.
  style.setProperty('will-change', 'transform');
  applied.set(floating, { x, y });

  floating.dataset.placement = result.placement;
  floating.dataset.side = result.placement.split('-')[0];
  if (options.exposeSize) {
    style.setProperty('--texuli-available-width', `${result.width}px`);
    style.setProperty('--texuli-available-height', `${result.height}px`);
  }
  if (options.arrowElement && result.arrow) {
    const arrow = options.arrowElement.style;
    arrow.setProperty('position', 'absolute');
    // The math gives the center of the arrow base; place its top-left there.
    const width = options.arrowElement.offsetWidth;
    const height = options.arrowElement.offsetHeight;
    const side = result.arrow.side;
    const ax = side === 'top' || side === 'bottom' ? result.arrow.x - width / 2 : result.arrow.x;
    const ay = side === 'left' || side === 'right' ? result.arrow.y - height / 2 : result.arrow.y;
    arrow.setProperty('top', `${snapToDevicePixel(ay, ratio)}px`);
    arrow.setProperty('left', `${snapToDevicePixel(ax, ratio)}px`);
    options.arrowElement.dataset.side = side;
  }
}

/** Forgets what `applyPosition` wrote, and removes it from the element. */
export function clearPosition(floating: HTMLElement): void {
  applied.delete(floating);
  for (const property of [
    'position',
    'top',
    'left',
    'right',
    'bottom',
    'will-change',
    '--texuli-available-width',
    '--texuli-available-height',
  ]) {
    floating.style.removeProperty(property);
  }
  clearSameWidth(floating);
  delete floating.dataset.placement;
  delete floating.dataset.side;
}

/** The window a reference and floating pair live in. */
export function positionWindow(
  reference: PositionReference,
  floating: Element
): Window | undefined {
  return getOwnerWindow(floating) ?? getOwnerWindow(referenceElement(reference));
}
