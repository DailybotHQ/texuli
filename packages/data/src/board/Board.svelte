<script lang="ts" generics="T">
import { lazyChunk } from '@texuli/core/lazy';
import type { Point } from '@texuli/drag';
import { midpointIndex } from '@texuli/drag/collision';
import { bindPointerGesture, createPointerTracker } from '@texuli/drag/gesture';
import {
  type DragMessagesOverrides,
  type DragMessageValues,
  formatDragMessage,
  resolveDragMessages,
} from '@texuli/drag/messages';
import { type Component, type Snippet, tick, untrack } from 'svelte';
import type { Attachment } from 'svelte/attachments';
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue, cx, variants } from 'texuli/cx';
import type { MotionProp } from 'texuli/motion';
import {
  type BoardColumnDef,
  type BoardKeyboardText,
  type BoardLaneDef,
  type BoardMove,
  type BoardOptions,
  type BoardPositionValues,
  DEFAULT_BOARD_KEYBOARD_TEXT,
  evaluateWip,
  groupBoard,
  IDLE,
  type KeyboardMoveState,
  type MoveRules,
  type MoveTarget,
  moveIntent,
  pickUp,
  rankSequence,
  validateMove,
} from '../engines/board/index.ts';
import { createLazyListMotion } from '../motion/lazy-list-motion.ts';
import {
  DEFAULT_MOVE_MENU_TEXT,
  type MoveMenuDestination,
  moveMenuDestinations,
  placementsOf,
} from './model.ts';
import type { BoardLabelOverrides, BoardLabels } from './types.ts';

type MoveMenuProps = {
  open?: boolean;
  disabled?: boolean;
  label: string;
  menuLabel: string;
  destinations: readonly MoveMenuDestination[];
  onSelect: (destination: MoveMenuDestination) => void;
  onOpenChange?: (open: boolean) => void;
};

interface OwnBoardProps<T> {
  columns: readonly BoardColumnDef[];
  items: readonly T[];
  lanes?: readonly BoardLaneDef[];
  getId: (item: T) => string;
  getColumn: (item: T) => string;
  getLane?: (item: T) => string;
  /**
   * The item's rank (its order in a cell). Omit it for a column-only board:
   * cards keep the order of `items`, moves go to another column only
   * (reordering inside a column is refused), and `onMove` still receives a
   * rank the host may ignore.
   */
  getRank?: (item: T) => string;
  getLabel?: (item: T) => string;
  /** When true, the card cannot be dragged or moved via the menu (WCAG lock). */
  isLocked?: (item: T) => boolean;
  card: Snippet<[T, { pending: boolean }]>;
  /** Rendered at the end of each column (add a card, totals…), with the column's card count. */
  columnFooter?: Snippet<[BoardColumnDef, { count: number }]>;
  /** Rendered in each column header after the title and count (actions, a menu, a hint), with the card count. */
  columnHeader?: Snippet<[BoardColumnDef, { count: number }]>;
  /**
   * Level of the column headings (2–6, default 3). The board's hidden title
   * sits one level above (no heading at 2), swimlane titles one below.
   */
  headingLevel?: 2 | 3 | 4 | 5 | 6;
  onMove: (move: BoardMove, item: T) => void | Promise<void>;
  canMove?: MoveRules<T>['canMove'];
  labels?: BoardLabelOverrides;
  /** Drag announcements (`@texuli/drag` templates), e.g. a localized `pickedUp`. */
  messages?: DragMessagesOverrides;
  density?: 'comfortable' | 'compact';
  dir?: 'ltr' | 'rtl' | 'auto';
  class?: ClassValue;
  /**
   * Motion (`texuli/motion`): cards glide to their new place when `items`
   * changes (a committed move, an insert or a removal; `layout`, default on).
   * `false` for none; instant under reduced motion and at level `none`.
   */
  motion?: MotionProp;
  /** The board's root `section` (bindable). */
  ref?: HTMLElement | null;
}
/**
 * Other attributes (`id`, `aria-*`, `data-*`, `style`, handlers) land on the
 * root `section`. A caller `id` replaces the generated one.
 */
type BoardProps<T> = OwnBoardProps<T> &
  Omit<HTMLAttributes<HTMLElement>, keyof OwnBoardProps<T> | 'children'>;

