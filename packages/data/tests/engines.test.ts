// @vitest-environment node
/// <reference types="node" />

import {
  createInfiniteLoader,
  createVirtualList,
  nextVirtualListIndex,
} from '@texuli/data/virtual-list';
import { describe, expect, it, vi } from 'vitest';
import { formatCalendar } from '../src/calendar/model.ts';
import {
  type ActivityComment,
  type AuditRowLike,
  auditToActivity,
  buildThreads,
  CommentInputSchema,
  dayLabel,
  decodeMentions,
  describeChange,
  encodeMentions,
  filterActivity,
  groupByDay,
  mentionedIds,
  plainText,
  REDACTED,
  sortActivity,
  summarizeChanges,
  toggleReaction,
  tokenize,
  whenLabel,
} from '../src/engines/activity/index.ts';
import {
  type BoardColumnDef,
  type BoardOptions,
  evaluateWip,
  groupBoard,
  IDLE,
  isRank,
  type KeyboardMoveState,
  moveIntent,
  pickUp,
  RankError,
  rankBetween,
  rankSequence,
  validateMove,
} from '../src/engines/board/index.ts';
import {
  addDays,
  applyMove,
  type CalendarSeries,
  dayBounds,
  daySlot,
  daysBetween,
  eventKey,
  expandAll,
  expandSeries,
  formatRRule,
  isNoMove,
  keyMove,
  layoutDay,
  MAX_OCCURRENCES,
  monthGrid,
  moveChoices,
  moveOccurrence,
  NO_MOVE,
  nowMinute,
  occurrenceIndex,
  parseIsoDate,
  parseRRule,
  pointerMove,
  RecurrenceRuleSchema,
  slotMinuteAt,
  spanDates,
  splitSeries,
  stepAnchor,
  stepSlot,
  timedSlot,
  toIso,
  visibleRange,
  weekDates,
  weekStartFor,
  withinBounds,
  zonedInstant,
} from '../src/engines/calendar/index.ts';
import {
  breadcrumbs,
  categoryOf,
  childrenOf,
  descendantIds,
  extensionOf,
  type FileEntry,
  formatSize,
  moveProblem,
  nameProblem,
  thumbnailSvg,
  thumbnailUrl,
  uniqueName,
} from '../src/engines/files/index.ts';
import {
  applyView,
  compileFilter,
  createAxis,
  defaultColumnState,
  describeFilter,
  exceedsFilterLimits,
  FILTER_LIMITS,
  FILTER_OPERATOR_LABELS,
  type FilterNode,
  FilterNodeSchema,
  facetsFromFilter,
  filterFromFacets,
  filtersEqual,
  flattenGroups,
  type GridColumnDef,
  groupRows,
  isViewModified,
  moveColumn,
  nextViewId,
  normalizeFilter,
  parseSerializedFilter,
  pinColumn,
  pruneSelection,
  removeFilterAt,
  resizeColumn,
  resolveColumns,
  type SavedView,
  SavedViewSchema,
  SERIALIZED_FILTER_MAX_BYTES,
  sanitizeView,
  selectionState,
  selectRange,
  serializeFilter,
  setColumnHidden,
  setFacet,
  setVisibleSelected,
  showAllColumns,
  sortRows,
  tidyFilter,
  toggleFacetValue,
  toggleRow,
  type ViewState,
  viewStatesEqual,
  windowAxis,
  windowGrid,
} from '../src/engines/grid/index.ts';
import {
  BasemapSchema,
  basemapPaths,
  cluster,
  etaSeconds,
  fencesAt,
  fenceTransitions,
  fitBounds,
  type Geofence,
  GeofenceSchema,
  haversine,
  inverseMercator,
  type MapPoint,
  mercator,
  nearest,
  PORT_MERIDIAN,
  panBy,
  pointAlong,
  pointInRing,
  project,
  type Ring,
  ringContains,
  ringSelfIntersects,
  routeLength,
  unproject,
  viewBounds,
  zoomAround,
} from '../src/engines/map/index.ts';
import {
  cascade,
  criticalPath,
  cycleMessage,
  type Dependency,
  DependencyListSchema,
  durationDays,
  type ScheduleTask,
  timelineModel,
  topoOrder,
  workDays,
} from '../src/engines/timeline/index.ts';
import {
  buildTree,
  flatten,
  indent,
  isWithin,
  moveNode,
  moveSibling,
  newSibling,
  outdent,
  pathTo,
  validParents,
} from '../src/engines/tree/index.ts';
import { ValidationError } from '../src/engines/validation.ts';

function createRng(seed: string) {
  let state = 2166136261;
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619) >>> 0;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
  return {
    next,
    int(min: number, max: number) {
      return min + Math.floor(next() * (max - min + 1));
    },
    chance(probability: number) {
      return next() < probability;
    },
    pick<T>(values: readonly T[]): T {
      return values[Math.floor(next() * values.length)] as T;
    },
  };
}

function registerBoardTests() {
  interface Card {
    id: string;
    title: string;
    status: string;
    team: string;
    rank: string;
  }

  const COLUMNS: BoardColumnDef[] = [
    { id: 'todo', title: 'To do' },
    { id: 'doing', title: 'Doing', wip: { soft: 2, hard: 3 } },
    { id: 'done', title: 'Done' },
  ];
  const LANES = [
    { id: 'web', title: 'Web' },
    { id: 'mobile', title: 'Mobile' },
  ];

  const OPTIONS: BoardOptions<Card> = {
    columns: COLUMNS,
    lanes: LANES,
    id: (card) => card.id,
    column: (card) => card.status,
    lane: (card) => card.team,
    rank: (card) => card.rank,
    label: (card) => card.title,
  };

  function cards(): Card[] {
    const [r1, r2, r3] = rankSequence(3);
    return [
      { id: 'c1', title: 'Login form', status: 'todo', team: 'web', rank: r1 as string },
      { id: 'c2', title: 'Pricing page', status: 'todo', team: 'web', rank: r2 as string },
      { id: 'c3', title: 'Push alerts', status: 'todo', team: 'mobile', rank: r1 as string },
      { id: 'c4', title: 'Audit log', status: 'doing', team: 'web', rank: r1 as string },
      { id: 'c5', title: 'Offline mode', status: 'doing', team: 'mobile', rank: r1 as string },
      { id: 'c6', title: 'Dark theme', status: 'done', team: 'web', rank: r3 as string },
    ];
  }

  const ids = (items: readonly Card[]) => items.map((card) => card.id);

  describe('rank keys', () => {
    it('starts, appends, prepends and splits in code-unit order, and 5 related cases', () => {
      {
        // starts, appends, prepends and splits in code-unit order
        const first = rankBetween(null, null);
        const next = rankBetween(first, null);
        const before = rankBetween(null, first);
        const middle = rankBetween(first, next);
        expect([next, middle, first, before].sort()).toEqual([before, first, middle, next]);
        for (const key of [first, next, before, middle]) expect(isRank(key)).toBe(true);
      }
      {
        // rejects inverted, equal and invalid neighbors
        const [a, b] = rankSequence(2) as [string, string];
        expect(() => rankBetween(b, a)).toThrow(RankError);
        expect(() => rankBetween(a, a)).toThrow(RankError);
        expect(() => rankBetween('a0', 'not a key!')).toThrow(RankError);
        expect(isRank('a10')).toBe(false); // a fraction may not end in 0
        expect(isRank('')).toBe(false);
        expect(isRank(42)).toBe(false);
      }
      {
        // keeps 10,000 appends unique, ordered and short
        const keys = rankSequence(10_000);
        expect(new Set(keys).size).toBe(10_000);
        expect([...keys].sort()).toEqual(keys);
        expect(Math.max(...keys.map((key) => key.length))).toBeLessThanOrEqual(4);
      }
      {
        // keeps 10,000 prepends unique, ordered and short
        const keys = [rankBetween(null, null)];
        for (let i = 0; i < 9_999; i++) keys.unshift(rankBetween(null, keys[0] as string));
        expect(new Set(keys).size).toBe(10_000);
        expect([...keys].sort()).toEqual(keys);
        expect(Math.max(...keys.map((key) => key.length))).toBeLessThanOrEqual(4);
      }
      {
        // never collides across 10,000 inserts at seeded random positions
        const rng = createRng('board-rank');
        const keys: string[] = [];
        for (let i = 0; i < 10_000; i++) {
          const at = rng.int(0, keys.length);
          keys.splice(at, 0, rankBetween(keys[at - 1] ?? null, keys[at] ?? null));
        }
        expect(new Set(keys).size).toBe(10_000);
        expect([...keys].sort()).toEqual(keys);
        expect(keys.every(isRank)).toBe(true);
      }
      // is deterministic
      expect(rankSequence(50)).toEqual(rankSequence(50));
    });
  });

  describe('groupBoard', () => {
    it('places items into lane × column cells ordered by rank, then id, and 3 related cases', () => {
      {
        // places items into lane × column cells ordered by rank, then id
        const grid = groupBoard(cards(), OPTIONS);
        expect(grid.cells).toHaveLength(2);
        expect(grid.cells[0]?.map((cell) => ids(cell.items))).toEqual([
          ['c1', 'c2'],
          ['c4'],
          ['c6'],
        ]);
        expect(grid.cells[1]?.map((cell) => ids(cell.items))).toEqual([['c3'], ['c5'], []]);
        expect(grid.columnCounts.get('doing')).toBe(2);
        expect(grid.positions.get('c2')).toEqual({ columnIndex: 0, laneIndex: 0, index: 1 });
      }
      {
        // breaks equal ranks by id, so legacy data still sorts the same way
        const tied = cards().map((card) => ({ ...card, rank: 'a0' }));
        const grid = groupBoard(tied.reverse(), OPTIONS);
        expect(ids(grid.cells[0]?.[0]?.items ?? [])).toEqual(['c1', 'c2']);
      }
      {
        // lists items with an unknown column or lane instead of dropping them
        const extra = [
          ...cards(),
          { id: 'c9', title: 'Stray', status: 'archived', team: 'web', rank: 'a0' },
        ];
        const grid = groupBoard(extra, OPTIONS);
        expect(ids(grid.unplaced)).toEqual(['c9']);
        expect(grid.positions.has('c9')).toBe(false);
      }
      {
        // uses one implicit lane when the board has none
        const grid = groupBoard(cards(), { ...OPTIONS, lanes: undefined });
        expect(grid.lanes).toHaveLength(1);
        expect(grid.cells[0]?.map((cell) => cell.items.length)).toEqual([3, 2, 1]);
      }
    });
  });

  describe('evaluateWip', () => {
    const doing = COLUMNS[1] as BoardColumnDef;
    it('is ok below the soft limit and without limits; warns at the soft limit and blocks when full or over', () => {
      // is ok below the soft limit and without limits
      expect(evaluateWip(doing, 1)).toEqual({ status: 'ok', count: 1 });
      expect(evaluateWip(COLUMNS[0] as BoardColumnDef, 500).status).toBe('ok');
      // warns at the soft limit and blocks when full or over
      expect(evaluateWip(doing, 2)).toEqual({
        status: 'warn',
        count: 2,
        limit: 2,
        reason: 'Doing has reached its soft WIP limit (2 of 2).',
      });
      expect(evaluateWip(doing, 3).reason).toBe('Doing has reached its WIP limit (3 of 3).');
      expect(evaluateWip(doing, 4)).toMatchObject({
        status: 'blocked',
        reason: 'Doing is over its WIP limit (4 of 3).',
      });
    });
  });

  describe('validateMove', () => {
    it('ranks the item between its new neighbors, and 6 related cases', async () => {
      // ranks the item between its new neighbors
      await (async () => {
        const grid = groupBoard(cards(), OPTIONS);
        const result = validateMove(grid, 'c6', { columnId: 'todo', laneId: 'web', index: 1 });
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        const [c1, c2] = grid.cells[0]?.[0]?.items ?? [];
        expect(result.move.rank > (c1?.rank ?? '')).toBe(true);
        expect(result.move.rank < (c2?.rank ?? '')).toBe(true);
        expect(result.move).toMatchObject({
          fromColumnId: 'done',
          columnId: 'todo',
          laneId: 'web',
          index: 1,
        });
        expect(result.move.rerank).toBeUndefined();
      })();
      {
        // warns at the soft limit, reports a column it fills, and blocks a full column
        const one = groupBoard(
          cards().map((card) => (card.id === 'c5' ? { ...card, status: 'done' } : card)),
          OPTIONS
        );
        const second = validateMove(one, 'c1', { columnId: 'doing', index: 0 });
        expect(second.ok && second.wip).toMatchObject({ status: 'warn', count: 2 });
        const grid = groupBoard(cards(), OPTIONS);
        const third = validateMove(grid, 'c1', { columnId: 'doing', index: 0 });
        expect(third.ok && third.wip.status).toBe('blocked'); // allowed: 3 of 3 after it, now full
        const full = groupBoard(
          cards().map((card) => (card.id === 'c1' ? { ...card, status: 'doing' } : card)),
          OPTIONS
        );
        expect(validateMove(full, 'c2', { columnId: 'doing', index: 0 })).toEqual({
          ok: false,
          reason: 'Cannot move Pricing page: Doing has reached its WIP limit (3 of 3).',
        });
      }
      {
        // never blocks reordering inside a full column
        const full = groupBoard(
          cards().map((card) => (card.id === 'c1' ? { ...card, status: 'doing' } : card)),
          OPTIONS
        );
        const result = validateMove(full, 'c4', { columnId: 'doing', laneId: 'web', index: 1 });
        expect(result.ok).toBe(true);
      }
      {
        // applies the caller rule, with its reason
        const grid = groupBoard(cards(), OPTIONS);
        const rules = {
          canMove: (_card: Card, to: { columnId: string }) =>
            to.columnId !== 'done' || 'Only owners can close cards.',
        };
        expect(validateMove(grid, 'c1', { columnId: 'done', index: 0 }, rules)).toEqual({
          ok: false,
          reason: 'Only owners can close cards.',
        });
        expect(
          validateMove(grid, 'c1', { columnId: 'done', index: 0 }, { canMove: () => false })
        ).toEqual({
          ok: false,
          reason: 'Login form cannot move to Done.',
        });
      }
      {
        // reports unknown items, columns and lanes
        const grid = groupBoard(cards(), OPTIONS);
        expect(validateMove(grid, 'nope', { columnId: 'todo', index: 0 }).ok).toBe(false);
        expect(validateMove(grid, 'c1', { columnId: 'nope', index: 0 }).ok).toBe(false);
        expect(validateMove(grid, 'c1', { columnId: 'todo', laneId: 'nope', index: 0 }).ok).toBe(
          false
        );
      }
      {
        // marks a drop in place as unchanged and clamps the index
        const grid = groupBoard(cards(), OPTIONS);
        const same = validateMove(grid, 'c2', { columnId: 'todo', index: 1 });
        expect(same.ok && same.unchanged).toBe(true);
        const clamped = validateMove(grid, 'c1', { columnId: 'done', index: 99 });
        expect(clamped.ok && clamped.move.index).toBe(1);
      }
      // re-ranks the whole cell when neighbor ranks cannot be split
      await (async () => {
        const tied = cards().map((card) =>
          card.status === 'todo' ? { ...card, rank: 'a0' } : card
        );
        const grid = groupBoard(tied, OPTIONS);
        const result = validateMove(grid, 'c6', { columnId: 'todo', laneId: 'web', index: 1 });
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.move.rerank?.map((entry) => entry.itemId)).toEqual(['c1', 'c6', 'c2']);
        const ranks = result.move.rerank?.map((entry) => entry.rank) ?? [];
        expect([...ranks].sort()).toEqual(ranks);
        expect(result.move.rank).toBe(ranks[1]);
      })();
    });
  });

  describe('keyboard moves', () => {
    const press = (key: string, shiftKey = false) => ({ key, shiftKey });

    function run(keys: { key: string; shiftKey?: boolean }[], itemId = 'c1') {
      const grid = groupBoard(cards(), OPTIONS);
      let result = pickUp(grid, itemId);
      const log = [result.announcement];
      for (const key of keys) {
        result = moveIntent(grid, result.state, key);
        log.push(result.announcement);
      }
      return { grid, result, log };
    }
    it('picks up with a position announcement, and 6 related cases', () => {
      {
        // picks up with a position announcement
        const { log, result } = run([]);
        expect(result.state.mode).toBe('held');
        expect(log[0]).toBe(
          'Picked up Login form. To do, lane Web, position 1 of 2. Use the arrow keys to move, Space to drop, Escape to cancel.'
        );
      }
      {
        // moves across columns, positions and lanes, then drops with a commit
        const { result, log } = run([
          press('ArrowRight'),
          press('ArrowRight'),
          press('ArrowDown', true),
          press(' '),
        ]);
        expect(log.slice(1, 4)).toEqual([
          'Doing, lane Web, position 1 of 2.',
          'Done, lane Web, position 1 of 2.',
          'Done, lane Mobile, position 1 of 1.',
        ]);
        expect(result.state).toEqual(IDLE);
        expect(result.commit).toMatchObject({
          itemId: 'c1',
          columnId: 'done',
          laneId: 'mobile',
          index: 0,
        });
        expect(log[4]).toBe('Dropped Login form in Done, lane Mobile, position 1 of 1.');
      }
      {
        // moves up and down inside a cell, with Home and End, and announces edges
        const { log } = run([
          press('ArrowDown'),
          press('ArrowDown'),
          press('Home'),
          press('ArrowUp'),
        ]);
        expect(log.slice(1)).toEqual([
          'To do, lane Web, position 2 of 2.',
          'Already at the bottom.',
          'To do, lane Web, position 1 of 2.',
          'Already at the top.',
        ]);
        const end = run([press('ArrowRight'), press('End')]);
        expect(end.log[2]).toBe('Doing, lane Web, position 2 of 2.');
        expect(run([press('ArrowLeft')]).log[1]).toBe('Already at the last column that way.');
        expect(run([press('ArrowUp', true)]).log[1]).toBe('Already at the last lane that way.');
      }
      {
        // cancels with Escape and puts the card back
        const { result, log } = run([press('ArrowRight'), press('Escape')]);
        expect(result.state).toEqual(IDLE);
        expect(result.commit).toBeUndefined();
        expect(log[2]).toBe(
          'Move cancelled. Login form is back in To do, lane Web, position 1 of 2.'
        );
      }
      {
        // keeps holding the card when the drop is rejected, with the reason
        const grid = groupBoard(
          cards().map((card) => (card.id === 'c2' ? { ...card, status: 'doing' } : card)),
          OPTIONS
        );
        let result = pickUp(grid, 'c1');
        result = moveIntent(grid, result.state, press('ArrowRight'));
        expect(result.announcement).toBe(
          'Doing, lane Web, position 1 of 3. Doing has reached its WIP limit (3 of 3). Dropping here is not allowed.'
        );
        result = moveIntent(grid, result.state, press('Enter'));
        expect(result.state.mode).toBe('held');
        expect(result.commit).toBeUndefined();
        expect(result.announcement).toBe(
          'Cannot move Login form: Doing has reached its WIP limit (3 of 3). Still holding Login form.'
        );
      }
      {
        // says when a successful drop fills the column
        const { result } = run([press('ArrowRight'), press('Enter')]);
        expect(result.commit?.columnId).toBe('doing');
        expect(result.announcement).toBe(
          'Dropped Login form in Doing, lane Web, position 1 of 2. Doing has reached its WIP limit (3 of 3).'
        );
      }
      {
        // drops in place without a commit, and ignores other keys and idle states
        const { result } = run([press('Enter')]);
        expect(result.commit).toBeUndefined();
        expect(result.announcement).toBe('Dropped Login form in its original place.');
        const grid = groupBoard(cards(), OPTIONS);
        const held = pickUp(grid, 'c1').state;
        expect(moveIntent(grid, held, press('a'))).toEqual({ state: held, handled: false });
        expect(moveIntent(grid, IDLE as KeyboardMoveState, press('ArrowRight')).handled).toBe(
          false
        );
        expect(pickUp(grid, 'missing').handled).toBe(false);
      }
    });
  });
}

