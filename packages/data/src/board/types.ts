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
}