const rootClasses = variants({
  base: 'tx-board',
  variants: {
    density: { comfortable: 'tx-board--comfortable', compact: 'tx-board--compact' },
  },
  defaultVariants: { density: 'comfortable' },
});

const DEFAULT_LABELS: BoardLabels = {
  board: 'Board',
  instructions:
    'Focus a card handle and press Space or Enter to pick it up. Use the arrow keys to choose a position, then Space or Enter to drop. Press Escape to cancel. Or open Move on a card and choose a column and position from the menu.',
  dragHandle: (label) => `Drag ${label}`,
  moveMenu: (label) => `Move ${label}`,
  moveMenuLabel: (label) => `Move ${label} to…`,
  emptyCell: 'No cards',
  unplaced: 'Cards outside configured columns',
  savingMove: 'Saving move',
  cardCount: (count, hardLimit) =>
    `${count} card${count === 1 ? '' : 's'}${hardLimit === undefined ? '' : `, limit ${hardLimit}`}`,
  announcement: (message) => message,
  moved: (label, column, edge) => `Moved ${label} to ${column} (${edge}).`,
  moveFailed: (label) => `${label} was not moved. It returned to its previous position.`,
  locked: (label) => `${label} is locked and cannot be moved.`,
  cannotMove: (label) => `${label} cannot move there.`,
  menuTop: DEFAULT_MOVE_MENU_TEXT.top,
  menuBottom: DEFAULT_MOVE_MENU_TEXT.bottom,
  alreadyAt: DEFAULT_MOVE_MENU_TEXT.alreadyAt,
  keyboard: DEFAULT_BOARD_KEYBOARD_TEXT,
};

let {
  columns,
  items,
  lanes,
  getId,
  getColumn,
  getLane,
  getRank,
  getLabel = (item: T) => getId(item),
  isLocked,
  card,
  columnFooter,
  columnHeader,
  headingLevel = 3,
  onMove,
  canMove,
  labels: labelOverrides,
  messages: messageOverrides,
  density = 'comfortable',
  dir,
  class: className,
  motion,
  ref = $bindable(null),
  ...rest
}: BoardProps<T> = $props();

const uid = $props.id();
// Layout motion: measure the cards before `items` changes, play after it.
const cardMotion = createLazyListMotion({
  motion: () => motion,
  defaults: { layout: true, duration: 'base' },
  items: () =>
    Array.from(
      ref?.querySelectorAll<HTMLElement>('[data-board-card]') ?? [],
      (element) => [element.getAttribute('data-item-id') ?? '', element] as const
    ),
});
$effect.pre(() => {
  void items;
  untrack(() => cardMotion.measure());
});
$effect(() => {
  void items;
  untrack(() => cardMotion.play());
});
const level = $derived(Math.min(6, Math.max(2, Math.trunc(headingLevel) || 3)));
const instructionsId = `board-${uid}-instructions`;
const titleId = `board-${uid}-title`;
const labels = $derived<BoardLabels>({
  ...DEFAULT_LABELS,
  ...labelOverrides,
  keyboard: { ...DEFAULT_BOARD_KEYBOARD_TEXT, ...labelOverrides?.keyboard },
});
const messages = $derived(resolveDragMessages(messageOverrides));

/**
 * Keyboard sentences: the board labels, except where the host gave a drag
 * message template (`pickedUp`, `moved`, `dropped`, `cancelled`), which then
 * speaks for pointer and keyboard drags alike.
 */
const keyboardText = $derived.by((): BoardKeyboardText => {
  const overrides = messageOverrides ?? {};
  const values = (item: string, at: BoardPositionValues) => ({
    item,
    position: at.position,
    total: at.total,
    container: at.lane === null ? at.column : `${at.column}, ${at.lane}`,
  });
  const text: BoardKeyboardText = { ...labels.keyboard };
  if (overrides.pickedUp !== undefined) {
    text.pickedUp = (item, _where, at) => formatDragMessage(messages.pickedUp, values(item, at));
  }
  if (overrides.moved !== undefined) {
    text.moved = (item, _where, at) => formatDragMessage(messages.moved, values(item, at));
  }
  if (overrides.dropped !== undefined) {
    text.dropped = (item, _where, at) => formatDragMessage(messages.dropped, values(item, at));
  }
  if (overrides.cancelled !== undefined) {
    text.cancelled = (item, _where, at) => formatDragMessage(messages.cancelled, values(item, at));
  }
  return text;
});
let pending = $state<Record<string, boolean>>({});
let held = $state<KeyboardMoveState>(IDLE);
let announcement = $state('');
let placements = $state<Record<string, ReturnType<typeof placementsOf>[string]>>({});
/** Lazy DropdownMenu chunk — shared for every card after first open/prefetch. */
let MoveMenu = $state.raw<Component<MoveMenuProps> | undefined>();
let menuReady = $state(false);
/** Which card’s move menu is open (`itemId`), once the lazy menu is mounted. */
let openMenuId = $state<string | null>(null);
/** The pointer drag in progress (keyboard moves use `held`). */
let drag = $state<{ id: string; active: boolean; target: MoveTarget | null } | null>(null);

