import type {
  AnyPlacement,
  ArrowPosition,
  ComputePositionOptions,
  ComputePositionResult,
  LogicalPlacement,
  Placement,
  PositionOffset,
  Rect,
  SideOverflow,
  TextDirection,
} from './types.ts';

const PHYSICAL: readonly Placement[] = [
  'top',
  'top-start',
  'top-end',
  'bottom',
  'bottom-start',
  'bottom-end',
  'left',
  'left-start',
  'left-end',
  'right',
  'right-start',
  'right-end',
] as const;

const LOGICAL = new Set<string>([
  'block-start',
  'block-start-start',
  'block-start-end',
  'block-end',
  'block-end-start',
  'block-end-end',
  'inline-start',
  'inline-start-start',
  'inline-start-end',
  'inline-end',
  'inline-end-start',
  'inline-end-end',
]);

/** All twelve physical placements (stable order). */
export function listPlacements(): readonly Placement[] {
  return PHYSICAL;
}

export function isPlacement(value: string): value is Placement {
  return (PHYSICAL as readonly string[]).includes(value);
}

export function isLogicalPlacement(value: string): value is LogicalPlacement {
  return LOGICAL.has(value);
}

/**
 * Maps a logical placement to a physical one for horizontal-tb writing.
 * Block → top/bottom; inline → left/right with RTL swap.
 */
export function resolveLogicalPlacement(
  placement: LogicalPlacement,
  direction: TextDirection = 'ltr'
): Placement {
  const rtl = direction === 'rtl';
  switch (placement) {
    case 'block-start':
      return 'top';
    case 'block-start-start':
      return rtl ? 'top-end' : 'top-start';
    case 'block-start-end':
      return rtl ? 'top-start' : 'top-end';
    case 'block-end':
      return 'bottom';
    case 'block-end-start':
      return rtl ? 'bottom-end' : 'bottom-start';
    case 'block-end-end':
      return rtl ? 'bottom-start' : 'bottom-end';
    case 'inline-start':
      return rtl ? 'right' : 'left';
    case 'inline-start-start':
      return rtl ? 'right-end' : 'left-start';
    case 'inline-start-end':
      return rtl ? 'right-start' : 'left-end';
    case 'inline-end':
      return rtl ? 'left' : 'right';
    case 'inline-end-start':
      return rtl ? 'left-end' : 'right-start';
    case 'inline-end-end':
      return rtl ? 'left-start' : 'right-end';
    default: {
      const _exhaustive: never = placement;
      return _exhaustive;
    }
  }
}

/**
 * Physical `-start`/`-end` follow the inline axis: in RTL, start is the right
 * edge of the reference. Call this when the author wrote a physical placement
 * but the document is RTL and start/end should mirror.
 */
export function mirrorPlacementForRtl(placement: Placement): Placement {
  switch (placement) {
    case 'top-start':
      return 'top-end';
    case 'top-end':
      return 'top-start';
    case 'bottom-start':
      return 'bottom-end';
    case 'bottom-end':
      return 'bottom-start';
    case 'left-start':
      return 'left-end';
    case 'left-end':
      return 'left-start';
    case 'right-start':
      return 'right-end';
    case 'right-end':
      return 'right-start';
    default:
      return placement;
  }
}

export function resolvePlacementForDirection(
  placement: AnyPlacement,
  direction: TextDirection = 'ltr',
  /**
   * When true (default), physical top/bottom/left/right `-start`/`-end` also
   * mirror under RTL so "start" always means inline-start.
   */
  mirrorPhysicalStartEnd = true
): Placement {
  if (isLogicalPlacement(placement)) {
    return resolveLogicalPlacement(placement, direction);
  }
  if (direction === 'rtl' && mirrorPhysicalStartEnd) {
    return mirrorPlacementForRtl(placement);
  }
  return placement;
}

function normalizeOffset(offset: number | PositionOffset | undefined): {
  mainAxis: number;
  crossAxis: number;
} {
  if (offset === undefined) return { mainAxis: 0, crossAxis: 0 };
  if (typeof offset === 'number') return { mainAxis: offset, crossAxis: 0 };
  return {
    mainAxis: offset.mainAxis ?? 0,
    crossAxis: offset.crossAxis ?? 0,
  };
}

function mainSide(placement: Placement): 'top' | 'bottom' | 'left' | 'right' {
  if (placement.startsWith('top')) return 'top';
  if (placement.startsWith('bottom')) return 'bottom';
  if (placement.startsWith('left')) return 'left';
  return 'right';
}

function alignment(placement: Placement): 'start' | 'end' | 'center' {
  if (placement.endsWith('-start')) return 'start';
  if (placement.endsWith('-end')) return 'end';
  return 'center';
}

