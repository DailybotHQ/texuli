/**
 * Board view: the Svelte Board plus the pure engine.
 * For plain Node / Protoyard views, import `@texuli/data/board/engine` instead —
 * this entry mixes `Board.svelte` and cannot load without a Svelte toolchain.
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
} from '../engines/board/board.ts';
export {
  describePosition,
  IDLE,
  type KeyboardMoveState,
  type MoveIntentResult,
  type MoveKey,
  moveIntent,
  pickUp,
} from '../engines/board/keyboard.ts';
export {
  assertRank,
  compareRanks,
  isRank,
  RankError,
  rankBetween,
  rankSequence,
} from '../engines/board/rank.ts';
export { default as Board } from './Board.svelte';
export {
  type BoardPlacement,
  DRAG_THRESHOLD_PX,
  indexFromPointer,
  type MoveMenuDestination,
  moveMenuDestinations,
  placementsOf,
} from './model.ts';
export type { BoardLabels } from './types.ts';