/** Column-only mode: no `getRank`, so ranks follow the order of `items`. */
const columnOnly = $derived(getRank === undefined);
const localRanks = $derived.by(() => {
  if (!columnOnly) return null;
  const ranks = rankSequence(items.length);
  return new Map(items.map((item, index) => [getId(item), ranks[index] as string]));
});
function rankOf(item: T): string {
  return getRank ? getRank(item) : (localRanks?.get(getId(item)) ?? '');
}

const options = $derived<BoardOptions<T>>({
  columns,
  ...(lanes?.length ? { lanes, lane: (item: T) => getLane?.(item) ?? '' } : {}),
  id: getId,
  column: (item: T) => placements[getId(item)]?.columnId ?? getColumn(item),
  lane: (item: T) => placements[getId(item)]?.laneId ?? getLane?.(item) ?? '',
  rank: (item: T) => placements[getId(item)]?.rank ?? rankOf(item),
  label: getLabel,
});
const rules = $derived<MoveRules<T>>({
  ...(canMove ? { canMove } : {}),
  ...(columnOnly ? { reorder: false } : {}),
});
const grid = $derived(groupBoard(items, options));

$effect(() => {
  const unresolved = Object.keys(placements).filter((id) => !pending[id]);
  if (unresolved.length === 0) return;
  const byId = new Map(items.map((item) => [getId(item), item]));
  const settled = unresolved.filter((id) => {
    const item = byId.get(id);
    const placement = placements[id];
    if (!item || !placement) return true;
    const itemLane = lanes?.length ? (getLane?.(item) ?? '') : '';
    const targetLane = lanes?.length ? placement.laneId : '';
    return (
      getColumn(item) === placement.columnId &&
      itemLane === targetLane &&
      // Column-only boards keep no rank: the column (and lane) settle the move.
      (columnOnly || getRank?.(item) === placement.rank)
    );
  });
  if (settled.length === 0) return;
  const next = { ...placements };
  for (const id of settled) delete next[id];
  placements = next;
});

const shown = $derived.by(() => {
  if (held.mode !== 'held') return grid;
  const column = grid.columns[held.target.columnIndex];
  const lane = grid.lanes[held.target.laneIndex];
  if (!column || !lane) return grid;
  const preview = validateMove(
    grid,
    held.itemId,
    { columnId: column.id, laneId: lane.id, index: held.target.index },
    rules
  );
  if (!preview.ok || preview.unchanged) return grid;
  const previewPlacements = { ...placements, ...placementsOf(preview.move) };
  return groupBoard(items, {
    ...options,
    column: (item: T) => previewPlacements[getId(item)]?.columnId ?? getColumn(item),
    lane: (item: T) => previewPlacements[getId(item)]?.laneId ?? getLane?.(item) ?? '',
    rank: (item: T) => previewPlacements[getId(item)]?.rank ?? rankOf(item),
  });
});

function announce(message: string | undefined): void {
  if (message) announcement = labels.announcement(message);
}

function itemById(id: string): T | undefined {
  return items.find((item) => getId(item) === id);
}

async function focusCard(id: string, prefer: 'menu' | 'handle' = 'handle'): Promise<void> {
  await tick();
  // Menu close + DOM reorder can lag one frame behind the placement update.
  await new Promise<void>((resolve) => {
    const win = document.defaultView;
    if (win?.requestAnimationFrame) win.requestAnimationFrame(() => resolve());
    else resolve();
  });
  const root = ref;
  const cardNode = [...(root?.querySelectorAll<HTMLElement>('[data-board-card]') ?? [])].find(
    (node) => node.getAttribute('data-item-id') === id
  );
  if (!cardNode) return;
  const menu = cardNode.querySelector<HTMLElement>('[data-board-move-menu]');
  const handle = cardNode.querySelector<HTMLElement>('[data-board-handle]');
  const target = prefer === 'menu' ? (menu ?? handle) : (handle ?? menu);
  if (target && 'focus' in target && typeof target.focus === 'function') {
    target.focus();
  }
}