function registerCalendarTests() {
  const NY = 'America/New_York';
  const BERLIN = 'Europe/Berlin';

  const starts = (series: CalendarSeries, start: string, end: string, timeZone?: string) =>
    expandSeries(series, { start, end }, timeZone ? { timeZone } : {}).occurrences.map(
      (o) => o.start
    );

  let nextId = 0;
  const newId = () => `series-${++nextId}`;

  describe('dates and zones', () => {
    it('does civil date arithmetic across months and leap years, and 2 related cases', () => {
      // does civil date arithmetic across months and leap years
      expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
      expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
      expect(daysBetween('2026-12-30', '2027-01-02')).toBe(3);
      expect(() => parseIsoDate('2026-02-30')).toThrow(RangeError);
      {
        // knows DST days are 23 and 25 hours long
        const hours = (date: string, zone: string) => {
          const { start, end } = dayBounds(date, zone);
          return (end - start) / 3_600_000;
        };
        expect(hours('2026-03-08', NY)).toBe(23);
        expect(hours('2026-11-01', NY)).toBe(25);
        expect(hours('2026-03-29', BERLIN)).toBe(23);
        expect(hours('2026-10-25', BERLIN)).toBe(25);
        expect(hours('2026-06-01', NY)).toBe(24);
      }
      {
        // moves a skipped wall time forward and takes the earlier of a repeated one
        const at = (zone: string, month: number, day: number, hour: number, minute: number) =>
          toIso(zonedInstant({ year: 2026, month, day, hour, minute, second: 0 }, zone));
        expect(at(NY, 3, 8, 2, 30)).toBe('2026-03-08T07:30:00.000Z'); // 03:30 EDT
        expect(at(NY, 11, 1, 1, 30)).toBe('2026-11-01T05:30:00.000Z'); // the EDT 01:30
        expect(at(BERLIN, 10, 25, 2, 30)).toBe('2026-10-25T00:30:00.000Z'); // the CEST 02:30
        expect(at(BERLIN, 3, 29, 2, 30)).toBe('2026-03-29T01:30:00.000Z'); // 03:30 CEST
      }
    });
  });

  describe('grids', () => {
    it('reads the week start from the locale; builds a six-week month grid from the week start; computes week dates and the visible range of every view', () => {
      // reads the week start from the locale
      expect(weekStartFor('en-US')).toBe(0);
      expect(weekStartFor('fr-FR')).toBe(1);
      expect(weekStartFor('not a locale')).toBe(1);
      {
        // builds a six-week month grid from the week start
        const grid = monthGrid(2026, 10, { weekStartsOn: 1, today: '2026-10-19' });
        expect(grid).toHaveLength(6);
        expect(grid.every((week) => week.length === 7)).toBe(true);
        expect(grid[0]?.[0]).toEqual({ date: '2026-09-28', inMonth: false, isToday: false });
        expect(grid[0]?.[3]?.date).toBe('2026-10-01');
        expect(grid.flat().filter((cell) => cell.inMonth)).toHaveLength(31);
        expect(grid.flat().find((cell) => cell.isToday)?.date).toBe('2026-10-19');
        expect(monthGrid(2026, 10, { weekStartsOn: 0 })[0]?.[0]?.date).toBe('2026-09-27');
      }
      {
        // computes week dates and the visible range of every view
        expect(weekDates('2026-10-21', 0)).toEqual([
          '2026-10-18',
          '2026-10-19',
          '2026-10-20',
          '2026-10-21',
          '2026-10-22',
          '2026-10-23',
          '2026-10-24',
        ]);
        const options = { weekStartsOn: 1 as const, timeZone: NY };
        expect(visibleRange('month', '2026-10-19', options)).toEqual({
          startDate: '2026-09-28',
          endDate: '2026-11-09',
          start: '2026-09-28T04:00:00.000Z',
          end: '2026-11-09T05:00:00.000Z',
        });
        expect(visibleRange('week', '2026-10-21', options).startDate).toBe('2026-10-19');
        expect(visibleRange('day', '2026-11-01', options)).toMatchObject({
          start: '2026-11-01T04:00:00.000Z',
          end: '2026-11-02T05:00:00.000Z',
        });
        expect(visibleRange('agenda', '2026-10-19', { ...options, agendaDays: 7 }).endDate).toBe(
          '2026-10-26'
        );
        expect(stepAnchor('month', '2026-12-15', 1)).toBe('2027-01-01');
        expect(stepAnchor('week', '2026-10-19', -1)).toBe('2026-10-12');
      }
    });
  });

  describe('recurrence', () => {
    const standup: CalendarSeries = {
      id: 'standup',
      start: '2026-10-05T13:00:00.000Z', // Monday 09:00 New York (EDT)
      end: '2026-10-05T13:15:00.000Z',
      timeZone: NY,
      rule: { freq: 'weekly', byDay: ['MO', 'WE', 'FR'] },
    };
    it('repeats weekly on several days at the same wall time across DST, and 6 related cases', () => {
      {
        // repeats weekly on several days at the same wall time across DST
        const list = starts(standup, '2026-10-30T00:00:00Z', '2026-11-05T00:00:00Z');
        // Fri Oct 30 (EDT), then Mon Nov 2 and Wed Nov 4 after the switch to EST.
        expect(list).toEqual([
          '2026-10-30T13:00:00.000Z',
          '2026-11-02T14:00:00.000Z',
          '2026-11-04T14:00:00.000Z',
        ]);
      }
      {
        // supports intervals, BYMONTHDAY (including negative), ordinals and skips
        const base = {
          id: 'x',
          start: '2026-01-31T10:00:00.000Z',
          end: '2026-01-31T11:00:00.000Z',
        };
        expect(
          starts(
            { ...base, rule: { freq: 'daily', interval: 10, count: 3 } },
            '2026-01-01T00:00:00Z',
            '2027-01-01T00:00:00Z'
          )
        ).toEqual([
          '2026-01-31T10:00:00.000Z',
          '2026-02-10T10:00:00.000Z',
          '2026-02-20T10:00:00.000Z',
        ]);
        // The 31st only exists in some months: RFC 5545 skips the others.
        expect(
          starts(
            { ...base, rule: { freq: 'monthly', count: 3 } },
            '2026-01-01T00:00:00Z',
            '2027-01-01T00:00:00Z'
          )
        ).toEqual([
          '2026-01-31T10:00:00.000Z',
          '2026-03-31T10:00:00.000Z',
          '2026-05-31T10:00:00.000Z',
        ]);
        const lastDay = { ...base, rule: { freq: 'monthly' as const, byMonthDay: [-1], count: 3 } };
        expect(
          starts(lastDay, '2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z').map((s) => s.slice(0, 10))
        ).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
        const secondTuesday = {
          ...base,
          start: '2026-01-13T10:00:00.000Z',
          end: '2026-01-13T11:00:00.000Z',
        };
        expect(
          starts(
            { ...secondTuesday, rule: { freq: 'monthly', byDay: ['2TU'], count: 3 } },
            '2026-01-01T00:00:00Z',
            '2027-01-01T00:00:00Z'
          ).map((s) => s.slice(0, 10))
        ).toEqual(['2026-01-13', '2026-02-10', '2026-03-10']);
        const lastFriday = {
          ...base,
          start: '2026-01-30T10:00:00.000Z',
          end: '2026-01-30T11:00:00.000Z',
        };
        expect(
          starts(
            { ...lastFriday, rule: { freq: 'monthly', byDay: ['-1FR'], count: 2 } },
            '2026-01-01T00:00:00Z',
            '2027-01-01T00:00:00Z'
          ).map((s) => s.slice(0, 10))
        ).toEqual(['2026-01-30', '2026-02-27']);
        const leap = {
          id: 'leap',
          start: '2028-02-29T12:00:00.000Z',
          end: '2028-02-29T13:00:00.000Z',
          rule: { freq: 'yearly' as const, count: 2 },
        };
        expect(
          starts(leap, '2028-01-01T00:00:00Z', '2040-01-01T00:00:00Z').map((s) => s.slice(0, 10))
        ).toEqual(['2028-02-29', '2032-02-29']);
      }
      {
        // counts EXDATEs toward COUNT and treats UNTIL as inclusive
        const daily: CalendarSeries = {
          id: 'd',
          start: '2026-10-01T09:00:00.000Z',
          end: '2026-10-01T10:00:00.000Z',
          rule: { freq: 'daily', count: 3 },
          exdates: ['2026-10-02T09:00:00.000Z'],
        };
        expect(starts(daily, '2026-09-01T00:00:00Z', '2026-12-01T00:00:00Z')).toEqual([
          '2026-10-01T09:00:00.000Z',
          '2026-10-03T09:00:00.000Z',
        ]);
        const until = {
          ...daily,
          exdates: [],
          rule: { freq: 'daily' as const, until: '2026-10-04T09:00:00Z' },
        };
        expect(starts(until, '2026-09-01T00:00:00Z', '2026-12-01T00:00:00Z')).toHaveLength(4);
      }
      {
        // applies overrides, including moves into and out of the window
        const series: CalendarSeries<{ title: string }> = {
          ...standup,
          data: { title: 'Standup' },
          overrides: {
            // Wed Oct 7 moved to Thu Oct 15 (into the window below)
            '2026-10-07T13:00:00.000Z': {
              start: '2026-10-15T13:00:00.000Z',
              end: '2026-10-15T13:15:00.000Z',
            },
            // Mon Oct 12 moved out of the window to Oct 30, with its own title
            '2026-10-12T13:00:00.000Z': {
              start: '2026-10-30T15:00:00.000Z',
              end: '2026-10-30T15:15:00.000Z',
              data: { title: 'Moved standup' },
            },
          },
        };
        const { occurrences } = expandSeries(series, {
          start: '2026-10-12T00:00:00Z',
          end: '2026-10-17T00:00:00Z',
        });
        expect(
          occurrences.map((o) => [o.occurrenceId.slice(0, 10), o.start.slice(0, 10), o.overridden])
        ).toEqual([
          ['2026-10-14', '2026-10-14', false],
          ['2026-10-07', '2026-10-15', true],
          ['2026-10-16', '2026-10-16', false],
        ]);
        const later = expandSeries(series, {
          start: '2026-10-30T14:00:00Z',
          end: '2026-10-30T16:00:00Z',
        }).occurrences;
        expect(later.map((o) => o.data?.title)).toEqual(['Moved standup']);
      }
      {
        // caps an expansion at 1,000 occurrences and reports truncation
        const minutely: CalendarSeries = {
          id: 'm',
          start: '2026-01-01T00:00:00.000Z',
          end: '2026-01-01T00:30:00.000Z',
          rule: { freq: 'daily' },
        };
        const huge = expandSeries(
          minutely,
          { start: '2026-01-01T00:00:00Z', end: '2036-01-01T00:00:00Z' },
          { max: 5000 }
        );
        expect(huge.occurrences).toHaveLength(MAX_OCCURRENCES);
        expect(huge.truncated).toBe(true);
        const few = expandSeries(
          minutely,
          { start: '2026-01-01T00:00:00Z', end: '2027-01-01T00:00:00Z' },
          { max: 10 }
        );
        expect(few.occurrences).toHaveLength(10);
        // A window years later skips ahead instead of generating from the start.
        const far = expandSeries(minutely, {
          start: '2035-06-01T00:00:00Z',
          end: '2035-06-03T00:00:00Z',
        });
        expect(far.occurrences.map((o) => o.start)).toEqual([
          '2035-06-01T00:00:00.000Z',
          '2035-06-02T00:00:00.000Z',
        ]);
      }
      {
        // orders occurrences of many series stably and expands all-day series by date
        const allDay: CalendarSeries = {
          id: 'b-holiday',
          start: '2026-10-19',
          end: '2026-10-20',
          allDay: true,
          rule: { freq: 'weekly', count: 2 },
        };
        const timed: CalendarSeries = {
          id: 'a-call',
          start: '2026-10-19T04:00:00.000Z',
          end: '2026-10-19T05:00:00.000Z',
        };
        const result = expandAll(
          [allDay, timed],
          { start: '2026-10-19T00:00:00Z', end: '2026-10-27T00:00:00Z' },
          { timeZone: 'UTC' }
        );
        expect(result.occurrences.map((o) => `${o.seriesId}:${o.start}`)).toEqual([
          'b-holiday:2026-10-19',
          'a-call:2026-10-19T04:00:00.000Z',
          'b-holiday:2026-10-26',
        ]);
        expect(result.occurrences[0]).toMatchObject({
          allDay: true,
          end: '2026-10-20',
          recurring: true,
        });
      }
      {
        // parses and formats RRULE strings, and validates rules
        const rule = parseRRule('RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;UNTIL=20261231T235959Z');
        expect(rule).toEqual({
          freq: 'weekly',
          interval: 2,
          byDay: ['MO', 'WE'],
          until: '2026-12-31T23:59:59Z',
        });
        expect(formatRRule(rule)).toBe('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;UNTIL=20261231T235959Z');
        expect(parseRRule('FREQ=MONTHLY;BYMONTHDAY=-1;COUNT=4')).toEqual({
          freq: 'monthly',
          byMonthDay: [-1],
          count: 4,
        });
        expect(() => parseRRule('FREQ=HOURLY')).toThrow();
        expect(RecurrenceRuleSchema.safeParse({ freq: 'daily', interval: 0 }).success).toBe(false);
        expect(RecurrenceRuleSchema.safeParse({ freq: 'monthly', byDay: ['6MO'] }).success).toBe(
          false
        );
      }
    });
  });

  describe('splitSeries', () => {
    const weekly: CalendarSeries<{ title: string }> = {
      id: 'review',
      start: '2026-10-05T14:00:00.000Z',
      end: '2026-10-05T15:00:00.000Z',
      rule: { freq: 'weekly' },
      exdates: ['2026-10-19T14:00:00.000Z'],
      overrides: {
        '2026-10-26T14:00:00.000Z': {
          start: '2026-10-26T16:00:00.000Z',
          end: '2026-10-26T17:00:00.000Z',
        },
      },
      data: { title: 'Review' },
    };
    const third = '2026-10-19T14:00:00.000Z';
    const second = '2026-10-12T14:00:00.000Z';
    it('"this" stores an override, or an EXDATE for a delete, and 5 related cases', () => {
      {
        // "this" stores an override, or an EXDATE for a delete
        const moved = splitSeries(
          weekly,
          second,
          'this',
          { start: '2026-10-13T14:00:00.000Z', end: '2026-10-13T15:00:00.000Z' },
          { newId }
        );
        expect(moved.put[0]?.overrides?.[second]).toEqual({
          start: '2026-10-13T14:00:00.000Z',
          end: '2026-10-13T15:00:00.000Z',
        });
        const deleted = splitSeries(weekly, second, 'this', { delete: true }, { newId });
        expect(deleted.put[0]?.exdates).toEqual([second, third]);
      }
      {
        // "all" moves the series and re-keys its exceptions
        const result = splitSeries(
          weekly,
          second,
          'all',
          { start: '2026-10-12T15:00:00.000Z' },
          { newId }
        );
        const series = result.put[0];
        expect(series).toMatchObject({
          start: '2026-10-05T15:00:00.000Z',
          end: '2026-10-05T16:00:00.000Z',
        });
        expect(series?.exdates).toEqual(['2026-10-19T15:00:00.000Z']);
        expect(Object.keys(series?.overrides ?? {})).toEqual(['2026-10-26T15:00:00.000Z']);
        expect(splitSeries(weekly, second, 'all', { delete: true }, { newId })).toEqual({
          put: [],
          delete: ['review'],
        });
      }
      {
        // "following" ends the series before the occurrence and starts a new one
        const result = splitSeries(
          weekly,
          second,
          'following',
          { data: { title: 'Design review' } },
          { newId: () => 'review-2' }
        );
        const [head, tail] = result.put;
        expect(head?.rule).toEqual({ freq: 'weekly', until: '2026-10-12T13:59:59.000Z' });
        expect(head?.exdates).toBeUndefined();
        expect(tail).toMatchObject({
          id: 'review-2',
          start: second,
          data: { title: 'Design review' },
        });
        expect(tail?.exdates).toEqual([third]);
        // Together they produce the same dates as before.
        const window = { start: '2026-10-01T00:00:00Z', end: '2026-11-03T00:00:00Z' };
        const before = expandSeries(weekly, window).occurrences.map((o) => o.start);
        const after = expandAll(result.put, window).occurrences.map((o) => o.start);
        expect(after).toEqual(before);
      }
      {
        // "following" splits COUNT between the two series
        const counted = {
          ...weekly,
          exdates: [],
          overrides: {},
          rule: { freq: 'weekly' as const, count: 5 },
        };
        expect(occurrenceIndex(counted, third)).toBe(2);
        const [head, tail] = splitSeries(
          counted,
          third,
          'following',
          { start: '2026-10-19T16:00:00.000Z' },
          { newId }
        ).put;
        expect(head?.rule?.count).toBe(2);
        expect(tail?.rule?.count).toBe(3);
        expect(tail?.start).toBe('2026-10-19T16:00:00.000Z');
      }
      {
        // treats "following" on the first occurrence as "all", and deletes the tail
        const first = splitSeries(
          weekly,
          weekly.start,
          'following',
          { start: '2026-10-05T15:00:00.000Z' },
          { newId }
        );
        expect(first.put).toHaveLength(1);
        expect(first.put[0]?.id).toBe('review');
        const cut = splitSeries(
          weekly,
          '2026-10-26T14:00:00.000Z',
          'following',
          { delete: true },
          { newId }
        );
        expect(cut.put).toHaveLength(1);
        expect(cut.put[0]?.rule?.until).toBe('2026-10-26T13:59:59.000Z');
      }
      {
        // edits single events directly and rejects unknown occurrences
        const single: CalendarSeries = {
          id: 'one',
          start: '2026-10-05T14:00:00.000Z',
          end: '2026-10-05T15:00:00.000Z',
        };
        expect(
          splitSeries(single, single.start, 'this', { end: '2026-10-05T16:00:00.000Z' }, { newId })
            .put[0]?.end
        ).toBe('2026-10-05T16:00:00.000Z');
        expect(() =>
          splitSeries(weekly, '2026-10-13T14:00:00.000Z', 'this', {}, { newId })
        ).toThrow(RangeError);
        expect(() => splitSeries(weekly, third, 'this', {}, { newId })).toThrow(RangeError); // excluded
      }
    });
  });

  describe('layoutDay', () => {
    const event = (id: string, start: string, end: string) => ({ id, start, end });
    it('puts overlapping events side by side and keeps separate groups full width, and 3 related cases', () => {
      {
        // puts overlapping events side by side and keeps separate groups full width
        const items = layoutDay(
          [
            event('a', '2026-10-19T09:00:00Z', '2026-10-19T10:00:00Z'),
            event('b', '2026-10-19T09:30:00Z', '2026-10-19T11:00:00Z'),
            event('c', '2026-10-19T10:00:00Z', '2026-10-19T10:30:00Z'),
            event('d', '2026-10-19T13:00:00Z', '2026-10-19T14:00:00Z'),
          ],
          { date: '2026-10-19', timeZone: 'UTC' }
        );
        expect(
          items.map((i) => [i.event.id, i.column, i.columnCount, i.startMinute, i.endMinute])
        ).toEqual([
          ['a', 0, 2, 540, 600],
          ['b', 1, 2, 570, 660],
          ['c', 0, 2, 600, 630],
          ['d', 0, 1, 780, 840],
        ]);
      }
      {
        // places events by wall time on a spring-forward day (23 hours)
        const items = layoutDay(
          [
            event('night', '2026-03-08T06:30:00Z', '2026-03-08T07:30:00Z'), // 01:30 EST → 03:30 EDT
            event('morning', '2026-03-08T13:00:00Z', '2026-03-08T14:00:00Z'), // 09:00 → 10:00 EDT
          ],
          { date: '2026-03-08', timeZone: NY }
        );
        expect(items.map((i) => [i.event.id, i.startMinute, i.endMinute])).toEqual([
          ['night', 90, 210],
          ['morning', 540, 600],
        ]);
      }
      {
        // keeps folded events visible on a fall-back day (25 hours)
        const items = layoutDay(
          [
            event('first', '2026-11-01T05:30:00Z', '2026-11-01T05:50:00Z'), // 01:30–01:50 EDT
            event('second', '2026-11-01T06:10:00Z', '2026-11-01T06:40:00Z'), // 01:10–01:40 EST
            event('late', '2026-11-02T03:00:00Z', '2026-11-02T06:00:00Z'), // 22:00 EST → past midnight
          ],
          { date: '2026-11-01', timeZone: NY }
        );
        const byId = Object.fromEntries(items.map((i) => [i.event.id, i]));
        // Both 01:xx events are drawn in the same wall-clock hour, so they get two columns.
        expect([byId.second?.column, byId.first?.column].sort()).toEqual([0, 1]);
        expect(byId.first?.columnCount).toBe(2);
        expect(byId.late).toMatchObject({
          startMinute: 1320,
          endMinute: 1440,
          continuesAfter: true,
        });
      }
      {
        // clips multi-day events, skips all-day ones and keeps a minimum height
        const items = layoutDay(
          [
            event('trip', '2026-10-18T20:00:00Z', '2026-10-19T08:00:00Z'),
            { ...event('holiday', '2026-10-19T00:00:00Z', '2026-10-20T00:00:00Z'), allDay: true },
            event('ping', '2026-10-19T12:00:00Z', '2026-10-19T12:00:00Z'),
            event('other-day', '2026-10-20T12:00:00Z', '2026-10-20T13:00:00Z'),
          ],
          { date: '2026-10-19', timeZone: 'UTC' }
        );
        expect(items.map((i) => i.event.id)).toEqual(['trip', 'ping']);
        expect(items[0]).toMatchObject({
          startMinute: 0,
          endMinute: 480,
          continuesBefore: true,
          continuesAfter: false,
        });
        expect(items[1]).toMatchObject({ startMinute: 720, endMinute: 735 });
      }
    });
  });
}