/** Build a rect from top-left and size. */
export function rect(x: number, y: number, width: number, height: number): Rect {
  return { x, y, width: Math.max(0, width), height: Math.max(0, height) };
}

export function rectRight(r: Rect): number {
  return r.x + r.width;
}

export function rectBottom(r: Rect): number {
  return r.y + r.height;
}

/** Expand/shrink a rect by padding on every side (positive expands outward). */
export function insetRect(r: Rect, padding: number): Rect {
  return rect(r.x + padding, r.y + padding, r.width - padding * 2, r.height - padding * 2);
}

/**
 * Place the floating box relative to the reference with offset only
 * (no flip/shift/size). Coordinates are the floating top-left.
 */
export function place(
  reference: Rect,
  floating: { width: number; height: number },
  placement: Placement,
  offset: number | PositionOffset = 0
): { x: number; y: number } {
  const { mainAxis, crossAxis } = normalizeOffset(offset);
  const side = mainSide(placement);
  const align = alignment(placement);
  const fw = floating.width;
  const fh = floating.height;

  let x = 0;
  let y = 0;

  if (side === 'top' || side === 'bottom') {
    y = side === 'top' ? reference.y - fh - mainAxis : rectBottom(reference) + mainAxis;
    if (align === 'start') x = reference.x + crossAxis;
    else if (align === 'end') x = rectRight(reference) - fw + crossAxis;
    else x = reference.x + (reference.width - fw) / 2 + crossAxis;
  } else {
    x = side === 'left' ? reference.x - fw - mainAxis : rectRight(reference) + mainAxis;
    if (align === 'start') y = reference.y + crossAxis;
    else if (align === 'end') y = rectBottom(reference) - fh + crossAxis;
    else y = reference.y + (reference.height - fh) / 2 + crossAxis;
  }

  return { x, y };
}

/** Overflow of a box beyond a boundary (positive = outside). */
export function overflowOf(box: Rect, boundary: Rect): SideOverflow {
  return {
    top: boundary.y - box.y,
    left: boundary.x - box.x,
    right: rectRight(box) - rectRight(boundary),
    bottom: rectBottom(box) - rectBottom(boundary),
  };
}

export function totalOverflow(o: SideOverflow): number {
  return Math.max(0, o.top) + Math.max(0, o.right) + Math.max(0, o.bottom) + Math.max(0, o.left);
}

/**
 * Candidate placements when flipping: opposite first, then the other sides,
 * keeping the same alignment when possible.
 */
export function flipFallbacks(preferred: Placement): Placement[] {
  const side = mainSide(preferred);
  const align = alignment(preferred);
  const suffix = align === 'center' ? '' : `-${align}`;
  const order: Array<'top' | 'bottom' | 'left' | 'right'> =
    side === 'top' || side === 'bottom'
      ? [side === 'top' ? 'bottom' : 'top', 'left', 'right', side]
      : [side === 'left' ? 'right' : 'left', 'top', 'bottom', side];

  const out: Placement[] = [];
  for (const s of order) {
    const p = (suffix ? `${s}${suffix}` : s) as Placement;
    if (!out.includes(p)) out.push(p);
    if (suffix) {
      const center = s as Placement;
      if (!out.includes(center)) out.push(center);
    }
  }
  // Always include the original first for scoring.
  return [preferred, ...out.filter((p) => p !== preferred)];
}

/**
 * Space available on each side of the reference inside the boundary
 * (after main-axis offset is reserved).
 */
export function availableSpace(
  reference: Rect,
  boundary: Rect,
  mainAxisOffset = 0
): Record<'top' | 'bottom' | 'left' | 'right', number> {
  return {
    top: Math.max(0, reference.y - boundary.y - mainAxisOffset),
    bottom: Math.max(0, rectBottom(boundary) - rectBottom(reference) - mainAxisOffset),
    left: Math.max(0, reference.x - boundary.x - mainAxisOffset),
    right: Math.max(0, rectRight(boundary) - rectRight(reference) - mainAxisOffset),
  };
}

/**
 * Clamp floating width/height to the space on the placement's main side.
 */
export function sizeToAvailable(
  reference: Rect,
  floating: { width: number; height: number },
  placement: Placement,
  boundary: Rect,
  mainAxisOffset = 0,
  minSize: { width?: number; height?: number } = {}
): { width: number; height: number } {
  const space = availableSpace(reference, boundary, mainAxisOffset);
  const side = mainSide(placement);
  const minW = minSize.width ?? 0;
  const minH = minSize.height ?? 0;

  let width = floating.width;
  let height = floating.height;

  if (side === 'top' || side === 'bottom') {
    height = Math.max(minH, Math.min(height, space[side]));
    // Cross axis: full boundary width is available after shift.
    width = Math.max(minW, Math.min(width, boundary.width));
  } else {
    width = Math.max(minW, Math.min(width, space[side]));
    height = Math.max(minH, Math.min(height, boundary.height));
  }

  return { width, height };
}