function cardLocked(item: T): boolean {
  return Boolean(isLocked?.(item));
}

function destinationsFor(item: T): MoveMenuDestination[] {
  return moveMenuDestinations(grid, getId(item), rules, {
    top: labels.menuTop,
    bottom: labels.menuBottom,
    alreadyAt: labels.alreadyAt,
  });
}

const MOVE_MENU_CHUNK = 'data:board:move-menu';

function ensureMoveMenu(): Promise<Component<MoveMenuProps>> {
  if (MoveMenu) return Promise.resolve(MoveMenu);
  return lazyChunk(MOVE_MENU_CHUNK, () => import('./BoardMoveMenu.svelte')).then((module) => {
    const component = module.default as unknown as Component<MoveMenuProps>;
    MoveMenu = component;
    menuReady = true;
    return component;
  });
}

/** Prefetch on focus/hover so the first open feels instant. */
function prefetchMoveMenu(): void {
  void ensureMoveMenu();
}

async function openMoveMenu(item: T): Promise<void> {
  const id = getId(item);
  if (pending[id] || cardLocked(item)) return;
  await ensureMoveMenu();
  // Wait a frame so the lazy MoveMenu replaces the light trigger before open.
  await tick();
  openMenuId = id;
  await tick();
}

async function commit(
  move: BoardMove,
  item: T,
  focus: 'menu' | 'handle' = 'handle'
): Promise<void> {
  const nextPlacements = placementsOf(move);
  const oldPlacements = Object.fromEntries(
    Object.keys(nextPlacements).map((id) => [id, placements[id]])
  );
  placements = { ...placements, ...nextPlacements };
  pending = { ...pending, [move.itemId]: true };
  try {
    await onMove(move, item);
    await focusCard(move.itemId, focus);
  } catch {
    const restored = { ...placements };
    for (const [id, placement] of Object.entries(oldPlacements)) {
      if (placement) restored[id] = placement;
      else delete restored[id];
    }
    placements = restored;
    announce(labels.moveFailed(getLabel(item)));
    await focusCard(move.itemId, focus);
  } finally {
    const { [move.itemId]: _done, ...remaining } = pending;
    pending = remaining;
  }
}

function moveTo(item: T, target: MoveTarget, focus: 'menu' | 'handle' = 'handle'): void {
  if (cardLocked(item)) {
    announce(labels.locked(getLabel(item)));
    return;
  }
  const result = validateMove(grid, getId(item), target, rules);
  if (!result.ok) {
    announce(result.reason);
    return;
  }
  if (result.unchanged) return;
  const column = columns.find((candidate) => candidate.id === result.move.columnId);
  const position = result.move.index === 0 ? 'top' : 'bottom';
  const moved = labels.moved(getLabel(item), column?.title ?? result.move.columnId, position);
  announce(result.wip.status === 'ok' ? moved : `${moved} ${result.wip.reason}`);
  void commit(result.move, item, focus);
}

function onMenuSelect(item: T, destination: MoveMenuDestination): void {
  if (destination.disabled) {
    announce(destination.reason ?? labels.cannotMove(getLabel(item)));
    return;
  }
  moveTo(item, destination.target, 'menu');
}

function onCardKey(event: KeyboardEvent, item: T): void {
  const id = getId(item);
  if (pending[id] || cardLocked(item)) return;
  if (held.mode !== 'held') {
    if (event.key !== ' ' && event.key !== 'Spacebar' && event.key !== 'Enter') return;
    event.preventDefault();
    const result = pickUp(grid, id, keyboardText);
    held = result.state;
    announce(result.announcement);
    return;
  }
  if (held.itemId !== id) return;
  const currentTarget = event.currentTarget;
  const isRtl =
    dir === 'rtl' ||
    (dir !== 'ltr' &&
      currentTarget instanceof HTMLElement &&
      currentTarget.ownerDocument.defaultView?.getComputedStyle(currentTarget).direction === 'rtl');
  const key = isRtl
    ? event.key === 'ArrowLeft'
      ? 'ArrowRight'
      : event.key === 'ArrowRight'
        ? 'ArrowLeft'
        : event.key
    : event.key;
  const result = moveIntent(grid, held, { key, shiftKey: event.shiftKey }, rules, keyboardText);
  if (!result.handled) return;
  event.preventDefault();
  held = result.state;
  announce(result.announcement);
  if (result.commit) {
    const itemToMove = itemById(result.commit.itemId);
    if (itemToMove) void commit(result.commit, itemToMove);
  }
  void focusCard(id);
}

