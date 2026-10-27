/**
 * The framework-free board engine: fractional rank
 * keys, columns × swimlanes grouping, WIP limits, move validation and a
 * keyboard drag state machine. A view layer renders it.
 * Everything here is pure; persisting a move belongs to the host application,
 * and that host must enforce authorization and transactional rules.
 * It must also enforce hard WIP limits.
 */
export {
  type BoardCell,
  type BoardColumnDef,
  type BoardGrid,
  type BoardLaneDef,
  type BoardMove,
  type BoardOptions,
  type BoardPosition,
  DEFAULT_LANE,
  evaluateWip,
  groupBoard,
  type MoveResult,
  type MoveRules,
  type MoveTarget,
  validateMove,
  type WipEvaluation,
  type WipLimit,
  type WipStatus,
} from './board.ts';
export {
  type BoardKeyboardText,
  type BoardPositionValues,
  DEFAULT_BOARD_KEYBOARD_TEXT,
  describePosition,
  IDLE,
  type KeyboardMoveState,
  type MoveIntentResult,
  type MoveKey,
  moveIntent,
  pickUp,
  positionValues,
} from './keyboard.ts';
export { assertRank, compareRanks, isRank, RankError, rankBetween, rankSequence } from './rank.ts';
