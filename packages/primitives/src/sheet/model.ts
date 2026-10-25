import { inlineSideToPhysical, type TextDirection } from '@texuli/core/dir-locale';

/** The edge a sheet or drawer is attached to; `center` is a plain centered dialog. */
export type SheetSide = 'top' | 'right' | 'bottom' | 'left' | 'start' | 'end' | 'center';
export type PhysicalSheetSide = Exclude<SheetSide, 'start' | 'end'>;

/** Resolve logical inline sides while preserving explicit physical sides. */
export function resolveSheetSide(side: SheetSide, direction: TextDirection): PhysicalSheetSide {
  if (side === 'start' || side === 'end') return inlineSideToPhysical(side, direction);
  return side;
}

/** Drag axis and the sign that points toward the attached edge (the dismiss direction). */
export function dismissDirection(side: PhysicalSheetSide): { axis: 'x' | 'y'; sign: 1 | -1 } {
  if (side === 'left' || side === 'right') return { axis: 'x', sign: side === 'right' ? 1 : -1 };
  return { axis: 'y', sign: side === 'top' ? -1 : 1 };
}

/** How long a release keeps travelling at its speed when choosing where to settle (ms). */
export const DRAWER_PROJECTION_MS = 200;

/**
 * Where a released drawer settles. `offset` is how far it is pushed toward its
 * edge, in px (0: fully open); `velocity` is px/ms toward the edge; snap points
 * are the visible fractions of the drawer (0 to 1). Returns the index of the
 * snap point to settle on, or -1 to dismiss.
 */
export function releaseTarget(
  offset: number,
  velocity: number,
  size: number,
  snapPoints: readonly number[],
  dismissible: boolean
): number {
  const projected = offset + velocity * DRAWER_PROJECTION_MS;
  let best = -1;
  let distance = dismissible ? Math.abs(size - projected) : Number.POSITIVE_INFINITY;
  snapPoints.forEach((snap, index) => {
    const gap = Math.abs((1 - snap) * size - projected);
    if (gap < distance) {
      best = index;
      distance = gap;
    }
  });
  return best;
}