// ── Pointer drag on the shared @texuli/drag engine ─────────────────────────
// The gesture tracker owns the drag lifecycle: the 4 px threshold, capture
// (with a document fallback) and pointercancel. A drop goes through `moveTo`,
// which asks `validateMove` and voices any refusal, like the keyboard path.
// The cells and card middles are measured when the drag starts and re-measured only
// on scroll.

/** Vertical middles of the other cards per cell, measured at drag start and on scroll. */
let cellMiddles = new Map<HTMLElement, readonly number[]>();
let stopWatching: (() => void) | null = null;
/** Where the dragged card started, for the pick-up and cancel announcements. */
let origin: DragMessageValues = {};

function measureCells(itemId: string): void {
  const root = ref;
  cellMiddles = new Map(
    [...(root?.querySelectorAll<HTMLElement>('[data-board-cell]') ?? [])].map((cell) => [
      cell,
      [...cell.querySelectorAll<HTMLElement>('[data-board-card]')]
        .filter((card) => card.dataset.itemId !== itemId)
        .map((card) => {
          const box = card.getBoundingClientRect();
          return box.top + box.height / 2;
        }),
    ])
  );
}

/**
 * The cell under the pointer comes from `elementFromPoint`: columns sit in a
 * clipped horizontal scroller, and only the topmost visible cell may take a
 * drop. The index comes from the engine's midpoint search.
 */
function targetAt(point: Point): MoveTarget | null {
  const root = ref;
  const cell = root?.ownerDocument
    .elementFromPoint(point.x, point.y)
    ?.closest<HTMLElement>('[data-board-cell]');
  if (!cell || !root?.contains(cell)) return null;
  return {
    columnId: cell.dataset.columnId ?? '',
    laneId: cell.dataset.laneId ?? '',
    index: midpointIndex(cellMiddles.get(cell) ?? [], point.y),
  };
}

function startDrag(item: T, point: Point): void {
  const id = getId(item);
  measureCells(id);
  const root = ref;
  const doc = root?.ownerDocument;
  if (doc) {
    const onScroll = () => measureCells(id);
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      cancelDrag(true);
    };
    doc.addEventListener('scroll', onScroll, true);
    doc.addEventListener('keydown', onKey, true);
    stopWatching = () => {
      doc.removeEventListener('scroll', onScroll, true);
      doc.removeEventListener('keydown', onKey, true);
    };
  }
  drag = { id, active: true, target: null };
  const from = grid.positions.get(id);
  const cell = from ? grid.cells[from.laneIndex]?.[from.columnIndex] : undefined;
  const column = from ? grid.columns[from.columnIndex] : undefined;
  const lane = from ? grid.lanes[from.laneIndex] : undefined;
  origin = {
    item: getLabel(item),
    position: (cell?.items.findIndex((entry) => getId(entry) === id) ?? 0) + 1,
    total: cell?.items.length ?? 1,
    container: `${column?.title ?? ''}${grid.lanes.length > 1 ? `, ${lane?.title ?? ''}` : ''}`,
  };
  announce(formatDragMessage(messages.pickedUp, origin));
  moveDrag(point);
}

function moveDrag(point: Point): void {
  if (!drag) return;
  const target = targetAt(point);
  drag = { ...drag, target };
}

function endDrag(point: Point): void {
  const current = drag;
  if (!current) return;
  const target = targetAt(point) ?? current.target;
  finishDrag();
  const item = itemById(current.id);
  if (!item || !target) return;
  moveTo(item, target);
}

function finishDrag(): void {
  stopWatching?.();
  stopWatching = null;
  drag = null;
}

function cancelDrag(announceIt: boolean): void {
  const wasDragging = drag !== null;
  finishDrag();
  if (announceIt && wasDragging) announce(formatDragMessage(messages.cancelled, origin));
}