function registerTimelineTests() {
  const MON = '2026-10-19';
  const task = (id: string, start: string, end: string, milestone = false): ScheduleTask => ({
    id,
    start,
    end,
    milestone,
  });

  describe('working days', () => {
    it('counts Monday to Friday, skips weekends and holidays; round-trips every working day through its ordinal, for other work weeks too', () => {
      {
        // counts Monday to Friday, skips weekends and holidays
        const wd = workDays({ holidays: ['2026-10-21'] });
        expect(wd.isWorkday('2026-10-24')).toBe(false); // Saturday
        expect(wd.isWorkday('2026-10-21')).toBe(false); // holiday
        expect(wd.count(MON, '2026-10-25')).toBe(4);
        expect(wd.next('2026-10-24')).toBe('2026-10-26');
        expect(durationDays(task('t', MON, '2026-10-23'))).toBe(5);
        expect(durationDays(task('m', MON, MON, true))).toBe(0);
      }
      // round-trips every working day through its ordinal, for other work weeks too
      for (const calendar of [
        {},
        { workdays: [0, 1, 2, 3, 4] },
        { holidays: ['2026-12-25', '2027-01-01'] },
      ]) {
        const wd = workDays(calendar);
        let day = '2026-01-01';
        for (let i = 0; i < 730; i++, day = addDays(day, 1)) {
          if (wd.isWorkday(day)) expect(wd.fromOrdinal(wd.ordinal(day)), day).toBe(day);
        }
      }
      expect(workDays({ workdays: [0, 1, 2, 3, 4] }).isWorkday('2026-10-25')).toBe(true); // Sunday
      expect(() => workDays({ workdays: [] })).toThrow(RangeError);
    });
  });

  describe('dependency graph', () => {
    const deps: Dependency[] = [
      { from: 'a', to: 'b', type: 'FS' },
      { from: 'b', to: 'c', type: 'FS' },
      { from: 'a', to: 'c', type: 'SS' },
    ];
    it('orders predecessors first and names a cycle readably; rejects self-links and cycles as zod errors, for services to use', () => {
      {
        // orders predecessors first and names a cycle readably
        expect(topoOrder(['c', 'b', 'a'], deps)).toEqual({ ok: true, order: ['a', 'b', 'c'] });
        const cyclic = [...deps, { from: 'c', to: 'a', type: 'FS' as const }];
        const result = topoOrder(['a', 'b', 'c'], cyclic);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.cycle[0]).toBe(result.cycle[result.cycle.length - 1]);
          expect(result.cycle.length).toBeGreaterThanOrEqual(3);
        }
        expect(cycleMessage(['a', 'b', 'c'], cyclic)).toMatch(
          /^Dependencies form a cycle: [abc]( → [abc])+$/
        );
        expect(cycleMessage(['a', 'b', 'c'], deps)).toBeNull();
      }
      {
        // rejects self-links and cycles as zod errors, for services to use
        expect(DependencyListSchema.safeParse(deps).success).toBe(true);
        const self = DependencyListSchema.safeParse([{ from: 'a', to: 'a', type: 'FS' }]);
        expect(self.success === false && self.error.issues[0]?.message).toBe(
          'A task cannot depend on itself'
        );
        const loop = DependencyListSchema.safeParse([
          { from: 'a', to: 'b', type: 'FS' },
          { from: 'b', to: 'a', type: 'SS' },
        ]);
        expect(loop.success === false && loop.error.issues[0]?.message).toMatch(
          /cycle: (a → b → a|b → a → b)/
        );
        expect(DependencyListSchema.safeParse([{ from: 'a', to: 'b', type: 'XX' }]).success).toBe(
          false
        );
      }
    });
  });

  describe('timeline display model', () => {
    it('keeps stable group and task order, separates undated work and reports capped rows; filters milestones without changing the unscheduled collection', () => {
      {
        // keeps stable group and task order, separates undated work and reports capped rows
        const rows = [
          { id: 'b1', start: MON, end: MON, group: 'B' },
          { id: 'undated', group: 'A' },
          { id: 'a1', start: MON, end: MON, group: 'A' },
          { id: 'b2', start: MON, end: MON, group: 'B' },
          { id: 'a2', start: MON, end: MON, group: 'A' },
        ];
        const model = timelineModel(rows, {
          getGroup: (row) => ({ id: row.group ?? 'unknown', label: row.group ?? 'Unknown' }),
          maxRows: 3,
        });
        expect(model.unscheduled.map((row) => row.id)).toEqual(['undated']);
        expect(model.visible.map((row) => row.id)).toEqual(['b1', 'b2', 'a1']);
        expect(model).toMatchObject({ totalScheduled: 4, truncatedCount: 1 });
      }
      {
        // filters milestones without changing the unscheduled collection
        const model = timelineModel(
          [
            { id: 'task', start: MON, end: MON },
            { id: 'milestone', start: MON, end: MON, milestone: true },
            { id: 'later' },
          ],
          { milestonesOnly: true }
        );
        expect(model.visible.map((row) => row.id)).toEqual(['milestone']);
        expect(model.unscheduled.map((row) => row.id)).toEqual(['later']);
      }
    });
  });

  describe('cascade: each dependency type', () => {
    // Predecessor P: Mon–Wed (3 days). Successor S: 2 days, starting early on Mon.
    const P = task('p', MON, '2026-10-21');
    const S = task('s', MON, '2026-10-20');
    const run = (type: Dependency['type'], lagDays = 0) =>
      cascade([P, S], [{ from: 'p', to: 's', type, lagDays }], { id: 'p', start: MON });
    it('FS: starts after the predecessor finishes (plus lag, minus lead), and 3 related cases', () => {
      // FS: starts after the predecessor finishes (plus lag, minus lead)
      expect(run('FS').changes).toEqual([{ id: 's', start: '2026-10-22', end: '2026-10-23' }]);
      expect(run('FS', 2).changes).toEqual([{ id: 's', start: '2026-10-26', end: '2026-10-27' }]);
      expect(run('FS', -1).changes).toEqual([{ id: 's', start: '2026-10-21', end: '2026-10-22' }]);
      // SS: starts once the predecessor starts
      expect(run('SS').changes).toEqual([]); // already allowed
      expect(run('SS', 1).changes).toEqual([{ id: 's', start: '2026-10-20', end: '2026-10-21' }]);
      // FF: finishes once the predecessor finishes
      expect(run('FF').changes).toEqual([{ id: 's', start: '2026-10-20', end: '2026-10-21' }]);
      // SF: finishes once the predecessor starts (plus lag)
      expect(run('SF').changes).toEqual([]);
      // Finishes are exclusive slots: done by the end of Wednesday, three days after Monday.
      expect(run('SF', 3).changes).toEqual([{ id: 's', start: '2026-10-20', end: '2026-10-21' }]);
    });
  });

  describe('cascade', () => {
    const tasks = [
      task('design', MON, '2026-10-21'), // Mon–Wed
      task('build', '2026-10-22', '2026-10-27'), // Thu–Tue
      task('docs', '2026-11-02', '2026-11-03'), // plenty of slack
      task('launch', '2026-10-28', '2026-10-28', true),
    ];
    const deps: Dependency[] = [
      { from: 'design', to: 'build', type: 'FS' },
      { from: 'build', to: 'launch', type: 'FS' },
      { from: 'design', to: 'docs', type: 'FS' },
    ];
    it('pushes the chain and returns only the rows that changed, and 2 related cases', () => {
      {
        // pushes the chain and returns only the rows that changed
        const result = cascade(tasks, deps, { id: 'design', start: '2026-10-21' });
        expect(result.changes).toEqual([
          { id: 'design', start: '2026-10-21', end: '2026-10-23' },
          { id: 'build', start: '2026-10-26', end: '2026-10-29' },
          { id: 'launch', start: '2026-10-30', end: '2026-10-30' },
        ]);
        // docs had slack, so it stays.
        expect(result.changes.some((c) => c.id === 'docs')).toBe(false);
        expect(result.violations).toEqual([]);
      }
      {
        // never pulls successors earlier, and reports links a moved task breaks
        const earlier = cascade(tasks, deps, { id: 'design', start: '2026-10-12' });
        expect(earlier.changes).toEqual([{ id: 'design', start: '2026-10-12', end: '2026-10-14' }]);
        const tooEarly = cascade(tasks, deps, { id: 'build', start: MON });
        expect(tooEarly.violations).toEqual([deps[0]]);
      }
      {
        // changes durations, skips holidays and keeps milestones at zero length
        const longer = cascade(tasks, deps, { id: 'design', start: MON, end: '2026-10-22' });
        expect(longer.changes[0]).toEqual({ id: 'design', start: MON, end: '2026-10-22' });
        expect(longer.changes[1]).toEqual({ id: 'build', start: '2026-10-23', end: '2026-10-28' });
        // Durations count the calendar's working days; a pushed task skips holidays.
        const pair = [task('design', MON, '2026-10-21'), task('qa', '2026-10-22', '2026-10-23')];
        const link: Dependency[] = [{ from: 'design', to: 'qa', type: 'FS' }];
        const change = { id: 'design', start: MON, end: '2026-10-22' };
        expect(cascade(pair, link, change).changes[1]).toEqual({
          id: 'qa',
          start: '2026-10-23',
          end: '2026-10-26',
        });
        expect(cascade(pair, link, change, { holidays: ['2026-10-26'] }).changes[1]).toEqual({
          id: 'qa',
          start: '2026-10-23',
          end: '2026-10-27',
        });
        expect(longer.changes.find((c) => c.id === 'launch')).toEqual({
          id: 'launch',
          start: '2026-10-29',
          end: '2026-10-29',
        });
        expect(() => cascade(tasks, deps, { id: 'design', start: '2026-10-21', end: MON })).toThrow(
          RangeError
        );
        expect(() => cascade(tasks, deps, { id: 'nope', start: MON })).toThrow(RangeError);
        expect(() =>
          cascade(tasks, [...deps, { from: 'launch', to: 'design', type: 'FS' }], {
            id: 'design',
            start: MON,
          })
        ).toThrow(/cycle/);
      }
    });
  });

  describe('critical path', () => {
    it('finds the zero-slack chain and the slack of the rest', () => {
      // a (3d) → b (2d) → d (1d);  a → c (5d) → d.
      const tasks = [
        task('a', MON, '2026-10-21'),
        task('b', '2026-10-22', '2026-10-23'),
        task('c', '2026-10-22', '2026-10-28'),
        task('d', '2026-10-29', '2026-10-29'),
      ];
      const deps: Dependency[] = [
        { from: 'a', to: 'b', type: 'FS' },
        { from: 'a', to: 'c', type: 'FS' },
        { from: 'b', to: 'd', type: 'FS' },
        { from: 'c', to: 'd', type: 'FS' },
      ];
      const result = criticalPath(tasks, deps);
      expect(result.critical).toEqual(['a', 'c', 'd']);
      expect(result.tasks.get('b')).toMatchObject({
        slackDays: 3,
        critical: false,
        lateStart: '2026-10-27',
        lateFinish: '2026-10-28',
      });
      expect(result.tasks.get('c')).toMatchObject({
        slackDays: 0,
        earlyStart: '2026-10-22',
        earlyFinish: '2026-10-28',
      });
      expect(result.finish).toBe('2026-10-29');
    });
  });
}

