/**
 * Pure floating-UI placement math (no DOM). Used by the overlay engine and
 * every popover, menu, tooltip and select.
 */
export {
  arrowPosition,
  availableSpace,
  computePosition,
  flipFallbacks,
  insetRect,
  isLogicalPlacement,
  isPlacement,
  listPlacements,
  mirrorPlacementForRtl,
  overflowOf,
  place,
  rect,
  rectBottom,
  rectRight,
  resolveLogicalPlacement,
  resolvePlacementForDirection,
  shiftIntoBoundary,
  sizeToAvailable,
  totalOverflow,
} from './math.ts';
export type {
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