/** Pointer drags from a card handle (keyed by id, so re-renders never re-attach it). */
function dragFrom(id: string): Attachment<HTMLElement> {
  return (node) => {
    let blocked = false;
    // Decided at press time: pending, held, locked or a no-drag area.
    const onDown = (event: PointerEvent) => {
      const item = itemById(id);
      blocked =
        !item ||
        Boolean(pending[id]) ||
        held.mode === 'held' ||
        cardLocked(item) ||
        (event.target instanceof Element && event.target.closest('[data-board-no-drag]') !== null);
    };
    node.addEventListener('pointerdown', onDown, true);
    const dispose = bindPointerGesture(
      node,
      createPointerTracker({
        onStart: (event) => {
          const item = itemById(id);
          if (!blocked && item) startDrag(item, event.point);
        },
        onMove: (event) => moveDrag(event.point),
        onEnd: (event) => endDrag(event.point),
        onCancel: () => cancelDrag(false),
      }),
      { listenOn: node.closest<HTMLElement>('.tx-board') ?? node }
    );
    return () => {
      node.removeEventListener('pointerdown', onDown, true);
      dispose();
    };
  };
}
</script>

<section
  id="board-{uid}"
  {...rest}
  bind:this={ref}
  class={cx(rootClasses({ density, class: className }), drag?.active && 'tx-board--dragging')}
  aria-labelledby={titleId}
  dir={dir}
