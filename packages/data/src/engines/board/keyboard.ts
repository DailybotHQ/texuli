import {
  type BoardGrid,
  type BoardMove,
  type BoardPosition,
  evaluateWip,
  type MoveRules,
  validateMove,
} from './board.ts';

/**
 * Keyboard drag for a board, as a pure state machine. Focus a card, press
 * Space or Enter to pick it up (`pickUp`), then feed every keydown to
 * `moveIntent`:
 *
 * | Key | Effect |
 * | --- | --- |
 * | ArrowLeft / ArrowRight | previous / next column |
 * | ArrowUp / ArrowDown | up / down inside the cell |
 * | Shift + ArrowUp / ArrowDown | previous / next lane |
 * | Home / End | first / last position in the cell |
 * | Space / Enter | drop (validated; a rejected drop keeps the card in hand) |
 * | Escape | cancel (the card goes back) |
 *
 * Each result carries an announcement for an `aria-live` region. Positions
 * count the cell without the held card, so "position 2 of 4" is where it lands.
 * Every sentence comes from a `BoardKeyboardText` (English defaults); pass
 * your own to localize them.
 */

export type KeyboardMoveState =
  | { mode: 'idle' }
  | { mode: 'held'; itemId: string; origin: BoardPosition; target: BoardPosition };

export const IDLE: KeyboardMoveState = { mode: 'idle' };

export interface MoveKey {
  key: string;
  shiftKey?: boolean;
}

export interface MoveIntentResult {
  state: KeyboardMoveState;
  /** False when the key means nothing here; let it through (do not preventDefault). */
  handled: boolean;
  announcement?: string;
  /** Set on a successful drop: hand it to the service that persists the move. */
  commit?: BoardMove;
}

/** Where a held card sits: plain values for localized templates. */
export interface BoardPositionValues {
  column: string;
  /** The lane title, or null on a board without lanes. */
  lane: string | null;
  /** 1-based, counting the cell without the held card. */
  position: number;
  total: number;
}

/** Every keyboard announcement. `where` is the result of `position`. */
export interface BoardKeyboardText {
  position: (at: BoardPositionValues) => string;
  pickedUp: (item: string, where: string, at: BoardPositionValues) => string;
  moved: (item: string, where: string, at: BoardPositionValues) => string;
  /** Hovering a full column: the drop will be refused. */
  blocked: (item: string, where: string, reason: string, at: BoardPositionValues) => string;
  dropped: (item: string, where: string, at: BoardPositionValues) => string;
  droppedInPlace: (item: string) => string;
  /** A refused drop: the card stays in hand. */
  stillHolding: (reason: string, item: string) => string;
  cancelled: (item: string, where: string, at: BoardPositionValues) => string;
  edge: (which: 'column' | 'lane' | 'top' | 'bottom') => string;
}

export const DEFAULT_BOARD_KEYBOARD_TEXT: BoardKeyboardText = {
  position: ({ column, lane, position, total }) =>
    `${column}${lane === null ? '' : `, lane ${lane}`}, position ${position} of ${total}`,
  pickedUp: (item, where) =>
    `Picked up ${item}. ${where}. Use the arrow keys to move, Space to drop, Escape to cancel.`,
  moved: (_item, where) => `${where}.`,
  blocked: (_item, where, reason) => `${where}. ${reason} Dropping here is not allowed.`,
  dropped: (item, where) => `Dropped ${item} in ${where}.`,
  droppedInPlace: (item) => `Dropped ${item} in its original place.`,
  stillHolding: (reason, item) => `${reason} Still holding ${item}.`,
  cancelled: (item, where) => `Move cancelled. ${item} is back in ${where}.`,
  edge: (which) =>
    `Already at ${
      which === 'column'
        ? 'the last column that way'
        : which === 'lane'
          ? 'the last lane that way'
          : `the ${which}`
    }.`,
};

function cellSize<T>(grid: BoardGrid<T>, itemId: string, at: BoardPosition): number {
  const items = grid.cells[at.laneIndex]?.[at.columnIndex]?.items ?? [];
  return items.filter((item) => grid.options.id(item) !== itemId).length;
}

function labelOf<T>(grid: BoardGrid<T>, itemId: string): string {
  const at = grid.positions.get(itemId);
  const item = at ? grid.cells[at.laneIndex]?.[at.columnIndex]?.items[at.index] : undefined;
  return item === undefined ? itemId : (grid.options.label?.(item) ?? itemId);
}

/** The values a position announcement uses (the lane is null on boards without lanes). */
export function positionValues<T>(
  grid: BoardGrid<T>,
  itemId: string,
  at: BoardPosition
): BoardPositionValues {
  return {
    column: grid.columns[at.columnIndex]?.title ?? '',
    lane: grid.lanes.length > 1 ? (grid.lanes[at.laneIndex]?.title ?? '') : null,
    position: at.index + 1,
    total: cellSize(grid, itemId, at) + 1,
  };
}

/** "Doing, lane Mobile, position 2 of 4" (the lane is omitted on boards without lanes). */
export function describePosition<T>(
  grid: BoardGrid<T>,
  itemId: string,
  at: BoardPosition,
  text: BoardKeyboardText = DEFAULT_BOARD_KEYBOARD_TEXT
): string {
  return text.position(positionValues(grid, itemId, at));
}

