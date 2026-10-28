import type { BoardKeyboardText } from '../engines/board/keyboard.ts';

/** Translatable labels used by the board controls and live announcements. */
export interface BoardLabels {
  board: string;
  instructions: string;
  dragHandle: (itemLabel: string) => string;
  /** Accessible name for the per-card move menu trigger (WCAG 2.5.7). */
  moveMenu: (itemLabel: string) => string;
  /** Accessible name for the move menu popup. */
  moveMenuLabel: (itemLabel: string) => string;
  emptyCell: string;
  unplaced: string;
  savingMove: string;
  cardCount: (count: number, hardLimit?: number) => string;
  announcement: (message: string) => string;
  /** Announced after a move: `edge` is where the card landed in the column. */
  moved: (itemLabel: string, columnTitle: string, edge: 'top' | 'bottom') => string;
  /** Announced when the host's `onMove` fails and the card returns. */
  moveFailed: (itemLabel: string) => string;
  /** Announced when a locked card is asked to move. */
  locked: (itemLabel: string) => string;
  /** Announced for a disabled move-menu destination without its own reason. */
  cannotMove: (itemLabel: string) => string;
  /** Move-menu destinations: the top and bottom of a column. */
  menuTop: (columnTitle: string) => string;
  menuBottom: (columnTitle: string) => string;
  /** Reason for a destination that would not change placement. */
  alreadyAt: (destinationLabel: string) => string;
  /** Keyboard drag announcements (pick up, move, drop, cancel, edges). */
  keyboard: BoardKeyboardText;
}

/** The `labels` prop: any label, and any keyboard sentence, may be overridden. */
export type BoardLabelOverrides = Partial<Omit<BoardLabels, 'keyboard'>> & {
  keyboard?: Partial<BoardKeyboardText>;
};