>
  <svelte:element this={level > 2 ? `h${level - 1}` : 'p'} id={titleId} class="tx-board__sr-only">{labels.board}</svelte:element>
  <p id={instructionsId} class="tx-board__sr-only">{labels.instructions}</p>
  <div class="tx-board__scroller" data-board-scroller>
    <div class="tx-board__columns">
      {#each grid.columns as column, columnIndex (column.id)}
        {@const count = shown.columnCounts.get(column.id) ?? 0}
        {@const wip = evaluateWip(column, count)}
        {@const descriptionId = column.description ? `board-${uid}-column-${columnIndex}-description` : undefined}
        <section class="tx-board__column" data-wip={wip.status}>
          <header class="tx-board__column-header">
            <svelte:element this={`h${level}`} class="tx-board__column-title">{column.title}</svelte:element>
            <span class="tx-board__count" dir="ltr">
              <span aria-hidden="true"
                ><bdi>{new Intl.NumberFormat().format(count)}</bdi>{#if column.wip?.hard
                  !== undefined}<span>/</span
                  ><bdi>{new Intl.NumberFormat().format(column.wip.hard)}</bdi>{/if}</span
              >
              <span class="tx-board__sr-only">{labels.cardCount(count, column.wip?.hard)}</span>
            </span>
            {#if column.description}
              <p id={descriptionId} class="tx-board__column-description">{column.description}</p>
            {/if}
            {#if columnHeader}
              <div class="tx-board__column-header-extra">{@render columnHeader(column, { count })}</div>
            {/if}
          </header>
          {#each grid.lanes as lane, laneIndex (lane.id)}
            {@const shownCell = shown.cells[laneIndex]?.[columnIndex]}
            {@const cellLabel = `${column.title}${grid.lanes.length > 1 ? `, ${lane.title}` : ''}`}
            <div
              class="tx-board__cell"
              role="list"
              aria-label={cellLabel}
              aria-describedby={descriptionId}
              data-board-cell
              data-column-id={column.id}
              data-lane-id={lane.id}
              data-drop-target={drag?.target?.columnId === column.id && drag.target.laneId === lane.id ? 'true' : undefined}
            >
              {#if grid.lanes.length > 1}<svelte:element this={`h${Math.min(6, level + 1)}`} class="tx-board__lane-title">{lane.title}</svelte:element>{/if}
              {#if shownCell?.items.length}
                {#each shownCell.items as item (getId(item))}
                  {@const id = getId(item)}
                  {@const itemLabel = getLabel(item)}
                  {@const locked = cardLocked(item)}
                  {@const destinations = destinationsFor(item)}
                  <div
                    class={cx('tx-board__card', drag?.id === id && drag.active && 'tx-board__card--dragging', held.mode === 'held' && held.itemId === id && 'tx-board__card--held')}
                    role="listitem"
                    data-board-card
                    data-item-id={id}
                    data-locked={locked ? 'true' : undefined}
                  >
                    <div class="tx-board__card-actions">
                      {#if MoveMenu}
                        <MoveMenu
                          open={openMenuId === id}
                          disabled={pending[id] || locked}
                          label={labels.moveMenu(itemLabel)}
                          menuLabel={labels.moveMenuLabel(itemLabel)}
                          {destinations}
                          onSelect={(destination) => onMenuSelect(item, destination)}
                          onOpenChange={(next) => {
                            openMenuId = next ? id : openMenuId === id ? null : openMenuId;
                          }}
                        />
                      {:else}
                        <button
                          type="button"
                          class="tx-board__move-menu"
                          data-board-move-menu
                          aria-label={labels.moveMenu(itemLabel)}
                          aria-haspopup="menu"
                          aria-expanded="false"
                          disabled={pending[id] || locked}
                          onfocus={prefetchMoveMenu}
                          onpointerenter={prefetchMoveMenu}
                          onclick={() => void openMoveMenu(item)}
                        >
                          <span class="tx-board__move-menu-glyph" aria-hidden="true">⋮</span>
                        </button>
                      {/if}
                      <button
                        class="tx-board__handle"
                        type="button"
                        data-board-handle
                        aria-label={labels.dragHandle(itemLabel)}
                        aria-describedby={instructionsId}
                        aria-pressed={held.mode === 'held' && held.itemId === id}
                        disabled={pending[id] || locked}
                        onkeydown={(event) => onCardKey(event, item)}
                        {@attach dragFrom(id)}
                      >
                        <span class="tx-board__grip" aria-hidden="true">⠿</span>
                      </button>
                    </div>
                    <div class="tx-board__content">
                      {@render card(item, { pending: pending[id] ?? false })}
                      {#if pending[id]}<span class="tx-board__pending" role="status">{labels.savingMove}</span>{/if}
                    </div>
                  </div>
                {/each}
              {:else}
                <div class="tx-board__empty" role="listitem">{labels.emptyCell}</div>
              {/if}
            </div>
          {/each}
          {#if columnFooter}
            <footer class="tx-board__column-footer">{@render columnFooter(column, { count })}</footer>
          {/if}
        </section>
      {/each}
    </div>
  </div>
  {#if grid.unplaced.length > 0}
    <section class="tx-board__unplaced" aria-label={labels.unplaced}>
      <svelte:element this={`h${level}`} class="tx-board__column-title">{labels.unplaced}</svelte:element>
      {#each grid.unplaced as item (getId(item))}
        {@render card(item, { pending: false })}
      {/each}
    </section>
  {/if}
  <p class="tx-board__status" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>
  <!-- Tests await this once the lazy move-menu chunk has mounted. -->
  {#if menuReady}
    <span class="tx-board__sr-only" data-board-move-menu-chunk="" data-ready="">Move menu ready</span>
  {/if}
</section>

<style>
  @layer tx.components {
    .tx-board {
      color: var(--tx-foreground, var(--tx-text, CanvasText));
      color-scheme: light dark;
      min-inline-size: 0;
    }

    .tx-board__sr-only {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
      border: 0;
    }

    /*
     * Positioned, so it is the containing block of the absolute screen-reader
     * labels inside the columns: without it they escape the scroll box at
     * their static position and widen the page on narrow screens (G76).
     */
    .tx-board__scroller {
      position: relative;
      overflow-x: auto;
      overscroll-behavior-inline: contain;
      padding: var(--tx-space-1);
    }

    .tx-board__columns {
      display: grid;
      grid-auto-columns: minmax(15rem, 1fr);
      grid-auto-flow: column;
      align-items: start;
      gap: var(--tx-board-column-gap, var(--tx-space-4));
      min-inline-size: max-content;
    }

    .tx-board__column {
      min-inline-size: 15rem;
      border: var(--tx-border-width-thin) solid var(--tx-border, CanvasText);
      border-radius: var(--tx-board-column-radius, var(--tx-shape-radius-xl));
      background: var(--tx-muted, Canvas);
    }

    .tx-board__column[data-wip='warn'] .tx-board__column-header,
    .tx-board__column[data-wip='blocked'] .tx-board__column-header {
      border-block-end: var(--tx-border-width-thick) solid var(--tx-warning, CanvasText);
    }

    .tx-board__column[data-wip='blocked'] .tx-board__column-header {
      border-block-end-color: var(--tx-destructive, CanvasText);
    }

    .tx-board__column-header {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--tx-space-3);
      padding: var(--tx-board-column-padding, var(--tx-space-3));
      border-block-end: var(--tx-border-width-thin) solid var(--tx-border, CanvasText);
    }

    .tx-board__column-title {
      margin: 0;
      font-size: var(--tx-type-body-size);
    }

    .tx-board__column-footer {
      padding: var(--tx-space-2) var(--tx-space-3) var(--tx-space-3);
    }

    .tx-board__column-description,
    .tx-board__column-header-extra {
      flex: 1 0 100%;
      min-inline-size: 0;
    }

    .tx-board__column-description {
      margin: 0;
      color: var(--tx-muted-foreground, CanvasText);
      font-size: var(--tx-type-label-size);
    }

    .tx-board__count {
      display: inline-flex;
      align-items: baseline;
      gap: 0.25em;
    }

    .tx-board__cell {
      display: grid;
      align-content: start;
      min-block-size: 5rem;
      padding: var(--tx-space-2);
    }

    .tx-board__cell[data-drop-target='true'] {
      outline: 2px dashed var(--tx-ring, Highlight);
      outline-offset: -2px;
    }

    .tx-board--comfortable .tx-board__cell { gap: var(--tx-space-2); }
    .tx-board--compact .tx-board__cell { gap: var(--tx-space-1); padding: calc(var(--tx-space-unit) * 1.5); }

    .tx-board__lane-title {
      margin: 0;
      font-size: var(--tx-type-label-size);
    }

    .tx-board__card {
      min-inline-size: 0;
      border: var(--tx-border-width-thin) solid var(--tx-border, CanvasText);
      border-radius: var(--tx-board-card-radius, var(--tx-shape-radius-lg));
      background: var(--tx-surface, Canvas);
      box-shadow: var(--tx-board-card-elevation, var(--tx-elevation-1));
    }

    .tx-board__card--dragging,
    .tx-board__card--held {
      outline: 2px dashed var(--tx-ring, Highlight);
      outline-offset: 2px;
    }

    .tx-board__card-actions {
      display: flex;
      float: inline-end;
      align-items: center;
      gap: calc(var(--tx-space-unit) * 0.5);
      padding-block-start: var(--tx-space-1);
      padding-inline-end: var(--tx-space-1);
    }

    .tx-board__handle,
    .tx-board__move-menu {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      inline-size: 2.75rem;
      min-block-size: 2.75rem;
      border: 0;
      border-radius: var(--tx-shape-radius-lg);
      padding: var(--tx-space-3);
      background: transparent;
      color: inherit;
      cursor: pointer;
    }

    .tx-board__handle {
      cursor: grab;
      touch-action: none;
    }

    .tx-board__handle:active { cursor: grabbing; }
    .tx-board__handle:disabled,
    .tx-board__move-menu:disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }
    .tx-board__grip,
    .tx-board__move-menu-glyph {
      color: var(--tx-foreground, CanvasText);
      font-size: 1.1rem;
      line-height: 1;
    }
    .tx-board__scroller:focus-visible,
    .tx-board__handle:focus-visible,
    .tx-board__move-menu:focus-visible {
      outline: var(--tx-focus-ring-width, 2px) solid var(--tx-ring, Highlight);
      outline-offset: 2px;
    }
    .tx-board__content { padding: var(--tx-space-3); }
    .tx-board__pending { display: block; margin-block-start: var(--tx-space-2); font-size: var(--tx-type-label-size); }
    .tx-board__empty {
      margin: 0;
      padding: var(--tx-space-3);
      color: var(--tx-foreground, CanvasText);
    }
    .tx-board__unplaced { margin-block-start: var(--tx-space-4); border: var(--tx-border-width-thin) solid var(--tx-destructive, CanvasText); padding: var(--tx-space-3); }
    .tx-board__status { min-block-size: 1.5em; margin-block: var(--tx-space-2) 0; }

    @media (prefers-reduced-motion: no-preference) {
      .tx-board__card { transition: outline-color 120ms ease; }
    }

    @media (forced-colors: active) {
      .tx-board__column,
      .tx-board__column-header,
      .tx-board__card,
      .tx-board__unplaced { border-color: CanvasText; }
      .tx-board__column[data-wip='warn'] .tx-board__column-header,
      .tx-board__column[data-wip='blocked'] .tx-board__column-header { border-block-end-color: Highlight; }
    }
  }
</style>