function registerGridTests() {
  interface Deal {
    id: string;
    name: string;
    stage: string;
    amountCents: number | null;
    closesOn: string | null;
    won: boolean;
  }

  const COLUMNS: GridColumnDef<Deal>[] = [
    { key: 'name', header: 'Name', type: 'text', width: 240 },
    { key: 'stage', header: 'Stage', type: 'enum', options: ['lead', 'proposal', 'won', 'lost'] },
    {
      key: 'amount',
      header: 'Amount',
      type: 'number',
      accessor: (d) => d.amountCents,
      minWidth: 80,
      maxWidth: 300,
    },
    { key: 'closesOn', header: 'Closes on', type: 'date' },
    { key: 'won', header: 'Won', type: 'boolean' },
  ];

  const DEALS: Deal[] = [
    {
      id: 'd1',
      name: 'Northwind renewal',
      stage: 'proposal',
      amountCents: 120_000,
      closesOn: '2026-11-01',
      won: false,
    },
    {
      id: 'd2',
      name: 'acme expansion',
      stage: 'won',
      amountCents: 450_000,
      closesOn: '2026-10-05',
      won: true,
    },
    {
      id: 'd3',
      name: 'Globex pilot',
      stage: 'lead',
      amountCents: null,
      closesOn: null,
      won: false,
    },
    {
      id: 'd4',
      name: 'Initech seats',
      stage: 'proposal',
      amountCents: 80_000,
      closesOn: '2026-12-15',
      won: false,
    },
    {
      id: 'd5',
      name: 'Acme add-on',
      stage: 'won',
      amountCents: 60_000,
      closesOn: '2026-10-20',
      won: true,
    },
  ];

  const ids = (rows: readonly Deal[]) => rows.map((row) => row.id);

  describe('virtualization', () => {
    it('computes offsets with sparse measured sizes; windows 100,000 rows to the viewport plus overscan; windows columns between pinned ones', () => {
      {
        // computes offsets with sparse measured sizes
        const axis = createAxis({
          count: 100_000,
          size: 36,
          sizes: new Map([
            [2, 72],
            [10, 20],
          ]),
        });
        expect(axis.total).toBe(100_000 * 36 + 36 - 16);
        expect(axis.offsetOf(2)).toBe(72);
        expect(axis.offsetOf(3)).toBe(144);
        expect(axis.offsetOf(11)).toBe(11 * 36 + 36 - 16);
        expect(axis.indexAt(143)).toBe(2);
        expect(axis.indexAt(144)).toBe(3);
        expect(axis.indexAt(-5)).toBe(0);
        expect(axis.indexAt(1e12)).toBe(99_999);
      }
      {
        // windows 100,000 rows to the viewport plus overscan
        const rows = createAxis({ count: 100_000, size: 36 });
        const window = windowAxis(rows, 36 * 50_000, 720, 3);
        expect(window.start).toBe(49_997);
        expect(window.end).toBe(50_023);
        expect(window.items).toHaveLength(26);
        expect(window.items[3]).toEqual({ index: 50_000, start: 1_800_000, size: 36 });
        expect(windowAxis(rows, 0, 0).items).toEqual([]);
        expect(windowAxis(createAxis({ count: 0, size: 36 }), 0, 500).items).toEqual([]);
      }
      {
        // windows columns between pinned ones
        const grid = windowGrid({
          rows: createAxis({ count: 1000, size: 40 }),
          columns: createAxis({ count: 50, size: 150 }),
          scrollTop: 400,
          scrollLeft: 1500,
          viewportHeight: 400,
          viewportWidth: 1000,
          pinnedLeftWidth: 200,
          pinnedRightWidth: 100,
        });
        expect(grid.centerWidth).toBe(700);
        expect(grid.columns.start).toBe(9);
        expect(grid.columns.end).toBe(16);
        expect(grid.rows.start).toBe(7);
        expect(grid.totalWidth).toBe(200 + 50 * 150 + 100);
        expect(grid.totalHeight).toBe(40_000);
      }
    });
  });

  describe('column state', () => {
    it('orders, pins, hides and resizes columns, as plain data; adds new columns at the end and ignores stale entries', () => {
      {
        // orders, pins, hides and resizes columns, as plain data
        let state = defaultColumnState(COLUMNS);
        state = moveColumn(state, 'won', 0);
        state = pinColumn(state, 'name', 'left');
        state = setColumnHidden(state, 'closesOn', true);
        state = resizeColumn(state, COLUMNS, 'amount', 999);
        const resolved = resolveColumns(COLUMNS, state);
        expect(resolved.left.map((c) => c.def.key)).toEqual(['name']);
        expect(resolved.center.map((c) => [c.def.key, c.width])).toEqual([
          ['won', 160],
          ['stage', 160],
          ['amount', 300],
        ]);
        expect(resolved.hidden.map((c) => c.key)).toEqual(['closesOn']);
        expect(JSON.parse(JSON.stringify(state))).toEqual(state);
        const unpinned = resolveColumns(
          COLUMNS,
          pinColumn(setColumnHidden(state, 'closesOn', false), 'name', null)
        );
        expect(unpinned.left).toEqual([]);
        expect(unpinned.center.map((c) => c.def.key)).toEqual([
          'won',
          'name',
          'stage',
          'amount',
          'closesOn',
        ]);
      }
      {
        // adds new columns at the end and ignores stale entries
        const resolved = resolveColumns(COLUMNS, [{ key: 'gone', width: 90 }, { key: 'stage' }]);
        expect(resolved.center.map((c) => c.def.key)).toEqual([
          'stage',
          'name',
          'amount',
          'closesOn',
          'won',
        ]);
      }
    });
  });

  describe('sorting', () => {
    it('sorts by several keys, keeps empty values last and is stable; sorts text with a fixed locale, ignoring case', () => {
      {
        // sorts by several keys, keeps empty values last and is stable
        const byStage = sortRows(
          DEALS,
          [
            { key: 'stage', direction: 'asc' },
            { key: 'amount', direction: 'desc' },
          ],
          COLUMNS
        );
        expect(ids(byStage)).toEqual(['d3', 'd1', 'd4', 'd2', 'd5']);
        const byAmountAsc = sortRows(DEALS, [{ key: 'amount', direction: 'asc' }], COLUMNS);
        const byAmountDesc = sortRows(DEALS, [{ key: 'amount', direction: 'desc' }], COLUMNS);
        expect(ids(byAmountAsc).at(-1)).toBe('d3');
        expect(ids(byAmountDesc).at(-1)).toBe('d3');
        expect(ids(sortRows(DEALS, [{ key: 'closesOn', direction: 'asc' }], COLUMNS))).toEqual([
          'd2',
          'd5',
          'd1',
          'd4',
          'd3',
        ]);
      }
      {
        // sorts text with a fixed locale, ignoring case
        const byName = sortRows(DEALS, [{ key: 'name', direction: 'asc' }], COLUMNS);
        expect(ids(byName)).toEqual(['d5', 'd2', 'd3', 'd4', 'd1']);
        expect(sortRows(DEALS, [{ key: 'unknown', direction: 'asc' }], COLUMNS)).toEqual(DEALS);
      }
    });
  });

  describe('filters', () => {
    const run = (ast: FilterNode) => ids(DEALS.filter(compileFilter(ast, COLUMNS)));
    it('applies every operator, and 2 related cases', () => {
      // applies every operator
      expect(run({ type: 'condition', field: 'stage', operator: 'eq', value: 'won' })).toEqual([
        'd2',
        'd5',
      ]);
      expect(run({ type: 'condition', field: 'stage', operator: 'neq', value: 'won' })).toEqual([
        'd1',
        'd3',
        'd4',
      ]);
      expect(
        run({ type: 'condition', field: 'name', operator: 'contains', value: 'ACME' })
      ).toEqual(['d2', 'd5']);
      expect(
        run({ type: 'condition', field: 'name', operator: 'eq', value: 'globex PILOT' })
      ).toEqual(['d3']);
      expect(
        run({ type: 'condition', field: 'stage', operator: 'in', value: ['lead', 'lost'] })
      ).toEqual(['d3']);
      expect(
        run({ type: 'condition', field: 'amount', operator: 'between', value: [60_000, 120_000] })
      ).toEqual(['d1', 'd4', 'd5']);
      expect(
        run({ type: 'condition', field: 'closesOn', operator: 'before', value: '2026-10-21' })
      ).toEqual(['d2', 'd5']);
      expect(
        run({ type: 'condition', field: 'closesOn', operator: 'after', value: '2026-11-01' })
      ).toEqual(['d4']);
      expect(run({ type: 'condition', field: 'amount', operator: 'isEmpty' })).toEqual(['d3']);
      expect(run({ type: 'condition', field: 'closesOn', operator: 'isNotEmpty' })).toEqual([
        'd1',
        'd2',
        'd4',
        'd5',
      ]);
      expect(run({ type: 'condition', field: 'won', operator: 'eq', value: true })).toEqual([
        'd2',
        'd5',
      ]);
      {
        // combines and/or groups, and an empty group matches everything
        const ast: FilterNode = {
          type: 'group',
          op: 'or',
          children: [
            { type: 'condition', field: 'stage', operator: 'eq', value: 'lead' },
            {
              type: 'group',
              op: 'and',
              children: [
                { type: 'condition', field: 'stage', operator: 'eq', value: 'won' },
                {
                  type: 'condition',
                  field: 'amount',
                  operator: 'between',
                  value: [100_000, 500_000],
                },
              ],
            },
          ],
        };
        expect(run(ast)).toEqual(['d2', 'd3']);
        expect(run({ type: 'group', op: 'and', children: [] })).toHaveLength(5);
      }
      {
        // rejects unknown fields, unfit operators, bad values and oversized trees as zod errors
        const fails = (ast: unknown) => {
          try {
            compileFilter(ast, COLUMNS);
            return null;
          } catch (error) {
            expect(error).toBeInstanceOf(ValidationError);
            return (error as ValidationError).issues[0]?.message;
          }
        };
        expect(fails({ type: 'condition', field: 'owner', operator: 'eq', value: 'x' })).toBe(
          'unknown field "owner"'
        );
        expect(
          fails({ type: 'condition', field: 'amount', operator: 'contains', value: '1' })
        ).toBe('contains does not apply to Amount (number)');
        expect(fails({ type: 'condition', field: 'amount', operator: 'eq', value: 'ten' })).toBe(
          'Amount compares numbers'
        );
        expect(fails({ type: 'condition', field: 'stage', operator: 'eq', value: 'closed' })).toBe(
          'closed is not an option of Stage'
        );
        expect(
          fails({ type: 'condition', field: 'stage', operator: 'regex', value: '.*' })
        ).toBeTruthy();
        expect(fails({ type: 'condition', field: 'amount', operator: 'between', value: [1] })).toBe(
          'between needs [low, high]'
        );
        expect(fails({ type: 'condition', field: 'amount', operator: 'isEmpty', value: 3 })).toBe(
          'isEmpty takes no value'
        );
        let deep: FilterNode = { type: 'condition', field: 'won', operator: 'isEmpty' };
        for (let i = 0; i < FILTER_LIMITS.depth; i++)
          deep = { type: 'group', op: 'and', children: [deep] };
        expect(fails(deep)).toContain('limited to');
        expect(
          fails({ type: 'condition', field: 'name', operator: 'eq', value: 'x', extra: 'y' })
        ).toBeTruthy();
      }
    });
  });

  describe('grouping', () => {
    it('groups by one column with count, sum, min and max, empty group last; flattens groups for the virtualizer, honoring collapsed ids', () => {
      {
        // groups by one column with count, sum, min and max, empty group last
        const groups = groupRows(DEALS, {
          by: 'stage',
          columns: COLUMNS,
          aggregates: [
            { key: 'id', fn: 'count' },
            { key: 'amount', fn: 'sum' },
            { key: 'amount', fn: 'min' },
            { key: 'closesOn', fn: 'max' },
          ],
        });
        expect(groups.map((g) => [g.id, ids(g.rows)])).toEqual([
          ['lead', ['d3']],
          ['proposal', ['d1', 'd4']],
          ['won', ['d2', 'd5']],
        ]);
        expect(groups[1]?.aggregates).toEqual({
          'count:id': 2,
          'sum:amount': 200_000,
          'min:amount': 80_000,
          'max:closesOn': Date.parse('2026-12-15'),
        });
        expect(groups[0]?.aggregates).toMatchObject({ 'sum:amount': 0, 'min:amount': null });
        const byDate = groupRows(DEALS, { by: 'closesOn', columns: COLUMNS });
        expect(byDate.at(-1)).toMatchObject({ id: '∅', value: null });
        expect(() => groupRows(DEALS, { by: 'nope', columns: COLUMNS })).toThrow(RangeError);
      }
      {
        // flattens groups for the virtualizer, honoring collapsed ids
        const groups = groupRows(DEALS, { by: 'stage', columns: COLUMNS });
        const display = flattenGroups(groups, new Set(['proposal']));
        expect(
          display.map((d) =>
            d.kind === 'group' ? `#${d.group.id}${d.collapsed ? '-' : ''}` : d.row.id
          )
        ).toEqual(['#lead', 'd3', '#proposal-', '#won', 'd2', 'd5']);
      }
    });
  });

  describe('saved views', () => {
    const view: SavedView = {
      id: 'v1',
      name: 'Open pipeline',
      columns: [
        { key: 'name', pinned: 'left' },
        { key: 'amount', width: 120 },
      ],
      sort: [{ key: 'amount', direction: 'desc' }],
      groupBy: 'stage',
      filter: { type: 'condition', field: 'stage', operator: 'neq', value: 'lost' },
      density: 'compact',
    };
    it('validates strictly and round-trips through JSON, and 3 related cases', () => {
      // validates strictly and round-trips through JSON
      expect(SavedViewSchema.parse(JSON.parse(JSON.stringify(view)))).toEqual(view);
      expect(SavedViewSchema.safeParse({ ...view, name: '' }).success).toBe(false);
      expect(SavedViewSchema.safeParse({ ...view, density: 'tiny' }).success).toBe(false);
      expect(SavedViewSchema.safeParse({ ...view, script: 'alert(1)' }).success).toBe(false);
      {
        // applies filter, sort and grouping
        const result = applyView(DEALS, view, COLUMNS);
        expect(ids(result.rows)).toEqual(['d2', 'd1', 'd4', 'd5', 'd3']);
        expect(result.groups?.map((g) => g.id)).toEqual(['lead', 'proposal', 'won']);
      }
      {
        // sanitizes a stored view against the current columns
        const stored = {
          ...view,
          columns: [{ key: 'name' }, { key: 'region' }],
          sort: [
            { key: 'region', direction: 'asc' },
            { key: 'amount', direction: 'desc' },
          ],
          groupBy: 'region',
          filter: {
            type: 'group',
            op: 'and',
            children: [
              { type: 'condition', field: 'region', operator: 'eq', value: 'emea' },
              { type: 'condition', field: 'won', operator: 'eq', value: true },
            ],
          },
        };
        const { view: clean, dropped } = sanitizeView(stored, COLUMNS);
        expect(clean.columns).toEqual([{ key: 'name' }]);
        expect(clean.sort).toEqual([{ key: 'amount', direction: 'desc' }]);
        expect(clean.groupBy).toBeNull();
        expect(clean.filter).toEqual({
          type: 'group',
          op: 'and',
          children: [{ type: 'condition', field: 'won', operator: 'eq', value: true }],
        });
        expect(dropped).toEqual([
          'filter on region',
          'column region',
          'sort on region',
          'grouping by region',
        ]);
        expect(() => sanitizeView({ nope: true }, COLUMNS)).toThrow(ValidationError);
      }
      {
        // refuses a filter nested thousands of levels deep without overflowing the stack
        let deep: unknown = { type: 'condition', field: 'won', operator: 'isEmpty' };
        for (let i = 0; i < 5000; i++) deep = { type: 'group', op: 'and', children: [deep] };
        expect(exceedsFilterLimits(deep)).toBe(true);
        const parsed = FilterNodeSchema.safeParse(deep);
        expect(parsed.success).toBe(false);
        expect(parsed.success ? '' : parsed.error.issues[0]?.message).toContain('limited to');
        expect(SavedViewSchema.safeParse({ ...view, filter: deep }).success).toBe(false);
        // The documented ValidationError, never a RangeError.
        expect(() => sanitizeView({ ...view, filter: deep }, COLUMNS)).toThrow(ValidationError);

        const wide = {
          type: 'group',
          op: 'or',
          children: Array.from({ length: FILTER_LIMITS.nodes }, () => ({
            type: 'condition',
            field: 'won',
            operator: 'isEmpty',
          })),
        };
        expect(exceedsFilterLimits(wide)).toBe(true);
        expect(FilterNodeSchema.safeParse(wide).success).toBe(false);
        expect(exceedsFilterLimits(view.filter)).toBe(false);
        expect(FilterNodeSchema.safeParse(view.filter).success).toBe(true);
      }
    });
  });

  describe('filter composition', () => {
    const stageIn = (...values: string[]): FilterNode => ({
      type: 'condition',
      field: 'stage',
      operator: 'in',
      value: values,
    });
    const wonEq: FilterNode = { type: 'condition', field: 'won', operator: 'eq', value: true };
    const nameHas: FilterNode = {
      type: 'condition',
      field: 'name',
      operator: 'contains',
      value: 'acme',
    };
    it('serializes equal filters to the same text whatever the build order, and 8 related cases', () => {
      {
        // serializes equal filters to the same text whatever the build order
        const a: FilterNode = {
          type: 'group',
          op: 'and',
          children: [
            stageIn('won', 'lead', 'won'),
            { type: 'group', op: 'and', children: [wonEq] },
          ],
        };
        const b: FilterNode = {
          type: 'group',
          op: 'and',
          children: [wonEq, { type: 'group', op: 'or', children: [] }, stageIn('lead', 'won')],
        };
        expect(serializeFilter(a)).toBe(serializeFilter(b));
        expect(serializeFilter(a)).toBe(
          '{"type":"group","op":"and","children":[{"type":"condition","field":"stage","operator":"in","value":["lead","won"]},{"type":"condition","field":"won","operator":"eq","value":true}]}'
        );
        expect(filtersEqual(a, b)).toBe(true);
        expect(filtersEqual(a, { ...b, op: 'or' } as FilterNode)).toBe(false);
        expect(serializeFilter(null)).toBe('');
        expect(serializeFilter({ type: 'group', op: 'and', children: [] })).toBe('');
      }
      {
        // normalizes without changing which rows match
        const messy: FilterNode = {
          type: 'group',
          op: 'or',
          children: [
            { type: 'group', op: 'or', children: [stageIn('won', 'won'), nameHas] },
            {
              type: 'group',
              op: 'and',
              children: [stageIn('lead'), { type: 'group', op: 'and', children: [] }],
            },
            { type: 'group', op: 'and', children: [wonEq, wonEq] },
          ],
        };
        const normal = normalizeFilter(messy) as FilterNode;
        expect(ids(DEALS.filter(compileFilter(normal, COLUMNS)))).toEqual(
          ids(DEALS.filter(compileFilter(messy, COLUMNS)))
        );
        // Same-op group merged, duplicates gone, single-child groups unwrapped: 4 distinct children.
        expect((normal as { children: FilterNode[] }).children).toHaveLength(4);
        expect(normalizeFilter(normal)).toEqual(normal);
      }
      {
        // treats an empty group as matching every row, like compileFilter does
        const empty: FilterNode = { type: 'group', op: 'and', children: [] };
        const orWithEmpty: FilterNode = { type: 'group', op: 'or', children: [wonEq, empty] };
        expect(DEALS.filter(compileFilter(orWithEmpty, COLUMNS))).toHaveLength(DEALS.length);
        expect(normalizeFilter(orWithEmpty)).toBeNull();
        expect(tidyFilter(orWithEmpty)).toBeNull();
        expect(normalizeFilter({ type: 'group', op: 'and', children: [wonEq, empty] })).toEqual(
          wonEq
        );
        expect(tidyFilter({ type: 'group', op: 'and', children: [wonEq, empty] })).toEqual(wonEq);
      }
      {
        // orders scalars deterministically across types
        const value = (
          normalizeFilter({
            type: 'condition',
            field: 'stage',
            operator: 'in',
            value: ['b', 10, null, true, 2, 'a', 'b'],
          }) as { value: unknown[] }
        ).value;
        expect(value).toEqual([null, true, 2, 10, 'a', 'b']);
      }
      {
        // tidies structure but keeps the author order
        const tree: FilterNode = {
          type: 'group',
          op: 'and',
          children: [wonEq, { type: 'group', op: 'or', children: [nameHas] }, stageIn('lead')],
        };
        expect(tidyFilter(tree)).toEqual({
          type: 'group',
          op: 'and',
          children: [wonEq, nameHas, stageIn('lead')],
        });
        expect(tidyFilter({ type: 'group', op: 'and', children: [] })).toBeNull();
      }
      {
        // round-trips through serialized text, validated as untrusted input
        const filter: FilterNode = {
          type: 'group',
          op: 'and',
          children: [stageIn('won'), nameHas],
        };
        const text = serializeFilter(filter);
        expect(parseSerializedFilter(text, COLUMNS)).toEqual(normalizeFilter(filter));
        expect(parseSerializedFilter('')).toBeNull();
        expect(() => parseSerializedFilter('{oops')).toThrow(/not valid JSON/);
        expect(() =>
          parseSerializedFilter(
            '{"type":"condition","field":"ghost","operator":"eq","value":1}',
            COLUMNS
          )
        ).toThrow(/unknown field "ghost"/);
        expect(() => parseSerializedFilter(' '.repeat(SERIALIZED_FILTER_MAX_BYTES + 1))).toThrow(
          /limited to/
        );
        let deep = '{"type":"condition","field":"name","operator":"isEmpty"}';
        for (let i = 0; i < 50; i++) deep = `{"type":"group","op":"and","children":[${deep}]}`;
        expect(() => parseSerializedFilter(deep)).toThrow(/levels/);
      }
      {
        // composes facets: OR within a field, AND across fields
        let filter: FilterNode | null = null;
        filter = toggleFacetValue(filter, 'stage', 'won');
        expect(filter).toEqual({ type: 'condition', field: 'stage', operator: 'eq', value: 'won' });
        filter = toggleFacetValue(filter, 'stage', 'lead');
        filter = toggleFacetValue(filter, 'won', false);
        expect(filter).toEqual({
          type: 'group',
          op: 'and',
          children: [
            stageIn('lead', 'won'),
            { type: 'condition', field: 'won', operator: 'eq', value: false },
          ],
        });
        // stage ∈ {lead, won} AND won = false → d3 (lead) only.
        expect(ids(DEALS.filter(compileFilter(filter, COLUMNS)))).toEqual(['d3']);
        expect(facetsFromFilter(filter).facets).toEqual({ stage: ['lead', 'won'], won: [false] });
        filter = toggleFacetValue(filter, 'stage', 'lead');
        filter = toggleFacetValue(filter, 'stage', 'won');
        expect(filter).toEqual({ type: 'condition', field: 'won', operator: 'eq', value: false });
        expect(toggleFacetValue(filter, 'won', false)).toBeNull();
      }
      {
        // keeps conditions that are not facets when facets change
        const start: FilterNode = { type: 'group', op: 'and', children: [nameHas, stageIn('won')] };
        const { facets, rest } = facetsFromFilter(start);
        expect(facets).toEqual({ stage: ['won'] });
        expect(rest).toEqual([nameHas]);
        expect(setFacet(start, 'stage', ['lead', 'proposal'])).toEqual({
          type: 'group',
          op: 'and',
          children: [stageIn('lead', 'proposal'), nameHas],
        });
        expect(setFacet(start, 'stage', [])).toEqual(nameHas);
        // An OR root is not a facet: the facet is AND-ed with it.
        const either: FilterNode = { type: 'group', op: 'or', children: [nameHas, wonEq] };
        expect(setFacet(either, 'stage', ['won'])).toEqual({
          type: 'group',
          op: 'and',
          children: [{ type: 'condition', field: 'stage', operator: 'eq', value: 'won' }, either],
        });
        expect(filterFromFacets({ stage: [], won: [] })).toBeNull();
      }
      {
        // describes a filter as chips and removes one by path
        const filter: FilterNode = {
          type: 'group',
          op: 'and',
          children: [
            stageIn('lead', 'proposal', 'won'),
            { type: 'condition', field: 'amount', operator: 'between', value: [100, 500] },
            { type: 'condition', field: 'closesOn', operator: 'isEmpty' },
            { type: 'group', op: 'or', children: [nameHas, wonEq] },
          ],
        };
        const chips = describeFilter(filter, COLUMNS, {
          formatValue: (field, value) =>
            field === 'stage' ? String(value).toUpperCase() : String(value),
        });
        expect(chips.map((chip) => chip.text)).toEqual([
          'Stage is any of LEAD, PROPOSAL or WON',
          'Amount is between 100 and 500',
          'Closes on is empty',
          'Any of 2 conditions',
        ]);
        expect(chips.map((chip) => chip.id)).toEqual(['0', '1', '2', '3']);
        expect(describeFilter(wonEq, COLUMNS)[0]).toMatchObject({ id: '', text: 'Won is Yes' });
        expect(describeFilter(null, COLUMNS)).toEqual([]);
        expect(FILTER_OPERATOR_LABELS.neq).toBe('is not');

        const withoutAmount = removeFilterAt(filter, chips[1]?.path ?? []);
        expect(describeFilter(withoutAmount, COLUMNS).map((chip) => chip.label)).toEqual([
          'Stage',
          'Closes on',
          'Any of',
        ]);
        expect(removeFilterAt(filter, [3, 0])).toMatchObject({
          children: [
            stageIn('lead', 'proposal', 'won'),
            expect.anything(),
            expect.anything(),
            wonEq,
          ],
        });
        expect(removeFilterAt(wonEq, [])).toBeNull();
        // Emptying a nested group removes the group, so an OR never widens to every row.
        const either: FilterNode = {
          type: 'group',
          op: 'or',
          children: [nameHas, { type: 'group', op: 'and', children: [wonEq] }],
        };
        expect(removeFilterAt(either, [1, 0])).toEqual(nameHas);
        expect(
          removeFilterAt({ type: 'group', op: 'and', children: [wonEq, nameHas] }, [0])
        ).toEqual(nameHas);
      }
    });
  });

  describe('saved view state', () => {
    const base: ViewState = {
      columns: [{ key: 'name' }, { key: 'stage', width: 120 }],
      sort: [{ key: 'name', direction: 'asc' }],
      groupBy: null,
      filter: null,
      density: 'comfortable',
    };
    it('detects modifications but ignores equivalent filters and default keys, and 2 related cases', () => {
      {
        // detects modifications but ignores equivalent filters and default keys
        expect(viewStatesEqual(base, structuredClone(base))).toBe(true);
        expect(
          viewStatesEqual(base, {
            ...base,
            columns: [{ key: 'name', hidden: false } as never, { key: 'stage', width: 120 }],
          })
        ).toBe(true);
        const a: FilterNode = {
          type: 'condition',
          field: 'stage',
          operator: 'in',
          value: ['won', 'lead'],
        };
        const b: FilterNode = {
          type: 'condition',
          field: 'stage',
          operator: 'in',
          value: ['lead', 'won'],
        };
        expect(isViewModified({ ...base, filter: a }, { ...base, filter: b })).toBe(false);
        expect(isViewModified(base, { ...base, density: 'compact' })).toBe(true);
        expect(isViewModified(base, { ...base, groupBy: 'stage' })).toBe(true);
        expect(isViewModified(base, { ...base, sort: [] })).toBe(true);
        expect(
          isViewModified(base, { ...base, columns: setColumnHidden(base.columns, 'stage', true) })
        ).toBe(true);
      }
      // derives deterministic, unique view ids from names
      expect(nextViewId('My open deals', [])).toBe('my-open-deals');
      expect(nextViewId('My open deals', ['my-open-deals', 'my-open-deals-2'])).toBe(
        'my-open-deals-3'
      );
      expect(nextViewId('Café Q3 — top!', [])).toBe('cafe-q3-top');
      expect(nextViewId('***', [])).toBe('view');
      expect(nextViewId('x'.repeat(100), []).length).toBeLessThanOrEqual(48);
      expect(
        SavedViewSchema.safeParse({
          id: nextViewId('A long name '.repeat(9), []),
          name: 'Saved view',
          columns: [],
          sort: [],
          groupBy: null,
          filter: null,
          density: 'compact',
        }).success
      ).toBe(true);
      {
        // shows every column for the chooser while keeping order and widths
        const state = setColumnHidden(
          [{ key: 'stage', width: 120 }, { key: 'ghost' }],
          'stage',
          true
        );
        expect(showAllColumns(state, COLUMNS)).toEqual([
          { key: 'stage', width: 120 },
          { key: 'name' },
          { key: 'amount' },
          { key: 'closesOn' },
          { key: 'won' },
        ]);
        expect(showAllColumns([], COLUMNS)).toEqual(defaultColumnState(COLUMNS));
      }
    });
  });

  describe('row selection', () => {
    const order = ['d1', 'd2', 'd3', 'd4', 'd5'];
    it('toggles rows and keeps them in row order; selects a range from the anchor in either direction; selects and clears the visible rows, keeping hidden selections', () => {
      {
        // toggles rows and keeps them in row order
        let selection = toggleRow([], 'd4', order);
        selection = toggleRow(selection, 'd1', order);
        expect(selection).toEqual(['d1', 'd4']);
        expect(toggleRow(selection, 'd4', order)).toEqual(['d1']);
      }
      // selects a range from the anchor in either direction
      expect(selectRange(['d1'], order, 'd2', 'd4')).toEqual(['d1', 'd2', 'd3', 'd4']);
      expect(selectRange([], order, 'd5', 'd3')).toEqual(['d3', 'd4', 'd5']);
      expect(selectRange([], order, null, 'd3')).toEqual(['d3']);
      expect(selectRange([], order, 'gone', 'd3')).toEqual(['d3']);
      {
        // selects and clears the visible rows, keeping hidden selections
        const visible = ['d2', 'd3'];
        expect(setVisibleSelected(['d5'], visible, true)).toEqual(['d2', 'd3', 'd5']);
        expect(setVisibleSelected(['d2', 'd3', 'd5'], visible, false)).toEqual(['d5']);
        expect(selectionState(['d5'], visible)).toBe('none');
        expect(selectionState(['d2'], visible)).toBe('some');
        expect(selectionState(['d3', 'd2'], visible)).toBe('all');
        expect(selectionState(['d1'], [])).toBe('none');
        expect(pruneSelection(['d1', 'd9', 'd3'], order)).toEqual(['d1', 'd3']);
      }
    });
  });
}

