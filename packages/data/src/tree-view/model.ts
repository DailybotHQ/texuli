import type { TreeMove } from '../engines/tree/tree.ts';

/** Temporary placement while the host saves a move. */
export interface TreePlacement {
  parentId: string | null;
  rank: string;
}

/** Placements for the moved node and any siblings that received fresh ranks. */
export function placementsOf(move: TreeMove): Record<string, TreePlacement> {
  const placements: Record<string, TreePlacement> = {
    [move.id]: { parentId: move.parentId, rank: move.rank },
  };
  for (const entry of move.rerank ?? []) {
    placements[entry.id] = { parentId: move.parentId, rank: entry.rank };
  }
  return placements;
}

/**
 * Nest a drop under a row when the pointer sits in the trailing third of the
 * row's inline box (logical end), matching outline editors.
 */
export function dropAsChild(
  rowInlineStart: number,
  rowInlineSize: number,
  pointerInline: number,
  direction: 'ltr' | 'rtl'
): boolean {
  if (rowInlineSize <= 0) return false;
  const local =
    direction === 'rtl'
      ? rowInlineStart + rowInlineSize - pointerInline
      : pointerInline - rowInlineStart;
  return local / rowInlineSize >= 2 / 3;
}

/** Depth indent in rem for `aria-level` 1…n (logical padding-inline-start). */
export function depthIndentRem(level: number): number {
  return Math.max(0, level - 1) * 1.25;
}
