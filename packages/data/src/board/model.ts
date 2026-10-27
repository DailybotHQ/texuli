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
  /** Visible label, from `MoveMenuText.top` or `.bottom`. */
  label: string;
  target: MoveTarget;
  /** True when the move is invalid or would not change placement. */
  disabled: boolean;
  /** Announced when the user activates a disabled item. */
  reason?: string;
}

/** Translatable menu text; see `BoardLabels`. */
export interface MoveMenuText {
  top: (columnTitle: string) => string;
  bottom: (columnTitle: string) => string;
  /** Reason for a destination that would not change placement. */
  alreadyAt: (destinationLabel: string) => string;
}

export const DEFAULT_MOVE_MENU_TEXT: MoveMenuText = {
  top: (column) => `${column} — top`,
  bottom: (column) => `${column} — bottom`,
  alreadyAt: (label) => `Already at ${label.toLowerCase()}.`,
};

/**
 * Top and bottom of every column (current lane) as menu destinations.
 * Pure: uses `validateMove` so WIP and `canMove` rules match the drag path.
 */
export function moveMenuDestinations<T>(
  grid: BoardGrid<T>,
  itemId: string,
  rules: MoveRules<T> = {},
  text: MoveMenuText = DEFAULT_MOVE_MENU_TEXT
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
      const label = position === 'top' ? text.top(column.title) : text.bottom(column.title);
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
          reason: text.alreadyAt(label),
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