function registerTreeTests() {
  interface Node {
    id: string;
    parentId: string | null;
    rank: string;
    title: string;
  }

  const ACCESSORS = {
    id: (n: Node) => n.id,
    parentId: (n: Node) => n.parentId,
    rank: (n: Node) => n.rank,
  };
  const [a, b, c] = rankSequence(3) as [string, string, string];

  // docs
  //   intro
  //   guides
  //     setup
  //     deploy
  // changelog
  const NODES: Node[] = [
    { id: 'docs', parentId: null, rank: a, title: 'Docs' },
    { id: 'changelog', parentId: null, rank: b, title: 'Changelog' },
    { id: 'intro', parentId: 'docs', rank: a, title: 'Intro' },
    { id: 'guides', parentId: 'docs', rank: b, title: 'Guides' },
    { id: 'setup', parentId: 'guides', rank: a, title: 'Setup' },
    { id: 'deploy', parentId: 'guides', rank: b, title: 'Deploy' },
  ];
  const tree = () => buildTree(NODES, ACCESSORS);
  const ids = (nodes: { id: string }[]) => nodes.map((n) => n.id);

  describe('buildTree and flatten', () => {
    it('orders siblings by rank and flattens open nodes depth first with ARIA facts, and 2 related cases', () => {
      {
        // orders siblings by rank and flattens open nodes depth first with ARIA facts
        const all = flatten(tree(), { expanded: 'all' });
        expect(ids(all)).toEqual(['docs', 'intro', 'guides', 'setup', 'deploy', 'changelog']);
        expect(all.find((n) => n.id === 'setup')).toMatchObject({
          level: 3,
          position: 1,
          siblings: 2,
          hasChildren: false,
        });
        expect(all.find((n) => n.id === 'guides')).toMatchObject({
          level: 2,
          position: 2,
          siblings: 2,
          hasChildren: true,
          expanded: true,
        });
        const closed = flatten(tree(), { expanded: new Set(['docs']) });
        expect(ids(closed)).toEqual(['docs', 'intro', 'guides', 'changelog']);
        expect(closed.find((n) => n.id === 'guides')?.expanded).toBe(false);
      }
      {
        // treats lazy nodes as parents and keeps orphans and cycles visible as roots
        const lazy = flatten(tree(), {
          expanded: new Set(),
          hasChildren: (n) => n.id === 'changelog',
        });
        expect(lazy.find((n) => n.id === 'changelog')?.hasChildren).toBe(true);
        const odd = buildTree(
          [
            ...NODES,
            { id: 'orphan', parentId: 'missing', rank: c, title: 'Orphan' },
            { id: 'loop-a', parentId: 'loop-b', rank: a, title: 'A' },
            { id: 'loop-b', parentId: 'loop-a', rank: b, title: 'B' },
          ],
          ACCESSORS
        );
        const roots = flatten(odd, { expanded: new Set() }).map((n) => n.id);
        expect(roots).toContain('orphan');
        expect(roots.filter((id) => id.startsWith('loop'))).toHaveLength(2);
      }
      // answers ancestry questions
      expect(isWithin(tree(), 'docs', 'deploy')).toBe(true);
      expect(isWithin(tree(), 'guides', 'intro')).toBe(false);
      expect(pathTo(tree(), 'deploy')).toEqual(['docs', 'guides']);
    });
  });

  describe('moves', () => {
    it('moves a node under a new parent with a rank between its new siblings, and 4 related cases', async () => {
      // moves a node under a new parent with a rank between its new siblings
      await (async () => {
        const result = moveNode(tree(), 'changelog', { parentId: 'guides', index: 1 });
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.move.parentId).toBe('guides');
        expect(result.move.rank > a && result.move.rank < b).toBe(true);
        expect(result.unchanged).toBe(false);
      })();
      // rejects moving a node into itself or its own descendants
      expect(moveNode(tree(), 'docs', { parentId: 'docs', index: 0 })).toEqual({
        ok: false,
        reason: 'A node cannot move inside itself.',
      });
      expect(moveNode(tree(), 'docs', { parentId: 'setup', index: 0 }).ok).toBe(false);
      expect(moveNode(tree(), 'guides', { parentId: 'deploy', index: 0 }).ok).toBe(false);
      expect(moveNode(tree(), 'nope', { parentId: null, index: 0 }).ok).toBe(false);
      expect(moveNode(tree(), 'intro', { parentId: 'nope', index: 0 }).ok).toBe(false);
      {
        // re-ranks siblings whose stored ranks cannot be split
        const legacy = buildTree(
          NODES.map((n) => (n.parentId === 'guides' ? { ...n, rank: 'a0' } : n)),
          ACCESSORS
        );
        const result = moveNode(legacy, 'intro', { parentId: 'guides', index: 1 });
        expect(result.ok && result.move.rerank?.map((r) => r.id)).toEqual([
          'deploy',
          'intro',
          'setup',
        ]);
      }
      {
        // indents, outdents and moves among siblings like an outline
        const indented = indent(tree(), 'guides');
        expect(indented.ok && indented.move).toMatchObject({ id: 'guides', parentId: 'intro' });
        expect(indent(tree(), 'intro')).toEqual({
          ok: false,
          reason: 'There is no item above to indent under.',
        });
        const outdented = outdent(tree(), 'setup');
        expect(outdented.ok && outdented.move.parentId).toBe('docs');
        // Right after its old parent: between guides (b) and nothing.
        expect(outdented.ok && outdented.move.rank > b).toBe(true);
        expect(outdent(tree(), 'docs').ok).toBe(false);
        const down = moveSibling(tree(), 'setup', 1);
        expect(down.ok && down.move.rank > b).toBe(true);
        expect(moveSibling(tree(), 'deploy', 1)).toEqual({
          ok: false,
          reason: 'Already the last item.',
        });
        expect(moveSibling(tree(), 'docs', -1)).toEqual({
          ok: false,
          reason: 'Already the first item.',
        });
      }
      {
        // places new siblings right after a node, and lists valid parents
        const next = newSibling(tree(), 'setup');
        expect(next.parentId).toBe('guides');
        expect(next.rank > a && next.rank < b).toBe(true);
        expect(newSibling(tree(), null).parentId).toBeNull();
        expect(newSibling(tree(), null).rank > b).toBe(true);
        expect(validParents(tree(), 'guides').map((p) => p.id)).toEqual([
          null,
          'docs',
          'intro',
          'changelog',
        ]);
      }
    });
  });
}

