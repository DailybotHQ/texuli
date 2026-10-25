import {
  type BoardGrid,
  type BoardMove,
  type MoveRules,
  type MoveTarget,
  validateMove,
} from '../engines/board/board.ts';

/** The temporary placement of an item while its host saves a move. */
export interface BoardPlacement {
  columnId: string;
  laneId: string;
  rank: string;
}

/** One entry in the per-card “Move …” menu (WCAG 2.5.7 alternative to drag). */
export interface MoveMenuDestination {
  /** Stable id for the menu item (`columnId:laneId:position`). */
  id: string;
  /** Visible label, e.g. `Done — top`. */
  label: string;
  target: MoveTarget;
  /** True when the move is invalid or would not change placement. */
  disabled: boolean;
  /** Announced when the user activates a disabled item. */
  reason?: string;
}

/**
 * Top and bottom of every column (current lane) as menu destinations.
 * Pure: uses `validateMove` so WIP and `canMove` rules match the drag path.
 */
export function moveMenuDestinations<T>(
  grid: BoardGrid<T>,
  itemId: string,
  rules: MoveRules<T> = {}
): MoveMenuDestination[] {
  const from = grid.positions.get(itemId);
  if (!from) return [];
  const fromLane = grid.lanes[from.laneIndex];
  if (!fromLane) return [];
  const destinations: MoveMenuDestination[] = [];
  for (const column of grid.columns) {
    for (const position of ['top', 'bottom'] as const) {
      const others =
        grid.cells[from.laneIndex]?.[
          grid.columns.findIndex((candidate) => candidate.id === column.id)
        ]?.items.filter((item) => grid.options.id(item) !== itemId) ?? [];
      const index = position === 'top' ? 0 : others.length;
      const target: MoveTarget = {
        columnId: column.id,
        laneId: fromLane.id,
        index,
      };
      const result = validateMove(grid, itemId, target, rules);
      const label = position === 'top' ? `${column.title} — top` : `${column.title} — bottom`;
      const id = `${column.id}:${fromLane.id}:${position}`;
      if (!result.ok) {
        destinations.push({ id, label, target, disabled: true, reason: result.reason });
        continue;
      }
      if (result.unchanged) {
        destinations.push({
          id,
          label,
          target,
          disabled: true,
          reason: `Already at ${label.toLowerCase()}.`,
        });
        continue;
      }
      destinations.push({ id, label, target, disabled: false });
    }
  }
  return destinations;
}

/** Placements for the moved item and any neighbors that received fresh ranks. */
export function placementsOf(move: BoardMove): Record<string, BoardPlacement> {
  const placements: Record<string, BoardPlacement> = {
    [move.itemId]: { columnId: move.columnId, laneId: move.laneId, rank: move.rank },
  };
  for (const entry of move.rerank ?? []) {
    placements[entry.itemId] = { columnId: move.columnId, laneId: move.laneId, rank: entry.rank };
  }
  return placements;
}

/** Pointer travel before a press becomes a drag, preserving ordinary clicks. */
export const DRAG_THRESHOLD_PX = 4;

/** Index before the first item whose vertical midpoint is below the pointer. */
export function indexFromPointer(middles: readonly number[], y: number): number {
  const index = middles.findIndex((middle) => y < middle);
  return index === -1 ? middles.length : index;
}