/** Picks up `itemId`; returns `handled: false` when it is not on the board. */
export function pickUp<T>(
  grid: BoardGrid<T>,
  itemId: string,
  text: BoardKeyboardText = DEFAULT_BOARD_KEYBOARD_TEXT
): MoveIntentResult {
  const origin = grid.positions.get(itemId);
  if (!origin) return { state: IDLE, handled: false };
  const at = positionValues(grid, itemId, origin);
  return {
    state: { mode: 'held', itemId, origin, target: origin },
    handled: true,
    announcement: text.pickedUp(labelOf(grid, itemId), text.position(at), at),
  };
}

function moveTo<T>(
  grid: BoardGrid<T>,
  state: Extract<KeyboardMoveState, { mode: 'held' }>,
  next: BoardPosition,
  text: BoardKeyboardText
): MoveIntentResult {
  const size = cellSize(grid, state.itemId, next);
  const target = { ...next, index: Math.max(0, Math.min(next.index, size)) };
  const column = grid.columns[target.columnIndex];
  const at = positionValues(grid, state.itemId, target);
  const where = text.position(at);
  // Warn while hovering a full column, so the rejected drop is no surprise.
  if (column && target.columnIndex !== state.origin.columnIndex) {
    const wip = evaluateWip(column, grid.columnCounts.get(column.id) ?? 0);
    if (wip.status === 'blocked') {
      return {
        state: { ...state, target },
        handled: true,
        announcement: text.blocked(labelOf(grid, state.itemId), where, wip.reason ?? '', at),
      };
    }
  }
  return {
    state: { ...state, target },
    handled: true,
    announcement: text.moved(labelOf(grid, state.itemId), where, at),
  };
}

/** Applies one key to the keyboard drag. Pure: the caller stores the state. */
export function moveIntent<T>(
  grid: BoardGrid<T>,
  state: KeyboardMoveState,
  event: MoveKey,
  rules: MoveRules<T> = {},
  text: BoardKeyboardText = DEFAULT_BOARD_KEYBOARD_TEXT
): MoveIntentResult {
  if (state.mode !== 'held') return { state, handled: false };
  const { target } = state;
  const label = labelOf(grid, state.itemId);
  const lastColumn = grid.columns.length - 1;
  const lastLane = grid.lanes.length - 1;

  switch (event.key) {
    case 'ArrowLeft':
    case 'ArrowRight': {
      const step = event.key === 'ArrowLeft' ? -1 : 1;
      const columnIndex = Math.max(0, Math.min(target.columnIndex + step, lastColumn));
      if (columnIndex === target.columnIndex) return edge(state, text, 'column');
      return moveTo(grid, state, { ...target, columnIndex }, text);
    }
    case 'ArrowUp':
    case 'ArrowDown': {
      const step = event.key === 'ArrowUp' ? -1 : 1;
      if (event.shiftKey) {
        const laneIndex = Math.max(0, Math.min(target.laneIndex + step, lastLane));
        if (laneIndex === target.laneIndex) return edge(state, text, 'lane');
        return moveTo(grid, state, { ...target, laneIndex }, text);
      }
      const index = Math.max(
        0,
        Math.min(target.index + step, cellSize(grid, state.itemId, target))
      );
      if (index === target.index) return edge(state, text, step < 0 ? 'top' : 'bottom');
      return moveTo(grid, state, { ...target, index }, text);
    }
    case 'Home':
      return moveTo(grid, state, { ...target, index: 0 }, text);
    case 'End':
      return moveTo(grid, state, { ...target, index: Number.MAX_SAFE_INTEGER }, text);
    case ' ':
    case 'Spacebar':
    case 'Enter': {
      const column = grid.columns[target.columnIndex];
      const lane = grid.lanes[target.laneIndex];
      if (!column || !lane) return { state: IDLE, handled: true };
      const result = validateMove(
        grid,
        state.itemId,
        { columnId: column.id, laneId: lane.id, index: target.index },
        rules
      );
      if (!result.ok) {
        return { state, handled: true, announcement: text.stillHolding(result.reason, label) };
      }
      if (result.unchanged) {
        return {
          state: IDLE,
          handled: true,
          announcement: text.droppedInPlace(label),
        };
      }
      // The column may now be at its soft limit or full: say so after the drop.
      const warning = result.wip.status !== 'ok' ? ` ${result.wip.reason}` : '';
      const at = positionValues(grid, state.itemId, target);
      return {
        state: IDLE,
        handled: true,
        commit: result.move,
        announcement: `${text.dropped(label, text.position(at), at)}${warning}`,
      };
    }
    case 'Escape': {
      const at = positionValues(grid, state.itemId, state.origin);
      return {
        state: IDLE,
        handled: true,
        announcement: text.cancelled(label, text.position(at), at),
      };
    }
    default:
      return { state, handled: false };
  }
}

function edge(
  state: KeyboardMoveState,
  text: BoardKeyboardText,
  which: 'column' | 'lane' | 'top' | 'bottom'
): MoveIntentResult {
  return { state, handled: true, announcement: text.edge(which) };
}