function registerMapTests() {
  const SIZE = { width: 800, height: 600 };
  const close = (a: number, b: number, digits = 6) => expect(a).toBeCloseTo(b, digits);

  describe('projection', () => {
    it('round-trips points through Mercator and the screen; fits a box with padding and reports what a view shows; zooms around a fixed screen point and pans by pixels', () => {
      {
        // round-trips points through Mercator and the screen
        for (const point of [
          { lng: -18.6, lat: -30.4 },
          { lng: 0, lat: 0 },
          { lng: 179.9, lat: 84 },
        ]) {
          const m = mercator(point);
          const back = inverseMercator(m.x, m.y);
          close(back.lng, point.lng, 9);
          close(back.lat, point.lat, 9);
        }
        const view = { center: { lng: -18.6, lat: -30.9 }, zoom: 9.5 };
        const at = project({ lng: -18.2, lat: -31.1 }, view, SIZE);
        const back = unproject(at.x, at.y, view, SIZE);
        close(back.lng, -18.2);
        close(back.lat, -31.1);
        expect(project(view.center, view, SIZE)).toEqual({ x: 400, y: 300 });
      }
      {
        // fits a box with padding and reports what a view shows
        const view = fitBounds(PORT_MERIDIAN.bbox, SIZE, 24);
        const [minLng, minLat, maxLng, maxLat] = PORT_MERIDIAN.bbox;
        const tl = project({ lng: minLng, lat: maxLat }, view, SIZE);
        const br = project({ lng: maxLng, lat: minLat }, view, SIZE);
        expect(tl.x).toBeGreaterThanOrEqual(23.9);
        expect(br.x).toBeLessThanOrEqual(776.1);
        expect(tl.y).toBeGreaterThanOrEqual(23.9);
        expect(br.y).toBeLessThanOrEqual(576.1);
        // The tighter axis touches the padding.
        expect(Math.min(tl.x - 24, tl.y - 24)).toBeCloseTo(0, 3);
        const bounds = viewBounds(view, SIZE);
        expect(bounds[0]).toBeLessThanOrEqual(minLng);
        expect(bounds[3]).toBeGreaterThanOrEqual(maxLat);
      }
      {
        // zooms around a fixed screen point and pans by pixels
        const view = { center: { lng: -18.6, lat: -30.9 }, zoom: 8 };
        const anchor = { x: 650, y: 120 };
        const under = unproject(anchor.x, anchor.y, view, SIZE);
        const zoomed = zoomAround(view, 1.5, SIZE, anchor);
        expect(zoomed.zoom).toBe(9.5);
        const still = project(under, zoomed, SIZE);
        close(still.x, anchor.x, 6);
        close(still.y, anchor.y, 6);
        expect(zoomAround(view, 99, SIZE).zoom).toBe(22);
        const moved = panBy(view, 100, -50, SIZE);
        const p = project(view.center, moved, SIZE);
        close(p.x, 500, 6);
        close(p.y, 250, 6);
      }
    });
  });

  describe('distances and routes', () => {
    it('measures great-circle distance; computes route length, ETA and positions along a route; finds the nearest points, ties broken by id', () => {
      // measures great-circle distance
      expect(haversine({ lng: 0, lat: 0 }, { lng: 0, lat: 1 })).toBeCloseTo(111_195, -1);
      expect(haversine({ lng: -18.6, lat: -30.4 }, { lng: -18.6, lat: -30.4 })).toBe(0);
      {
        // computes route length, ETA and positions along a route
        const route = [
          { lng: 0, lat: 0 },
          { lng: 0, lat: 1 },
          { lng: 1, lat: 1 },
        ];
        const total = routeLength(route);
        expect(total).toBeCloseTo(
          haversine({ lng: 0, lat: 0 }, { lng: 0, lat: 1 }) +
            haversine({ lng: 0, lat: 1 }, { lng: 1, lat: 1 }),
          6
        );
        expect(etaSeconds(60_000, 60)).toBe(3600);
        expect(() => etaSeconds(1, 0)).toThrow(RangeError);
        const half = pointAlong(route, 111_195 / 2);
        close(half.lng, 0);
        close(half.lat, 0.5, 4);
        expect(pointAlong(route, -5)).toEqual({ lng: 0, lat: 0 });
        expect(pointAlong(route, 1e9)).toEqual({ lng: 1, lat: 1 });
      }
      {
        // finds the nearest points, ties broken by id
        const points = [
          { id: 'b', lng: 0, lat: 0.01 },
          { id: 'a', lng: 0, lat: -0.01 },
          { id: 'c', lng: 0, lat: 0.5 },
        ];
        expect(nearest(points, { lng: 0, lat: 0 }, 2).map((n) => n.point.id)).toEqual(['a', 'b']);
        expect(nearest(points, { lng: 0, lat: 0.49 })[0]?.point.id).toBe('c');
      }
    });
  });

  describe('clustering', () => {
    const rng = createRng('map-points');
    const points: MapPoint[] = Array.from({ length: 5000 }, (_, i) => ({
      id: `p${String(i).padStart(4, '0')}`,
      lng: -20 + rng.next() * 3,
      lat: -32 + rng.next() * 2,
    }));
    it('is deterministic for any input order; keeps single points as points and splits clusters as the zoom grows', () => {
      {
        // is deterministic for any input order
        const shuffled = [...points].sort(() => 0).reverse();
        expect(cluster(shuffled, 9, 64)).toEqual(cluster(points, 9, 64));
      }
      {
        // keeps single points as points and splits clusters as the zoom grows
        const far = cluster(points, 6, 64);
        const near = cluster(points, 12, 64);
        expect(far.length).toBeLessThan(near.length);
        expect(far.every((item) => item.kind === 'cluster')).toBe(true);
        const total = (items: ReturnType<typeof cluster<MapPoint>>) =>
          items.reduce((sum, item) => sum + (item.kind === 'cluster' ? item.count : 1), 0);
        expect(total(far)).toBe(5000);
        expect(total(near)).toBe(5000);
        const first = far[0];
        expect(first?.kind === 'cluster' && first.id).toMatch(/^cluster:6:\d+:\d+$/);
        if (first?.kind === 'cluster') {
          expect(first.ids).toEqual([...first.ids].sort());
          expect(first.bbox[0]).toBeLessThanOrEqual(first.center.lng);
        }
        const lone = cluster([{ id: 'x', lng: -18.6, lat: -30.4 }], 9);
        expect(lone).toEqual([{ kind: 'point', point: { id: 'x', lng: -18.6, lat: -30.4 } }]);
      }
    });
  });

  describe('geofences', () => {
    const square: Ring = [
      [-19, -31],
      [-18, -31],
      [-18, -30],
      [-19, -30],
    ];
    it('tests points in polygons, on edges and in circles, and 3 related cases', () => {
      {
        // tests points in polygons, on edges and in circles
        expect(pointInRing({ lng: -18.5, lat: -30.5 }, square)).toBe(true);
        expect(pointInRing({ lng: -17.5, lat: -30.5 }, square)).toBe(false);
        expect(pointInRing({ lng: -18, lat: -30.5 }, square)).toBe(true); // on the edge
        const circle: Geofence = {
          id: 'dock',
          name: 'Dock',
          shape: 'circle',
          center: [-18.6, -30.4],
          radiusMeters: 500,
        };
        expect(fencesAt({ lng: -18.6, lat: -30.403 }, [circle])).toEqual(['dock']);
        expect(fencesAt({ lng: -18.6, lat: -30.41 }, [circle])).toEqual([]);
      }
      {
        // checks containment and self-intersection
        const inner: Ring = [
          [-18.8, -30.8],
          [-18.2, -30.8],
          [-18.5, -30.2],
        ];
        expect(ringContains(square, inner)).toBe(true);
        expect(ringContains(inner, square)).toBe(false);
        const concave: Ring = [
          [-19, -31],
          [-18, -31],
          [-18, -30],
          [-18.5, -30.6],
          [-19, -30],
        ];
        const spanning: Ring = [
          [-18.9, -30.2],
          [-18.1, -30.2],
          [-18.5, -30.9],
        ];
        expect(ringContains(concave, spanning)).toBe(false); // vertices inside, an edge leaves
        const bowtie: Ring = [
          [-19, -31],
          [-18, -30],
          [-18, -31],
          [-19, -30],
        ];
        expect(ringSelfIntersects(bowtie)).toBe(true);
        expect(ringSelfIntersects(square)).toBe(false);
      }
      {
        // emits enter and exit events for a moving point
        const fences: Geofence[] = [
          { id: 'pier', name: 'Pier zone', shape: 'polygon', ring: square },
          { id: 'dock', name: 'Dock', shape: 'circle', center: [-18.2, -30.5], radiusMeters: 5000 },
        ];
        const track = [
          { at: '2026-10-19T08:00:00Z', lng: -19.5, lat: -30.5 },
          { at: '2026-10-19T08:05:00Z', lng: -18.5, lat: -30.5 },
          { at: '2026-10-19T08:10:00Z', lng: -18.2, lat: -30.5 },
          { at: '2026-10-19T08:15:00Z', lng: -17.5, lat: -30.5 },
        ];
        expect(fenceTransitions(track, fences)).toEqual([
          { fenceId: 'pier', type: 'enter', at: '2026-10-19T08:05:00Z', index: 1 },
          { fenceId: 'dock', type: 'enter', at: '2026-10-19T08:10:00Z', index: 2 },
          { fenceId: 'pier', type: 'exit', at: '2026-10-19T08:15:00Z', index: 3 },
          { fenceId: 'dock', type: 'exit', at: '2026-10-19T08:15:00Z', index: 3 },
        ]);
        // Starting inside does not count as entering, unless the caller says it was outside.
        expect(fenceTransitions(track.slice(1, 2), fences)).toEqual([]);
        expect(fenceTransitions(track.slice(1, 2), fences, [])).toEqual([
          { fenceId: 'pier', type: 'enter', at: '2026-10-19T08:05:00Z', index: 0 },
        ]);
      }
      // validates fences from data
      expect(
        GeofenceSchema.safeParse({ id: 'a', name: 'A', shape: 'polygon', ring: square }).success
      ).toBe(true);
      expect(
        GeofenceSchema.safeParse({ id: 'a', name: 'A', shape: 'polygon', ring: square.slice(0, 2) })
          .success
      ).toBe(false);
      expect(
        GeofenceSchema.safeParse({
          id: 'a',
          name: 'A',
          shape: 'circle',
          center: [200, 0],
          radiusMeters: 5,
        }).success
      ).toBe(false);
    });
  });

  describe('basemap', () => {
    it('ships Port Meridian as valid, small data; renders numeric SVG paths with culling and labels; accepts other fictional basemaps and rejects malformed ones', () => {
      {
        // ships Port Meridian as valid, small data
        expect(BasemapSchema.parse(PORT_MERIDIAN)).toEqual(PORT_MERIDIAN);
        const raw = JSON.stringify(PORT_MERIDIAN);
        expect(raw.length).toBeLessThan(20_000);
        expect(PORT_MERIDIAN.attribution).toMatch(/fictional/i);
      }
      {
        // renders numeric SVG paths with culling and labels
        const view = fitBounds(PORT_MERIDIAN.bbox, SIZE);
        const paths = basemapPaths(PORT_MERIDIAN, view, SIZE);
        expect(paths.map((p) => p.id)).toEqual(PORT_MERIDIAN.features.map((f) => f.id));
        for (const path of paths) expect(path.d).toMatch(/^M[-\d. ]+(L[-\d. ]+)+Z?$/);
        expect(paths.find((p) => p.id === 'north-pier')?.label?.text).toBe('North Pier');
        const close = { center: { lng: -17.8, lat: -31.6 }, zoom: 12 };
        const ids = basemapPaths(PORT_MERIDIAN, close, SIZE).map((p) => p.id);
        expect(ids).toContain('lantern-point');
        expect(ids).not.toContain('highland-park');
      }
      {
        // accepts other fictional basemaps and rejects malformed ones
        const own = {
          id: 'isle',
          name: 'Isle of Example',
          bbox: [-150, 30, -149, 31],
          attribution: 'Fictional island',
          features: [
            {
              id: 'isle',
              kind: 'land',
              geometry: 'polygon',
              coords: [-150, 30, -149, 30, -149.5, 31],
            },
          ],
        };
        expect(BasemapSchema.safeParse(own).success).toBe(true);
        const bad = (patch: object) =>
          BasemapSchema.safeParse({ ...own, features: [{ ...own.features[0], ...patch }] }).success;
        expect(bad({ coords: [-150, 30, -149] })).toBe(false); // odd count
        expect(bad({ coords: [-150, 30, -149, 30, 500, 31] })).toBe(false); // off the map
        expect(bad({ kind: 'lava' })).toBe(false);
        expect(bad({ onclick: 'alert(1)' })).toBe(false);
      }
    });
  });
}

