// @vitest-environment node
/// <reference types="node" />
/**
 * `@texuli/data/board/engine` must load in plain Node (no DOM, no Svelte).
 * Protoyard views re-export this path for adoption.
 */
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import {
  type BoardColumnDef,
  type BoardOptions,
  evaluateWip,
  groupBoard,
  IDLE,
  isRank,
  moveIntent,
  pickUp,
  rankBetween,
  rankSequence,
  validateMove,
} from '../src/engines/board/index.ts';

type Card = { id: string; columnId: string; rank: string; title: string };

const COLUMNS: BoardColumnDef[] = [
  { id: 'todo', title: 'Todo' },
  { id: 'doing', title: 'Doing', wip: { hard: 1 } },
  { id: 'done', title: 'Done' },
];

const OPTIONS: BoardOptions<Card> = {
  columns: COLUMNS,
  id: (c) => c.id,
  column: (c) => c.columnId,
  rank: (c) => c.rank,
  label: (c) => c.title,
};

describe('@texuli/data/board/engine', () => {
  it('is free of DOM globals and maps the published board/engine subpath', () => {
    expect(typeof document).toBe('undefined');
    expect(typeof window).toBe('undefined');
    const require = createRequire(import.meta.url);
    const pkg = require('../package.json') as {
      exports: Record<string, string | Record<string, string>>;
    };
    expect(pkg.exports['./board/engine']).toBe('./src/engines/board/index.ts');
    // The view entry still exists and points at the Svelte board module.
    const board = pkg.exports['./board'];
    expect(board).toBeTruthy();
    if (typeof board === 'object') {
      expect(board.svelte).toContain('board/index');
    }
  });

  it('groups cards, ranks, validates WIP and drives keyboard moves without a view', () => {
    const [r0, r1] = rankSequence(2) as [string, string];
    expect(isRank(r0)).toBe(true);
    expect(rankBetween(null, r1)).toBeTruthy();

    const items: Card[] = [
      { id: 'a', columnId: 'todo', rank: r0, title: 'Alpha' },
      { id: 'b', columnId: 'doing', rank: r0, title: 'Beta' },
    ];
    const grid = groupBoard(items, OPTIONS);
    expect(grid.columns.map((c) => c.id)).toEqual(['todo', 'doing', 'done']);
    expect(grid.cells[0]?.[0]?.items.map((c) => c.id)).toEqual(['a']);
    expect(grid.columnCounts.get('doing')).toBe(1);

    expect(evaluateWip(COLUMNS[1]!, 1).status).toBe('blocked');
    const rejected = validateMove(grid, 'a', { columnId: 'doing', index: 0 });
    expect(rejected.ok).toBe(false);

    const held = pickUp(grid, 'a');
    expect(held.state.mode).toBe('held');
    expect(held.state).not.toBe(IDLE);
    const moved = moveIntent(grid, held.state, { key: 'ArrowRight' });
    expect(moved.handled).toBe(true);
    expect(moved.state.mode).toBe('held');
  });
});
