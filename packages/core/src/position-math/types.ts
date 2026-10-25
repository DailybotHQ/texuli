/**
 * Axis-aligned rectangle in the same coordinate space as the viewport or a
 * positioning root. `x`/`y` are the top-left corner (physical, not logical).
 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The twelve physical placements used by floating UI (popover, menu, tooltip).
 * `-start` / `-end` align the floating edge to the reference's start/end on
 * the cross axis (see {@link resolvePlacementForDirection} for RTL).
 */
export type Placement =
  | 'top'
  | 'top-start'
  | 'top-end'
  | 'bottom'
  | 'bottom-start'
  | 'bottom-end'
  | 'left'
  | 'left-start'
  | 'left-end'
  | 'right'
  | 'right-start'
  | 'right-end';

/** Logical placements that map to physical ones with a text direction. */
export type LogicalPlacement =
  | 'block-start'
  | 'block-start-start'
  | 'block-start-end'
  | 'block-end'
  | 'block-end-start'
  | 'block-end-end'
  | 'inline-start'
  | 'inline-start-start'
  | 'inline-start-end'
  | 'inline-end'
  | 'inline-end-start'
  | 'inline-end-end';

export type AnyPlacement = Placement | LogicalPlacement;

/** Main-axis and cross-axis gap between reference and floating. */
export interface PositionOffset {
  /** Along the placement side (e.g. away from the reference). Default 0. */
  mainAxis?: number;
  /** Along the cross axis (e.g. slide along the edge). Default 0. */
  crossAxis?: number;
}

export type TextDirection = 'ltr' | 'rtl';

export interface ComputePositionOptions {
  /** Preferred placement before flip. */
  placement: AnyPlacement;
  /** Text direction for logical placements and for physical `-start`/`-end`. */
  direction?: TextDirection;
  /** Gap between reference and floating. A number is main-axis only. */
  offset?: number | PositionOffset;
  /**
   * Rectangle the floating element must stay inside after shift/size.
   * When omitted, flip/shift/size are no-ops against the boundary.
   */
  boundary?: Rect;
  /** Inset the boundary before measuring overflow. Default 0. */
  boundaryPadding?: number;
  /** Try the opposite side (and then start/end variants) when overflowing. */
  flip?: boolean;
  /** Slide along the cross axis to reduce overflow. */
  shift?: boolean;
  /**
   * Clamp the floating width/height to the space available on the chosen side
   * (after offset), returning the clamped size alongside coordinates.
   */
  size?: boolean;
  /** Minimum size when `size` is true. Default 0. */
  minSize?: { width?: number; height?: number };
  /** Arrow element size for arrow tip coordinates (optional). */
  arrow?: { width: number; height: number; padding?: number };
}

export interface ArrowPosition {
  /** Offset from the floating top-left along x (center of the arrow base). */
  x: number;
  /** Offset from the floating top-left along y. */
  y: number;
  /** Side of the floating box the arrow sits on (opposite the placement side). */
  side: 'top' | 'bottom' | 'left' | 'right';
}

export interface ComputePositionResult {
  x: number;
  y: number;
  /** Placement after flip (always physical). */
  placement: Placement;
  /** Floating size after optional size-to-fit (equals input when size is off). */
  width: number;
  height: number;
  /** Overflow against the padded boundary before shift (for debugging). */
  overflow: SideOverflow;
  arrow?: ArrowPosition;
}

export interface SideOverflow {
  top: number;
  right: number;
  bottom: number;
  left: number;
}