function registerActivityTests() {
  const people = new Map([
    ['p-marta', 'Marta Ruiz'],
    ['p-li', 'Li Wei'],
  ]);
  const records = new Map([['deal-42', 'Renewal for Acme']]);
  const lookups = {
    person: (id: string) => people.get(id),
    record: (id: string) => records.get(id),
  };
  const candidates = {
    mentions: [
      { id: 'p-marta', value: 'marta.ruiz' },
      { id: 'p-li', value: 'li' },
    ],
    references: [{ id: 'deal-42', value: 'DEAL-42' }],
  };

  describe('mention tokenizer', () => {
    it('splits a stored body into text, mention and reference segments, and 2 related cases', () => {
      // splits a stored body into text, mention and reference segments
      expect(tokenize('Hi @{p-marta}, see #{deal-42}.', lookups)).toEqual([
        { type: 'text', text: 'Hi ' },
        { type: 'mention', id: 'p-marta', label: 'Marta Ruiz', missing: false },
        { type: 'text', text: ', see ' },
        { type: 'reference', id: 'deal-42', label: 'Renewal for Acme', missing: false },
        { type: 'text', text: '.' },
      ]);
      expect(tokenize('plain', lookups)).toEqual([{ type: 'text', text: 'plain' }]);
      expect(tokenize('', lookups)).toEqual([]);
      {
        // resolves names at display time, so a rename updates old comments
        const body = 'Thanks @{p-marta}';
        expect(plainText(tokenize(body, lookups))).toBe('Thanks @Marta Ruiz');
        const renamed = new Map(people).set('p-marta', 'Marta Ruiz-Olsen');
        expect(plainText(tokenize(body, { person: (id) => renamed.get(id) }))).toBe(
          'Thanks @Marta Ruiz-Olsen'
        );
        // Gone persona or record: marked missing, never a crash.
        expect(tokenize('@{p-gone} #{x-9}', lookups)).toEqual([
          { type: 'mention', id: 'p-gone', label: 'unknown person', missing: true },
          { type: 'text', text: ' ' },
          { type: 'reference', id: 'x-9', label: 'x-9', missing: true },
        ]);
      }
      {
        // encodes what the composer typed into id tokens and back
        const typed = 'Ping @marta.ruiz and @li about #DEAL-42, cc @nobody or email li@example.com';
        const stored = encodeMentions(typed, candidates);
        expect(stored).toBe(
          'Ping @{p-marta} and @{p-li} about #{deal-42}, cc @nobody or email li@example.com'
        );
        expect(mentionedIds(stored)).toEqual(['p-marta', 'p-li']);
        expect(decodeMentions(stored, candidates)).toBe(typed);
        // A longer handle is not split by a shorter one; a prefix of a word is not a mention.
        expect(encodeMentions('@lilly and @li.', candidates)).toBe('@lilly and @{p-li}.');
        expect(mentionedIds('@{a} @{b} @{a} #{c}')).toEqual(['a', 'b']);
      }
    });
  });

  describe('day grouping', () => {
    const now = '2026-10-19T15:00:00Z';
    it('labels days relative to the runtime clock; groups by civil day in the time zone, keeping order', () => {
      {
        // labels days relative to the runtime clock
        // Monday
        const today = '2026-10-19';
        expect(dayLabel('2026-10-19', today)).toBe('Today');
        expect(dayLabel('2026-10-18', today)).toBe('Yesterday');
        expect(dayLabel('2026-10-20', today)).toBe('Tomorrow');
        expect(dayLabel('2026-10-14', today)).toBe('Wednesday');
        expect(dayLabel('2026-10-12', today)).toBe('Oct 12');
        expect(dayLabel('2025-12-31', today)).toBe('Dec 31, 2025');
      }
      {
        // groups by civil day in the time zone, keeping order
        const items = [
          { id: 'a', at: '2026-10-19T14:00:00Z' },
          { id: 'b', at: '2026-10-19T02:00:00Z' },
          { id: 'c', at: '2026-10-18T23:30:00Z' },
          { id: 'd', at: 'not a date' },
          { id: 'e', at: '2026-10-12T09:00:00Z' },
        ];
        const utc = groupByDay(items, { at: (i) => i.at, now });
        expect(utc.map((g) => [g.label, g.items.map((i) => i.id)])).toEqual([
          ['Today', ['a', 'b']],
          ['Yesterday', ['c']],
          ['Oct 12', ['e']],
        ]);
        // In Los Angeles, 02:00Z and 23:30Z both fall on Sunday the 18th.
        const la = groupByDay(items, { at: (i) => i.at, now, timeZone: 'America/Los_Angeles' });
        expect(la.map((g) => [g.day, g.items.map((i) => i.id)])).toEqual([
          ['2026-10-19', ['a']],
          ['2026-10-18', ['b', 'c']],
          ['2026-10-12', ['e']],
        ]);
      }
    });
  });

  describe('when labels', () => {
    it('formats a time relative to the runtime clock, in the time zone', () => {
      const now = '2026-10-19T15:00:00Z';
      expect(whenLabel('2026-10-19T09:05:00Z', { now })).toBe('Today, 9:05 AM');
      expect(whenLabel('2026-10-19T02:00:00Z', { now, timeZone: 'America/New_York' })).toBe(
        'Yesterday, 10:00 PM'
      );
      expect(whenLabel('2026-09-01T12:00:00Z', { now })).toBe('Sep 1, 12:00 PM');
      expect(whenLabel('nope', { now })).toBe('');
    });
  });

  describe('change summaries', () => {
    it('describes one field in plain words; summarizes audit rows and caps long change lists; adapts blueprint audit rows to feed items, then sorts and filters them', () => {
      // describes one field in plain words
      expect(describeChange('status', { before: 'open', after: 'won' })).toBe(
        'changed status from open to won'
      );
      expect(describeChange('dueDate', { before: null, after: '2026-11-01' })).toBe(
        'set due date to 2026-11-01'
      );
      expect(describeChange('owner_id', { before: 'p-1', after: '' })).toBe('cleared owner id');
      expect(describeChange('apiKey', { before: REDACTED, after: REDACTED })).toBe(
        'changed api key'
      );
      expect(describeChange('amountCents', { before: 120000, after: 9900 })).toBe(
        'changed amount cents from 120,000 to 9,900'
      );
      expect(describeChange('done', { before: false, after: true })).toBe(
        'changed done from No to Yes'
      );
      expect(describeChange('notes', { before: 'a', after: 'x'.repeat(100) })).toMatch(
        /to x{59}…$/
      );
      expect(
        describeChange(
          'stage',
          { before: 'lead', after: 'won' },
          { fieldLabel: () => 'Stage', formatValue: (_f, v) => String(v).toUpperCase() }
        )
      ).toBe('changed Stage from LEAD to WON');
      {
        // summarizes audit rows and caps long change lists
        const changes = {
          a: { before: 1, after: 2 },
          b: { before: 1, after: 2 },
          c: { before: 1, after: 2 },
          d: { before: 1, after: 2 },
        };
        expect(summarizeChanges('update', changes)).toEqual([
          'changed a from 1 to 2',
          'changed b from 1 to 2',
          'and 2 more changes',
        ]);
        expect(summarizeChanges('update', {})).toEqual(['updated']);
        expect(summarizeChanges('purge', {})).toEqual(['permanently deleted']);
      }
      {
        // adapts blueprint audit rows to feed items, then sorts and filters them
        const row = (id: string, at: string, seq: number, extra: Partial<AuditRowLike> = {}) =>
          ({
            id,
            entity: 'deal',
            recordId: 'deal-42',
            actorId: 'p-marta',
            action: 'update',
            at,
            seq,
            changes: { stage: { before: 'lead', after: 'won' } },
            ...extra,
          }) satisfies AuditRowLike;
        const item = auditToActivity(row('au-1', '2026-10-19T10:00:00Z', 1), {
          recordLabel: (r) => records.get(r.recordId),
        });
        expect(item).toEqual({
          id: 'au-1',
          at: '2026-10-19T10:00:00Z',
          actorId: 'p-marta',
          kind: 'update',
          entity: 'deal',
          recordId: 'deal-42',
          recordLabel: 'Renewal for Acme',
          lines: ['changed stage from lead to won'],
          seq: 1,
        });
        const items = [
          item,
          auditToActivity(
            row('au-2', '2026-10-19T10:00:00Z', 2, { action: 'create', actorId: 'p-li' })
          ),
          auditToActivity(row('au-3', '2026-10-18T10:00:00Z', 9, { recordId: 'deal-7' })),
        ];
        expect(sortActivity(items).map((i) => i.id)).toEqual(['au-2', 'au-1', 'au-3']);
        expect(filterActivity(items, { kinds: ['create'] }).map((i) => i.id)).toEqual(['au-2']);
        expect(filterActivity(items, { actorId: 'p-marta' }).map((i) => i.id)).toEqual([
          'au-1',
          'au-3',
        ]);
        expect(filterActivity(items, { recordId: 'deal-7' }).map((i) => i.id)).toEqual(['au-3']);
        expect(filterActivity(items, { kinds: [] })).toHaveLength(3);
      }
    });
  });

  describe('threads and reactions', () => {
    const c = (id: string, at: string, extra: Partial<ActivityComment> = {}): ActivityComment => ({
      id,
      authorId: 'p-li',
      body: id,
      createdAt: `2026-10-19T${at}:00Z`,
      ...extra,
    });
    it('nests replies under their root, oldest first, and 2 related cases', () => {
      {
        // nests replies under their root, oldest first
        const threads = buildThreads([
          c('r2', '11:00', { parentId: 'root' }),
          c('root', '09:00'),
          c('nested', '12:00', { parentId: 'r2' }),
          c('r1', '10:00', { parentId: 'root' }),
          c('orphan', '08:00', { parentId: 'gone' }),
          c('gone-root', '07:00', { deletedAt: '2026-10-19T07:30:00Z' }),
          c('kept-root', '06:00', { deletedAt: '2026-10-19T06:30:00Z' }),
          c('kept-reply', '06:10', { parentId: 'kept-root' }),
        ]);
        expect(threads.map((t) => [t.comment.id, t.replies.map((r) => r.id)])).toEqual([
          ['kept-root', ['kept-reply']],
          ['orphan', []],
          ['root', ['r1', 'r2', 'nested']],
        ]);
      }
      {
        // validates comment input and toggles reactions
        expect(CommentInputSchema.parse({ body: '  hi  ' })).toEqual({
          body: 'hi',
          parentId: null,
        });
        const blank = CommentInputSchema.safeParse({ body: '   ' });
        expect(blank.success === false && blank.error.issues[0]?.message).toBe(
          'Write something first'
        );
        const once = toggleReaction(undefined, '👍', 'p-li');
        expect(once).toEqual({ '👍': ['p-li'] });
        expect(toggleReaction(once, '👍', 'p-marta')).toEqual({ '👍': ['p-li', 'p-marta'] });
        expect(toggleReaction(once, '👍', 'p-li')).toEqual({});
        expect(once).toEqual({ '👍': ['p-li'] }); // not mutated
      }
      {
        // keeps a stored __proto__ reaction key as data, never as the prototype
        const stored = JSON.parse('{"__proto__":["p-x"],"👍":["p-li"]}') as Record<
          string,
          string[]
        >;
        const next = toggleReaction(stored, '👍', 'p-marta');
        expect(Object.getPrototypeOf(next)).toBe(Object.prototype);
        expect(Object.hasOwn(next, '__proto__')).toBe(true);
        expect(Object.getOwnPropertyDescriptor(next, '__proto__')?.value).toEqual(['p-x']);
        expect(next['👍']).toEqual(['p-li', 'p-marta']);
        const removed = toggleReaction(next, '__proto__', 'p-x');
        expect(Object.hasOwn(removed, '__proto__')).toBe(false);
        expect(Object.getPrototypeOf(removed)).toBe(Object.prototype);
      }
    });
  });
}

registerBoardTests();

registerCalendarTests();

registerTimelineTests();

registerGridTests();

registerTreeTests();

registerMapTests();

registerActivityTests();

function registerFilesTests() {
  describe('file engine', () => {
    const entries: FileEntry[] = [
      {
        id: 'root',
        name: 'Documents',
        parentId: null,
        kind: 'folder',
        size: 0,
        updatedAt: '2026-10-20',
      },
      {
        id: 'report',
        name: 'Report.PDF',
        parentId: 'root',
        kind: 'file',
        type: 'application/pdf',
        size: 2048,
        updatedAt: '2026-10-21',
      },
      {
        id: 'image',
        name: 'cover.webp',
        parentId: 'root',
        kind: 'file',
        type: 'image/webp',
        size: 512,
        updatedAt: '2026-10-22',
      },
    ];
    it('builds deterministic hierarchy, breadcrumbs and safe names; classifies and formats files and makes id-based SVG thumbnails', () => {
      // builds deterministic hierarchy, breadcrumbs and safe names
      expect(childrenOf(entries, 'root').map((entry) => entry.id)).toEqual(['image', 'report']);
      expect(breadcrumbs(entries, 'report').map((entry) => entry.id)).toEqual(['root', 'report']);
      expect([...descendantIds(entries, 'root')].sort()).toEqual(['image', 'report']);
      expect(nameProblem('  ', entries)).toBeTruthy();
      expect(uniqueName('Report.PDF', entries)).toBe('Report.PDF 2');
      expect(moveProblem(entries, ['root'], 'report')).toBeTruthy();
      {
        // classifies and formats files and makes id-based SVG thumbnails
        expect(extensionOf('Report.PDF')).toBe('PDF');
        expect(categoryOf(entries[1] as FileEntry)).toBe('pdf');
        expect(formatSize(2048)).toBe('2.0 KB');
        const svg = thumbnailSvg(entries[1] as FileEntry);
        expect(svg).toContain('<svg');
        expect(svg).toContain('PDF');
        expect(thumbnailUrl(entries[1] as FileEntry)).toMatch(/^data:image\/svg\+xml/);
      }
    });
  });
}
registerFilesTests();