/**
 * Shift the floating top-left so the box stays inside the boundary on both
 * axes. Does not change size.
 */
export function shiftIntoBoundary(
  x: number,
  y: number,
  floating: { width: number; height: number },
  boundary: Rect
): { x: number; y: number } {
  let nextX = x;
  let nextY = y;
  const maxX = rectRight(boundary) - floating.width;
  const maxY = rectBottom(boundary) - floating.height;
  nextX = Math.min(Math.max(nextX, boundary.x), Math.max(boundary.x, maxX));
  nextY = Math.min(Math.max(nextY, boundary.y), Math.max(boundary.y, maxY));
  return { x: nextX, y: nextY };
}

/**
 * Arrow tip position relative to the floating top-left. Centers on the
 * reference along the cross axis and clamps inside the floating edge with
 * padding.
 */
export function arrowPosition(
  reference: Rect,
  floating: Rect,
  placement: Placement,
  arrow: { width: number; height: number; padding?: number }
): ArrowPosition {
  const pad = arrow.padding ?? 0;
  const side = mainSide(placement);
  const arrowSide: ArrowPosition['side'] =
    side === 'top' ? 'bottom' : side === 'bottom' ? 'top' : side === 'left' ? 'right' : 'left';

  if (side === 'top' || side === 'bottom') {
    const center = reference.x + reference.width / 2 - floating.x;
    const min = pad + arrow.width / 2;
    const max = floating.width - pad - arrow.width / 2;
    const x = Math.min(Math.max(center, min), Math.max(min, max));
    const y = side === 'top' ? floating.height : -arrow.height;
    return { x, y, side: arrowSide };
  }

  const center = reference.y + reference.height / 2 - floating.y;
  const min = pad + arrow.height / 2;
  const max = floating.height - pad - arrow.height / 2;
  const y = Math.min(Math.max(center, min), Math.max(min, max));
  const x = side === 'left' ? floating.width : -arrow.width;
  return { x, y, side: arrowSide };
}

/**
 * Pure placement pipeline: resolve direction → optional size → place → flip →
 * shift → arrow. Rects in, coordinates out. No DOM access.
 */
export function computePosition(
  reference: Rect,
  floating: { width: number; height: number },
  options: ComputePositionOptions
): ComputePositionResult {
  const direction = options.direction ?? 'ltr';
  const preferred = resolvePlacementForDirection(options.placement, direction);
  const { mainAxis, crossAxis } = normalizeOffset(options.offset);
  const offset = { mainAxis, crossAxis };
  const padding = options.boundaryPadding ?? 0;
  const boundary =
    options.boundary === undefined
      ? undefined
      : padding !== 0
        ? insetRect(options.boundary, padding)
        : options.boundary;

  const width = Math.max(0, floating.width);
  const height = Math.max(0, floating.height);

  const tryPlacement = (placement: Placement): ComputePositionResult => {
    let w = width;
    let h = height;
    if (options.size && boundary) {
      const sized = sizeToAvailable(
        reference,
        { width: w, height: h },
        placement,
        boundary,
        mainAxis,
        options.minSize
      );
      w = sized.width;
      h = sized.height;
    }
    let { x, y } = place(reference, { width: w, height: h }, placement, offset);
    let overflow: SideOverflow = { top: 0, right: 0, bottom: 0, left: 0 };
    if (boundary) {
      overflow = overflowOf(rect(x, y, w, h), boundary);
      if (options.shift) {
        const shifted = shiftIntoBoundary(x, y, { width: w, height: h }, boundary);
        x = shifted.x;
        y = shifted.y;
        overflow = overflowOf(rect(x, y, w, h), boundary);
      }
    }
    const floatingRect = rect(x, y, w, h);
    const arrow =
      options.arrow === undefined
        ? undefined
        : arrowPosition(reference, floatingRect, placement, options.arrow);
    return { x, y, placement, width: w, height: h, overflow, ...(arrow ? { arrow } : {}) };
  };

  if (!options.flip || !boundary) {
    return tryPlacement(preferred);
  }

  let best = tryPlacement(preferred);
  let bestScore = totalOverflow(best.overflow);
  if (bestScore === 0) return best;

  for (const candidate of flipFallbacks(preferred).slice(1)) {
    const next = tryPlacement(candidate);
    const score = totalOverflow(next.overflow);
    if (score < bestScore) {
      best = next;
      bestScore = score;
      if (score === 0) break;
    }
  }
  return best;
}