describe('calendar move engine (merged)', () => {
  const timed = { start: '2026-04-15T13:00:00Z', end: '2026-04-15T14:30:00Z', allDay: false };
  const allDay = { start: '2026-04-15', end: '2026-04-17', allDay: true };

  describe('calendar move engine', () => {
    it('keys one-off events by series and repeating ones by series and original start, and 8 related cases', () => {
      // keys one-off events by series and repeating ones by series and original start
      expect(
        eventKey({ seriesId: 'review', occurrenceId: '2026-04-15T13:00:00Z', recurring: false })
      ).toBe('review');
      expect(
        eventKey({ seriesId: 'weekly', occurrenceId: '2026-04-13T15:00:00Z', recurring: true })
      ).toBe('weekly|2026-04-13T15:00:00Z');
      // moves timed events by days and minutes and keeps their duration
      expect(applyMove(timed, { days: 1, minutes: 0 }, 'UTC')).toEqual({
        start: '2026-04-16T13:00:00.000Z',
        end: '2026-04-16T14:30:00.000Z',
      });
      expect(applyMove(timed, { days: -2, minutes: 45 }, 'UTC')).toEqual({
        start: '2026-04-13T13:45:00.000Z',
        end: '2026-04-13T15:15:00.000Z',
      });
      {
        // keeps the wall-clock time when a day move crosses a DST change
        // 09:00 in New York on Saturday 2026-03-07 (EST) is 09:00 on Sunday 2026-03-08 (EDT).
        const nine = { start: '2026-03-07T14:00:00Z', end: '2026-03-07T15:00:00Z', allDay: false };
        expect(applyMove(nine, { days: 1, minutes: 0 }, 'America/New_York')).toEqual({
          start: '2026-03-08T13:00:00.000Z',
          end: '2026-03-08T14:00:00.000Z',
        });
      }
      // moves all-day events by whole dates with an exclusive end
      expect(applyMove(allDay, { days: 7, minutes: 0 }, 'UTC')).toEqual({
        start: '2026-04-22',
        end: '2026-04-24',
      });
      expect(spanDates(allDay, 'UTC')).toEqual({ first: '2026-04-15', last: '2026-04-16' });
      {
        // checks every covered date against min and max, inclusive
        const bounds = { timeZone: 'UTC', min: '2026-04-10', max: '2026-04-16' };
        expect(withinBounds(allDay, bounds)).toBe(true);
        expect(withinBounds({ ...allDay, start: '2026-04-16', end: '2026-04-18' }, bounds)).toBe(
          false
        );
        expect(withinBounds({ ...allDay, start: '2026-04-09', end: '2026-04-10' }, bounds)).toBe(
          false
        );
        // A timed event that ends at midnight does not cover the next date.
        const toMidnight = {
          start: '2026-04-16T22:00:00Z',
          end: '2026-04-17T00:00:00Z',
          allDay: false,
        };
        expect(withinBounds(toMidnight, bounds)).toBe(true);
      }
      {
        // reports why a move cannot happen
        const bounds = { timeZone: 'UTC', max: '2026-04-15' };
        expect(isNoMove(NO_MOVE)).toBe(true);
        expect(moveOccurrence(timed, NO_MOVE, bounds)).toEqual({ ok: false, reason: 'no-move' });
        expect(moveOccurrence(timed, { days: 1, minutes: 0 }, bounds)).toEqual({
          ok: false,
          reason: 'out-of-range',
        });
        expect(moveOccurrence(timed, { days: -1, minutes: 0 }, bounds)).toEqual({
          ok: true,
          target: { start: '2026-04-14T13:00:00.000Z', end: '2026-04-14T14:30:00.000Z' },
        });
      }
      // maps arrow keys to moves per view, with RTL and all-day rules
      expect(keyMove('ArrowRight', { view: 'month', allDay: false })).toEqual({
        days: 1,
        minutes: 0,
      });
      expect(keyMove('ArrowDown', { view: 'month', allDay: false })).toEqual({
        days: 7,
        minutes: 0,
      });
      expect(keyMove('ArrowUp', { view: 'week', allDay: false })).toEqual({
        days: 0,
        minutes: -15,
      });
      expect(keyMove('ArrowDown', { view: 'day', allDay: false, slotMinutes: 30 })).toEqual({
        days: 0,
        minutes: 30,
      });
      expect(keyMove('ArrowRight', { view: 'week', allDay: false, rtl: true })).toEqual({
        days: -1,
        minutes: 0,
      });
      expect(keyMove('ArrowDown', { view: 'week', allDay: true })).toBeNull();
      expect(keyMove('ArrowLeft', { view: 'agenda', allDay: false })).toBeNull();
      expect(keyMove('Enter', { view: 'week', allDay: false })).toBeNull();
      {
        // maps pointer drags to whole columns, weeks and snapped slots
        const month = { view: 'month' as const, allDay: false, columnWidth: 100, rowHeight: 90 };
        expect(pointerMove(240, 100, month)).toEqual({ days: 9, minutes: 0 });
        expect(pointerMove(240, 0, { ...month, rtl: true })).toEqual({ days: -2, minutes: 0 });
        // Time grid: one pixel per minute, 15-minute slots.
        const week = { view: 'week' as const, allDay: false, columnWidth: 100, rowHeight: 1 };
        expect(pointerMove(110, 22, week)).toEqual({ days: 1, minutes: 15 });
        expect(pointerMove(-40, -23, week)).toEqual({ days: 0, minutes: -30 });
        expect(pointerMove(110, 300, { ...week, allDay: true })).toEqual({ days: 1, minutes: 0 });
        expect(pointerMove(500, 500, { ...week, view: 'agenda' })).toEqual(NO_MOVE);
        expect(pointerMove(500, 500, { ...week, columnWidth: 0, rowHeight: 0 })).toEqual({
          days: 0,
          minutes: 0,
        });
      }
      {
        // lists Move menu destinations per view and marks the ones outside the dates
        const bounds = { timeZone: 'UTC', max: '2026-04-20' };
        const week = moveChoices(timed, { view: 'week', bounds });
        expect(week.map((choice) => choice.id)).toEqual([
          'earlier-slot',
          'later-slot',
          'earlier-hour',
          'later-hour',
          'previous-day',
          'next-day',
          'previous-week',
          'next-week',
        ]);
        expect(week.find((choice) => choice.id === 'later-hour')?.target).toEqual({
          start: '2026-04-15T14:00:00.000Z',
          end: '2026-04-15T15:30:00.000Z',
        });
        expect(week.find((choice) => choice.id === 'next-week')?.target).toBeNull();
        // Month view and all-day entries move by days and weeks only; hour steps fold into 60-minute slots.
        expect(moveChoices(timed, { view: 'month', bounds }).map((choice) => choice.id)).toEqual([
          'previous-day',
          'next-day',
          'previous-week',
          'next-week',
        ]);
        expect(moveChoices(allDay, { view: 'day', bounds })).toHaveLength(4);
        expect(moveChoices(timed, { view: 'day', bounds, slotMinutes: 60 })).toHaveLength(6);
        expect(moveChoices(timed, { view: 'agenda', bounds })).toEqual([]);
      }
    });
  });
});

describe('calendar slots (merged)', () => {
  describe('calendar slots and clock', () => {
    it('builds timed slots in the view zone and all-day slots with an exclusive end, and 4 related cases', () => {
      // builds timed slots in the view zone and all-day slots with an exclusive end
      expect(timedSlot('2026-04-15', 9 * 60, 'UTC')).toEqual({
        date: '2026-04-15',
        start: '2026-04-15T09:00:00.000Z',
        end: '2026-04-15T10:00:00.000Z',
        allDay: false,
      });
      // 09:30 in Los Angeles (PDT, UTC-7), 30 minutes long.
      expect(timedSlot('2026-04-15', 9 * 60 + 30, 'America/Los_Angeles', 30)).toMatchObject({
        start: '2026-04-15T16:30:00.000Z',
        end: '2026-04-15T17:00:00.000Z',
      });
      expect(daySlot('2026-12-31')).toEqual({
        date: '2026-12-31',
        start: '2026-12-31',
        end: '2027-01-01',
        allDay: true,
      });
      // snaps a pointer offset to a slot and keeps it inside the day
      expect(slotMinuteAt(600, 1440, 15)).toBe(600);
      expect(slotMinuteAt(614, 1440, 15)).toBe(600);
      expect(slotMinuteAt(300, 720, 30)).toBe(600);
      expect(slotMinuteAt(-20, 1440, 15)).toBe(0);
      expect(slotMinuteAt(5000, 1440, 15)).toBe(1425);
      expect(slotMinuteAt(10, 0, 15)).toBe(0);
      // steps the focused slot by days and minutes, wrapping past midnight
      expect(stepSlot({ date: '2026-04-15', minute: 600 }, 1, 15)).toEqual({
        date: '2026-04-16',
        minute: 615,
      });
      expect(stepSlot({ date: '2026-04-15', minute: 0 }, 0, -15)).toEqual({
        date: '2026-04-14',
        minute: 1425,
      });
      expect(stepSlot({ date: '2026-04-15', minute: 1425 }, 0, 15)).toEqual({
        date: '2026-04-16',
        minute: 0,
      });
      {
        // places now on its own date only, in wall-clock minutes
        const at = Date.parse('2026-04-15T13:30:00Z');
        expect(nowMinute(at, '2026-04-15', 'UTC')).toBe(810);
        expect(nowMinute(at, '2026-04-16', 'UTC')).toBeNull();
        expect(nowMinute(at, '2026-04-15', 'America/New_York')).toBe(570);
        // Late evening in Los Angeles is already the next UTC day.
        expect(
          nowMinute(Date.parse('2026-04-16T02:00:00Z'), '2026-04-15', 'America/Los_Angeles')
        ).toBe(19 * 60);
      }
      {
        // adds the year to range titles that span years or are not the current year
        const fmt = formatCalendar('en-US', 'UTC');
        expect(fmt.range('2026-04-12', '2026-04-18', 2026)).toBe('Apr 12 – Apr 18');
        expect(fmt.range('2026-04-12', '2026-04-18')).toBe('Apr 12 – Apr 18');
        expect(fmt.range('2026-04-12', '2026-04-18', 2025)).toBe('Apr 12 – Apr 18, 2026');
        expect(fmt.range('2026-12-27', '2027-01-02', 2026)).toBe('Dec 27, 2026 – Jan 2, 2027');
        // always: the year on every range, current year included.
        expect(fmt.range('2026-05-31', '2026-06-06', 2026, true)).toBe('May 31 – Jun 6, 2026');
        expect(fmt.range('2026-12-27', '2027-01-02', 2026, true)).toBe(
          'Dec 27, 2026 – Jan 2, 2027'
        );
      }
    });
  });
});

describe('virtual list (merged)', () => {
  describe('variable-height virtual list', () => {
    it('windows a large collection with estimated and measured heights, and 4 related cases', () => {
      {
        // windows a large collection with estimated and measured heights
        const list = createVirtualList({ count: 100_000, estimateSize: 40, overscan: 1 });
        expect(list.measure(100, 80)).toBe(true);
        expect(list.measure(101, 20)).toBe(true);

        const window = list.window(4_000, 80);
        expect(list.totalSize).toBe(4_000_020);
        expect(window.items.map(({ index, start, size }) => [index, start, size])).toEqual([
          [99, 3_960, 40],
          [100, 4_000, 80],
          [101, 4_080, 20],
        ]);
      }
      {
        // finds exact row boundaries and clamps offsets
        const list = createVirtualList({ count: 3, estimateSize: 10 });
        list.measure(0, 20);
        list.measure(1, 5);

        expect([list.offsetOf(0), list.offsetOf(1), list.offsetOf(2), list.offsetOf(3)]).toEqual([
          0, 20, 25, 35,
        ]);
        expect([list.indexAt(-20), list.indexAt(19), list.indexAt(20), list.indexAt(35)]).toEqual([
          0, 0, 1, 2,
        ]);
        expect(list.offsetOf(100)).toBe(35);
      }
      {
        // normalizes invalid counts, estimates, viewport values and measurements safely
        const list = createVirtualList({ count: Number.NaN, estimateSize: 0 });
        expect(list.count).toBe(0);
        expect(list.totalSize).toBe(0);
        expect(list.window(0, 100).items).toEqual([]);

        list.resize(2.8);
        expect(list.count).toBe(2);
        expect(list.totalSize).toBe(2);
        expect(list.measure(-1, 20)).toBe(false);
        expect(list.measure(0, 0)).toBe(false);
        expect(list.measure(2, 20)).toBe(false);
        expect(list.window(0, Number.NaN).items).toEqual([]);
      }
      {
        // drops measurements when the collection shrinks
        const list = createVirtualList({ count: 3, estimateSize: 10 });
        list.measure(2, 40);
        list.resize(2);
        expect(list.totalSize).toBe(20);
        expect(list.sizeOf(2)).toBe(0);
        list.resize(4);
        expect(list.totalSize).toBe(40);
        expect(list.offsetOf(3)).toBe(30);
      }
      {
        // keeps the rendered range bounded and reports the full virtual size
        const list = createVirtualList({ count: 5000, estimateSize: 24, overscan: 2 });
        const window = list.window(24_000, 120);
        expect(window.totalSize).toBe(120_000);
        expect(window.items.length).toBeLessThanOrEqual(10);
        expect(window.items[0]?.index).toBe(998);
        expect(window.items.at(-1)?.index).toBe(1006);
      }
    });
  });

  describe('virtual list keyboard navigation', () => {
    it('supports vertical navigation, Home, End and page movement; reverses horizontal arrow movement in RTL and optionally wraps', () => {
      {
        // supports vertical navigation, Home, End and page movement
        const options = { count: 20, pageSize: 5 };
        expect(nextVirtualListIndex(2, 'ArrowDown', options)).toBe(3);
        expect(nextVirtualListIndex(0, 'ArrowUp', options)).toBe(0);
        expect(nextVirtualListIndex(3, 'PageDown', options)).toBe(8);
        expect(nextVirtualListIndex(3, 'PageUp', options)).toBe(0);
        expect(nextVirtualListIndex(3, 'Home', options)).toBe(0);
        expect(nextVirtualListIndex(3, 'End', options)).toBe(19);
        expect(nextVirtualListIndex(3, 'Enter', options)).toBeNull();
      }
      {
        // reverses horizontal arrow movement in RTL and optionally wraps
        const options = { count: 3, orientation: 'horizontal' as const, direction: 'rtl' as const };
        expect(nextVirtualListIndex(1, 'ArrowRight', options)).toBe(0);
        expect(nextVirtualListIndex(1, 'ArrowLeft', options)).toBe(2);
        expect(nextVirtualListIndex(0, 'ArrowRight', { ...options, loop: true })).toBe(2);
        expect(
          nextVirtualListIndex(0, 'PageUp', {
            ...options,
            loop: true,
            pageSize: 10,
          })
        ).toBe(2);
        expect(nextVirtualListIndex(1, 'ArrowDown', options)).toBeNull();
        expect(nextVirtualListIndex(0, 'Home', { count: 0 })).toBeNull();
      }
    });
  });

  describe('infinite list loading', () => {
    it('loads at the threshold and coalesces concurrent range checks, and 2 related cases', async () => {
      // loads at the threshold and coalesces concurrent range checks
      await (async () => {
        let count = 10;
        let finish: (() => void) | undefined;
        const loadMore = vi.fn(
          () =>
            new Promise<void>((resolve) => {
              finish = () => {
                count += 5;
                resolve();
              };
            })
        );
        const loader = createInfiniteLoader({ getItemCount: () => count, loadMore, threshold: 3 });

        await loader.check(6);
        expect(loader.status).toBe('idle');
        const first = loader.check(7);
        const second = loader.check(8);
        expect(loader.status).toBe('loading');
        expect(loadMore).toHaveBeenCalledTimes(1);
        finish?.();
        await Promise.all([first, second]);
        expect(count).toBe(15);
        expect(loader.status).toBe('idle');
      })();
      // does not load outside the threshold and marks an exhausted list
      await (async () => {
        const loadMore = vi.fn().mockResolvedValue(undefined);
        let more = true;
        const loader = createInfiniteLoader({
          getItemCount: () => 10,
          loadMore,
          threshold: 2,
          hasMore: () => more,
        });
        await loader.check(7);
        expect(loadMore).not.toHaveBeenCalled();
        await loader.check(8);
        expect(loadMore).toHaveBeenCalledTimes(1);
        more = false;
        await loader.check(10);
        expect(loader.status).toBe('exhausted');
        expect(loadMore).toHaveBeenCalledTimes(1);
      })();
      // exposes errors and retries after resetError
      await (async () => {
        const failure = new Error('network unavailable');
        const loadMore = vi.fn().mockRejectedValueOnce(failure).mockResolvedValueOnce(undefined);
        const loader = createInfiniteLoader({ getItemCount: () => 5, loadMore, threshold: 1 });

        await loader.check(4);
        expect(loader.status).toBe('error');
        expect(loader.error).toBe(failure);
        await loader.check(5);
        expect(loadMore).toHaveBeenCalledTimes(1);
        loader.resetError();
        await loader.check(5);
        expect(loader.status).toBe('idle');
        expect(loader.error).toBeUndefined();
        expect(loadMore).toHaveBeenCalledTimes(2);
      })();
    });
  });
});
