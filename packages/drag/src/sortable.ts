import {
  type CollisionStrategy,
  closestCenter,
  type Droppable,
  firstHit,
  midpointIndex,
  pointerWithin,
} from './collision.ts';
import type { Orientation, Point, Rect, TextDirection } from './geometry.ts';
import { rectCenter, rectContains } from './geometry.ts';
import {
  DEFAULT_DRAG_MESSAGES,
  type DragMessages,
  type DragMessageValues,
  formatDragMessage,
  formatRefusal,
} from './messages.ts';
import {
  ALLOW,
  createDragSession,
  type DragInput,
  type DragIntent,
  type DragLifecycleEvent,
  type DragPhase,
  type DropVerdict,
  type RefusalReason,
  refuse,
} from './session.ts';

// ---------------------------------------------------------------------------
// Model

export interface GroupContext {
  readonly from: SortableContainer;
  readonly to: SortableContainer;
  readonly ids: readonly string[];
}

/** Whether items may leave a container: `'clone'` leaves the original in place. */
export type PullRule =
  | boolean
  | 'clone'
  | readonly string[]
  | ((context: GroupContext) => boolean | 'clone');
/** Which groups a container accepts. Default: its own group only. */
export type PutRule = boolean | readonly string[] | ((context: GroupContext) => boolean);

export interface SortableGroup {
  readonly name: string;
  /** Default true. An array names the groups items may go to. */
  readonly pull?: PullRule;
  /** Default: same group name. `true` accepts any group; an array names groups. */
  readonly put?: PutRule;
}

/** One list. Nest lists by setting `parentId` to the item that owns them. */
export interface SortableContainer {
  readonly id: string;
  readonly items: readonly string[];
  readonly orientation?: Orientation;
  /** A group name or rules. Without a group, items stay in this list. */
  readonly group?: string | SortableGroup;
  /** False keeps the order fixed (items may still leave or arrive). Default true. */
  readonly sort?: boolean;
  readonly maxItems?: number;
  /** The item this list belongs to (a tree child list), or null for a root list. */
  readonly parentId?: string | null;
  readonly disabled?: boolean;
  /** Items that never move and keep their index while others move around them. */
  readonly locked?: readonly string[];
}

export interface ItemLocation {
  readonly containerId: string;
  readonly index: number;
}

export interface SortableModel {
  readonly containers: readonly SortableContainer[];
  container(id: string): SortableContainer | undefined;
  locate(itemId: string): ItemLocation | undefined;
  /** Lists owned by an item (tree children), in container order. */
  childContainers(itemId: string): readonly string[];
  /** Position of a container in `containers` (stable ordering for multi-drag). */
  order(containerId: string): number;
  isLocked(itemId: string): boolean;
  has(itemId: string): boolean;
}

/** Indexes containers once. Throws on duplicate container or item ids. */
export function createSortableModel(containers: readonly SortableContainer[]): SortableModel {
  const byId = new Map<string, SortableContainer>();
  const order = new Map<string, number>();
  const locations = new Map<string, ItemLocation>();
  const children = new Map<string, string[]>();
  const locked = new Set<string>();
  containers.forEach((container, position) => {
    if (byId.has(container.id)) throw new RangeError(`Duplicate container id "${container.id}".`);
    byId.set(container.id, container);
    order.set(container.id, position);
    container.items.forEach((item, index) => {
      if (locations.has(item)) throw new RangeError(`Duplicate item id "${item}".`);
      locations.set(item, { containerId: container.id, index });
    });
    for (const item of container.locked ?? []) locked.add(item);
    if (container.parentId != null) {
      const list = children.get(container.parentId) ?? [];
      list.push(container.id);
      children.set(container.parentId, list);
    }
  });
  return {
    containers,
    container: (id) => byId.get(id),
    locate: (id) => locations.get(id),
    childContainers: (id) => children.get(id) ?? [],
    order: (id) => order.get(id) ?? -1,
    isLocked: (id) => locked.has(id),
    has: (id) => locations.has(id),
  };
}

// ---------------------------------------------------------------------------
// Moves

/**
 * Where the dragged items go. `insert` mode: `index` is the final index of
 * the first moved item in the target list. `swap` mode: the index of the
 * item to swap with.
 */
export interface SortableTarget {
  readonly containerId: string;
  readonly index: number;
}

export type SortableMode = 'insert' | 'swap';

export interface SortableRules {
  readonly mode?: SortableMode;
  /** True when an item may not be dragged at all. */
  readonly filter?: (itemId: string) => boolean;
  /** Extra locked items on top of each container's `locked`. */
  readonly isLocked?: (itemId: string) => boolean;
  /** The final word on a planned move. */
  readonly canDrop?: (move: SortableMove, model: SortableModel) => DropVerdict;
  /** Deepest allowed item level (root items are level 1). */
  readonly maxDepth?: number;
  /** Id for a clone; `taken` reports ids already in use. Default `<id>-copy[-n]`. */
  readonly cloneId?: (itemId: string, taken: (id: string) => boolean) => string;
}

export interface MovedItem {
  readonly id: string;
  readonly containerId: string;
  readonly index: number;
}

/** A planned move: what moves where, and every changed list's next order. */
export interface SortableMove {
  readonly kind: 'move' | 'clone' | 'swap';
  readonly items: readonly MovedItem[];
  readonly to: string;
  /** Final index of the first moved item in `to`. */
  readonly index: number;
  /** Ids placed in `to` (clone ids for clones). */
  readonly placed: readonly string[];
  readonly swapWith?: string;
  /** Next item order of every list the move changes. */
  readonly next: Readonly<Record<string, readonly string[]>>;
  readonly changed: boolean;
}

export type MovePlan =
  | { readonly ok: true; readonly move: SortableMove }
  | { readonly ok: false; readonly reason: RefusalReason };

const groupOf = (container: SortableContainer): SortableGroup | null =>
  container.group === undefined
    ? null
    : typeof container.group === 'string'
      ? { name: container.group }
      : container.group;

/** Pull verdict for moving `ids` from `from` into `to` (different lists). */
export function pullRule(context: GroupContext): boolean | 'clone' {
  const group = groupOf(context.from);
  const target = groupOf(context.to);
  if (!group || !target) return false;
  const rule = group.pull ?? true;
  if (typeof rule === 'function') return rule(context);
  if (Array.isArray(rule)) return rule.includes(target.name);
  return rule as boolean | 'clone';
}

/** Put verdict: whether `to` accepts items from `from`. */
export function putRule(context: GroupContext): boolean {
  const group = groupOf(context.from);
  const target = groupOf(context.to);
  if (!group || !target) return false;
  const rule = target.put;
  if (rule === undefined) return group.name === target.name;
  if (typeof rule === 'function') return rule(context);
  if (Array.isArray(rule)) return rule.includes(group.name);
  return rule as boolean;
}

/** Re-seats locked items at their original indices after a naive reorder. */
export function pinLocked(
  original: readonly string[],
  naive: readonly string[],
  isLocked: (id: string) => boolean
): readonly string[] {
  // Fast path: most lists lock nothing, so skip the set building.
  if (!original.some(isLocked)) return naive;
  const present = new Set(naive);
  const pins = new Map<number, string>();
  original.forEach((id, index) => {
    if (index < naive.length && present.has(id) && isLocked(id)) pins.set(index, id);
  });
  if (pins.size === 0) return naive;
  const pinned = new Set(pins.values());
  const rest = naive.filter((id) => !pinned.has(id));
  const out: string[] = [];
  let next = 0;
  for (let position = 0; position < naive.length; position += 1) {
    const pin = pins.get(position);
    if (pin !== undefined) out.push(pin);
    else out.push(rest[next++] as string);
  }
  return out;
}

const sameOrder = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id, index) => id === b[index]);

/** Ancestor item ids of a container (nearest first), bounded against cyclic host data. */
function ancestors(model: SortableModel, containerId: string): string[] {
  const out: string[] = [];
  let current = model.container(containerId);
  for (let guard = model.containers.length; current?.parentId != null && guard > 0; guard -= 1) {
    out.push(current.parentId);
    const at = model.locate(current.parentId);
    current = at ? model.container(at.containerId) : undefined;
  }
  return out;
}

/** Levels in an item's subtree (1 for a leaf). Iterative and cycle-safe. */
function subtreeHeight(model: SortableModel, itemId: string): number {
  const seen = new Set([itemId]);
  let level = [itemId];
  let height = 0;
  while (level.length > 0) {
    height += 1;
    const next: string[] = [];
    for (const id of level) {
      for (const child of model.childContainers(id)) {
        for (const item of model.container(child)?.items ?? []) {
          if (seen.has(item)) continue;
          seen.add(item);
          next.push(item);
        }
      }
    }
    level = next;
  }
  return height;
}

function defaultCloneId(id: string, taken: (id: string) => boolean): string {
  let candidate = `${id}-copy`;
  for (let n = 2; taken(candidate); n += 1) candidate = `${id}-copy-${n}`;
  return candidate;
}

/**
 * Plans a move without changing anything: checks every rule (locked,
 * filters, groups, sort, capacity, cycles, depth, `canDrop`) and returns the
 * next order of each changed list, or the first refusal reason.
 */
export function planMove(
  model: SortableModel,
  ids: readonly string[],
  target: SortableTarget,
  rules: SortableRules = {}
): MovePlan {
  const locked = (id: string) => model.isLocked(id) || (rules.isLocked?.(id) ?? false);
  const unique = [...new Set(ids)];
  const items: MovedItem[] = [];
  for (const id of unique) {
    const at = model.locate(id);
    if (!at) return { ok: false, reason: 'unknown-item' };
    items.push({ id, ...at });
  }
  if (items.length === 0) return { ok: false, reason: 'unknown-item' };
  items.sort(
    (a, b) => model.order(a.containerId) - model.order(b.containerId) || a.index - b.index
  );
  for (const item of items) {
    if (rules.filter?.(item.id)) return { ok: false, reason: 'filtered' };
    if (locked(item.id)) return { ok: false, reason: 'locked' };
    if (model.container(item.containerId)?.disabled) return { ok: false, reason: 'disabled' };
  }
  const to = model.container(target.containerId);
  if (!to || !Number.isFinite(target.index)) return { ok: false, reason: 'no-target' };
  if (to.disabled) return { ok: false, reason: 'disabled' };
  const moving = new Set(items.map((item) => item.id));
  if (ancestors(model, to.id).some((id) => moving.has(id))) return { ok: false, reason: 'cycle' };

  const first = items[0] as MovedItem;
  const plan =
    (rules.mode ?? 'insert') === 'swap'
      ? planSwap(model, first, items.length, to, target.index, locked)
      : planInsert(model, items, moving, to, target.index, locked, rules);
  if (!plan.ok) return plan;

  if (rules.maxDepth !== undefined && plan.move.changed) {
    const depth = ancestors(model, to.id).length;
    const height = Math.max(...items.map((item) => subtreeHeight(model, item.id)));
    if (depth + height > rules.maxDepth) return { ok: false, reason: 'depth' };
  }
  if (rules.canDrop && plan.move.changed) {
    const verdict = rules.canDrop(plan.move, model);
    if (!verdict.ok) return verdict;
  }
  return plan;
}

function planInsert(
  model: SortableModel,
  items: readonly MovedItem[],
  moving: ReadonlySet<string>,
  to: SortableContainer,
  index: number,
  locked: (id: string) => boolean,
  rules: SortableRules
): MovePlan {
  const ids = items.map((item) => item.id);
  const clones = new Set<string>();
  const sources = new Set(items.map((item) => item.containerId));
  for (const sourceId of sources) {
    const from = model.container(sourceId) as SortableContainer;
    if (sourceId === to.id) {
      if (to.sort === false) return { ok: false, reason: 'sort' };
      continue;
    }
    const sourceIds = items.filter((item) => item.containerId === sourceId).map((item) => item.id);
    const context = { from, to, ids: sourceIds };
    const pull = pullRule(context);
    if (pull === false) return { ok: false, reason: 'pull' };
    if (!putRule(context)) return { ok: false, reason: 'put' };
    if (pull === 'clone') for (const id of sourceIds) clones.add(id);
  }

  const remaining = to.items.filter((id) => !moving.has(id));
  if (to.maxItems !== undefined && remaining.length + ids.length > to.maxItems) {
    // Same-list reorders never grow a list, so only arrivals can overflow it.
    if (sources.size > 1 || !sources.has(to.id)) return { ok: false, reason: 'full' };
  }
  const taken = new Set<string>();
  const cloneId = rules.cloneId ?? defaultCloneId;
  const placed = ids.map((id) => {
    if (!clones.has(id)) return id;
    const copy = cloneId(id, (candidate) => model.has(candidate) || taken.has(candidate));
    taken.add(copy);
    return copy;
  });
  const at = Math.min(Math.max(0, Math.trunc(index)), remaining.length);
  const next: Record<string, readonly string[]> = {};
  next[to.id] = pinLocked(
    to.items,
    [...remaining.slice(0, at), ...placed, ...remaining.slice(at)],
    locked
  );
  for (const sourceId of sources) {
    if (sourceId === to.id) continue;
    const from = model.container(sourceId) as SortableContainer;
    if (items.every((item) => item.containerId !== sourceId || clones.has(item.id))) continue;
    next[sourceId] = pinLocked(
      from.items,
      from.items.filter((id) => !moving.has(id) || clones.has(id)),
      locked
    );
  }
  const changed = Object.entries(next).some(
    ([id, order]) => !sameOrder(order, model.container(id)?.items ?? [])
  );
  const move: SortableMove = {
    kind: clones.size > 0 ? 'clone' : 'move',
    items,
    to: to.id,
    index: (next[to.id] as readonly string[]).indexOf(placed[0] as string),
    placed,
    next,
    changed,
  };
  return { ok: true, move };
}

function planSwap(
  model: SortableModel,
  item: MovedItem,
  count: number,
  to: SortableContainer,
  index: number,
  locked: (id: string) => boolean
): MovePlan {
  if (count !== 1) return { ok: false, reason: 'swap-multi' };
  const other = to.items[Math.trunc(index)];
  if (other === undefined) return { ok: false, reason: 'no-target' };
  if (other !== item.id && locked(other)) return { ok: false, reason: 'locked' };
  const from = model.container(item.containerId) as SortableContainer;
  const next: Record<string, readonly string[]> = {};
  if (from.id === to.id) {
    if (to.sort === false && other !== item.id) return { ok: false, reason: 'sort' };
    const order = [...to.items];
    order[item.index] = other;
    order[Math.trunc(index)] = item.id;
    next[to.id] = order;
  } else {
    const there = { from, to, ids: [item.id] };
    const back = { from: to, to: from, ids: [other] };
    if (pullRule(there) !== true || pullRule(back) !== true) return { ok: false, reason: 'pull' };
    if (!putRule(there) || !putRule(back)) return { ok: false, reason: 'put' };
    if (ancestors(model, from.id).includes(other)) return { ok: false, reason: 'cycle' };
    const source = [...from.items];
    source[item.index] = other;
    const target = [...to.items];
    target[Math.trunc(index)] = item.id;
    next[from.id] = source;
    next[to.id] = target;
  }
  return {
    ok: true,
    move: {
      kind: 'swap',
      items: [item],
      to: to.id,
      index: Math.trunc(index),
      placed: [item.id],
      swapWith: other,
      next,
      changed: other !== item.id,
    },
  };
}

/** Applies a planned move to a container list (pure). */
export function applyMove(
  containers: readonly SortableContainer[],
  move: SortableMove
): SortableContainer[] {
  return containers.map((container) => {
    const next = move.next[container.id];
    return next ? { ...container, items: next } : container;
  });
}

// ---------------------------------------------------------------------------
// Keyboard

export interface KeyboardTargetOptions {
  /** movePrev/moveNext past a list's edge continue in the previous/next list. */
  readonly crossContainers?: boolean;
}

/** The starting target of a drag: where the first item already sits. */
export function originTarget(model: SortableModel, ids: readonly string[]): SortableTarget | null {
  const at = ids.length > 0 ? model.locate(ids[0] as string) : undefined;
  if (!at) return null;
  const container = model.container(at.containerId) as SortableContainer;
  const moving = new Set(ids);
  let before = 0;
  for (let i = 0; i < at.index; i += 1) if (moving.has(container.items[i] as string)) before += 1;
  return { containerId: at.containerId, index: at.index - before };
}

const remainingCount = (model: SortableModel, containerId: string, moving: ReadonlySet<string>) =>
  (model.container(containerId)?.items ?? []).reduce((n, id) => (moving.has(id) ? n : n + 1), 0);

/**
 * The next keyboard target for an intent, from the current target. Tree
 * semantics: `moveInto` nests under the previous item's child list,
 * `moveOut` places after the parent item. Returns a refusal at an edge.
 */
export function keyboardTarget(
  model: SortableModel,
  ids: readonly string[],
  intent: DragIntent,
  current: SortableTarget,
  options: KeyboardTargetOptions = {}
): SortableTarget | { readonly reason: RefusalReason } {
  const moving = new Set(ids);
  const container = model.container(current.containerId);
  if (!container) return { reason: 'no-target' };
  const length = remainingCount(model, container.id, moving);
  if (intent === 'movePrev' || intent === 'moveNext') {
    const step = intent === 'movePrev' ? -1 : 1;
    const index = current.index + step;
    if (index >= 0 && index <= length) return { containerId: container.id, index };
    if (!options.crossContainers) return { reason: 'edge' };
    const siblings = model.containers.filter(
      (c) => !c.disabled && (c.parentId ?? null) === (container.parentId ?? null)
    );
    const neighbour = siblings[siblings.findIndex((c) => c.id === container.id) + step];
    if (!neighbour) return { reason: 'edge' };
    return {
      containerId: neighbour.id,
      index: step < 0 ? remainingCount(model, neighbour.id, moving) : 0,
    };
  }
  if (intent === 'moveInto') {
    const remaining = container.items.filter((id) => !moving.has(id));
    const previous = remaining[current.index - 1];
    if (previous === undefined) return { reason: 'edge' };
    const child = model.childContainers(previous)[0];
    if (child === undefined) return { reason: 'no-target' };
    return { containerId: child, index: remainingCount(model, child, moving) };
  }
  if (intent === 'moveOut') {
    if (container.parentId == null) return { reason: 'edge' };
    const parent = model.locate(container.parentId);
    if (!parent) return { reason: 'no-target' };
    const outer = model.container(parent.containerId) as SortableContainer;
    const remaining = outer.items.filter((id) => !moving.has(id));
    return { containerId: outer.id, index: remaining.indexOf(container.parentId) + 1 };
  }
  return { reason: 'no-target' };
}

export interface KeyIntentOptions {
  readonly orientation?: Orientation;
  readonly direction?: TextDirection;
  /** Tree lists: the cross-axis arrows nest (`moveInto`) and un-nest (`moveOut`). */
  readonly nested?: boolean;
  /** Whether a drag is running (Space/Enter then drop, Tab cancels). */
  readonly dragging?: boolean;
}

/**
 * Maps a `KeyboardEvent.key` to a drag intent, flipping the inline arrows
 * in right-to-left text. Hosts may use their own keymap instead.
 */
export function intentFromKey(key: string, options: KeyIntentOptions = {}): DragIntent | null {
  const dragging = options.dragging ?? false;
  if (key === ' ' || key === 'Enter') return dragging ? 'drop' : 'pickUp';
  if (!dragging) return null;
  if (key === 'Escape' || key === 'Tab') return 'cancel';
  const rtl = options.direction === 'rtl';
  const inlineForward = rtl ? 'ArrowLeft' : 'ArrowRight';
  const inlineBack = rtl ? 'ArrowRight' : 'ArrowLeft';
  if ((options.orientation ?? 'vertical') === 'vertical') {
    if (key === 'ArrowUp') return 'movePrev';
    if (key === 'ArrowDown') return 'moveNext';
    if (options.nested && key === inlineForward) return 'moveInto';
    if (options.nested && key === inlineBack) return 'moveOut';
    return null;
  }
  if (key === inlineBack) return 'movePrev';
  if (key === inlineForward) return 'moveNext';
  if (options.orientation === 'grid') {
    if (key === 'ArrowUp') return 'movePrev';
    if (key === 'ArrowDown') return 'moveNext';
  } else if (options.nested) {
    if (key === 'ArrowDown') return 'moveInto';
    if (key === 'ArrowUp') return 'moveOut';
  }
  return null;
}

// ---------------------------------------------------------------------------
// Pointer

export interface MeasuredItem {
  readonly id: string;
  readonly rect: Rect;
  /** The item's own child list, for tree drops "into" a row. */
  readonly childContainerId?: string;
}

export interface MeasuredContainer {
  readonly id: string;
  readonly rect: Rect;
  readonly orientation?: Orientation;
  readonly direction?: TextDirection;
  readonly disabled?: boolean;
  /** Items in list order, rects snapshotted at drag start (or after a scroll). */
  readonly items: readonly MeasuredItem[];
}

export interface PreparedSortableContainer extends MeasuredContainer {
  readonly keys: Float64Array;
  readonly sorted: boolean;
  readonly indexById: ReadonlyMap<string, number>;
}

/** Rects prepared for O(log n) hit-testing. Rebuild it on scroll only. */
export interface SortableSnapshot {
  readonly containers: readonly PreparedSortableContainer[];
  readonly droppables: readonly Droppable[];
  container(id: string): PreparedSortableContainer | undefined;
}

const axisKey = (container: MeasuredContainer, p: Point) =>
  (container.orientation ?? 'vertical') === 'horizontal'
    ? container.direction === 'rtl'
      ? -p.x
      : p.x
    : p.y;

export function createSortableSnapshot(measured: readonly MeasuredContainer[]): SortableSnapshot {
  const containers = measured.map((container): PreparedSortableContainer => {
    const keys = new Float64Array(container.items.length);
    let sorted = true;
    container.items.forEach((item, index) => {
      keys[index] = axisKey(container, rectCenter(item.rect));
      if (index > 0 && (keys[index] as number) < (keys[index - 1] as number)) sorted = false;
    });
    const indexById = new Map(container.items.map((item, index) => [item.id, index]));
    return { ...container, keys, sorted, indexById };
  });
  const byId = new Map(containers.map((container) => [container.id, container]));
  return {
    containers,
    droppables: containers.map(({ id, rect, disabled }) => ({
      id,
      rect,
      disabled: disabled ?? false,
    })),
    container: (id) => byId.get(id),
  };
}

export interface PointerTargetOptions {
  readonly model: SortableModel;
  /** Ids being dragged (excluded from the final index). */
  readonly activeIds: readonly string[];
  readonly mode?: SortableMode;
  /** Picks the list under the pointer. Default: `firstHit(pointerWithin, closestCenter)`. */
  readonly collision?: CollisionStrategy;
  /** Picks the insertion slot in a list. Default: midpoints (lists) or nearest center (grids). */
  readonly slot?: (container: PreparedSortableContainer, pointer: Point) => number;
  /** Trailing inline fraction of a row that drops into its child list (e.g. 1/3). */
  readonly nestZone?: number;
}

const defaultCollision = firstHit(pointerWithin, closestCenter);

function nearestItem(container: PreparedSortableContainer, pointer: Point): number {
  let best = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  container.items.forEach((item, index) => {
    const c = rectCenter(item.rect);
    const d = (c.x - pointer.x) ** 2 + (c.y - pointer.y) ** 2;
    if (d < bestDistance) {
      bestDistance = d;
      best = index;
    }
  });
  return best;
}

/** Default slot strategy: midpoint binary search, or nearest center then inline half for grids. */
export function defaultSlot(container: PreparedSortableContainer, pointer: Point): number {
  if (container.orientation === 'grid') {
    const index = nearestItem(container, pointer);
    if (index < 0) return 0;
    const c = rectCenter((container.items[index] as MeasuredItem).rect);
    const after = container.direction === 'rtl' ? pointer.x < c.x : pointer.x >= c.x;
    return after ? index + 1 : index;
  }
  const key = axisKey(container, pointer);
  if (container.sorted) return midpointIndex(container.keys, key);
  const index = Array.prototype.findIndex.call(container.keys, (k: number) => key < k);
  return index === -1 ? container.keys.length : index;
}

/** The item whose rect holds the pointer, near a slot (checks the two neighbours). */
function itemAt(container: PreparedSortableContainer, pointer: Point, slot: number): number {
  for (const index of [slot - 1, slot]) {
    const item = container.items[index];
    if (item && rectContains(item.rect, pointer)) return index;
  }
  if (container.orientation === 'grid') {
    return container.items.findIndex((item) => rectContains(item.rect, pointer));
  }
  return -1;
}

/** Maps a pointer to a sortable target using the snapshot. Null when nothing qualifies. */
export function pointerTarget(
  snapshot: SortableSnapshot,
  pointer: Point,
  options: PointerTargetOptions
): SortableTarget | null {
  const hit = (options.collision ?? defaultCollision)({ pointer, droppables: snapshot.droppables });
  const container = hit ? snapshot.container(hit.id) : undefined;
  if (!container) return null;
  const slot = (options.slot ?? defaultSlot)(container, pointer);
  const active = new Set(options.activeIds);

  if (options.mode === 'swap') {
    const index = itemAt(container, pointer, slot);
    const item = container.items[index];
    if (!item) return null;
    return { containerId: container.id, index };
  }

  if (options.nestZone !== undefined && options.nestZone > 0) {
    const item = container.items[itemAt(container, pointer, slot)];
    if (
      item?.childContainerId &&
      !active.has(item.id) &&
      options.model.container(item.childContainerId)
    ) {
      const zone = item.rect.width * Math.min(1, options.nestZone);
      const inZone =
        container.direction === 'rtl'
          ? pointer.x <= item.rect.x + zone
          : pointer.x >= item.rect.x + item.rect.width - zone;
      if (inZone) {
        return {
          containerId: item.childContainerId,
          index: remainingCount(options.model, item.childContainerId, active),
        };
      }
    }
  }

  let before = 0;
  for (const id of active) {
    const index = container.indexById.get(id);
    if (index !== undefined && index < slot) before += 1;
  }
  return { containerId: container.id, index: slot - before };
}

/** True when a DOM event target sits inside an element matching `selector` (handles, filters). */
export function matchesSelector(
  target: { closest?: (selector: string) => unknown } | null | undefined,
  selector: string
): boolean {
  return typeof target?.closest === 'function' && target.closest(selector) != null;
}

// ---------------------------------------------------------------------------
// Controller

export interface SortableSource {
  readonly ids: readonly string[];
  readonly origin: SortableTarget;
}

export interface SortableChangeEvent {
  readonly type: 'add' | 'remove' | 'update';
  readonly containerId: string;
  readonly move: SortableMove;
}

export type SortableEvent =
  | DragLifecycleEvent<SortableSource, SortableTarget>
  | SortableChangeEvent;

export interface SortableOptions extends SortableRules {
  readonly containers: readonly SortableContainer[];
  /** Pointer travel before a drag starts. Default 4. */
  readonly threshold?: number;
  /** Drags start only from a handle (`pickUp(id, { fromHandle: true })`). */
  readonly requireHandle?: boolean;
  readonly crossContainers?: boolean;
  /** Rewrites the drag translation (compose `modifiers` here). */
  readonly transform?: (delta: Point) => Point;
  readonly messages?: DragMessages;
  readonly formatNumber?: (value: number) => string;
  /** Polite live-region announcer (e.g. `@texuli/core/announcer`). */
  readonly announce?: (message: string) => void;
  readonly labelOf?: (itemId: string) => string;
  readonly containerLabelOf?: (containerId: string) => string;
  readonly onEvent?: (event: SortableEvent) => void;
}

export interface PickUpOptions {
  readonly input?: DragInput;
  readonly point?: Point;
  readonly fromHandle?: boolean;
  /** Multi-drag: the selection; it moves when it includes the item. */
  readonly selection?: readonly string[];
}

export interface SortableState {
  readonly phase: DragPhase;
  readonly input: DragInput | null;
  readonly source: SortableSource | null;
  readonly target: SortableTarget | null;
  readonly verdict: DropVerdict | null;
  /** The planned move for the current target (preview), when allowed. */
  readonly move: SortableMove | null;
  readonly delta: Point;
}

export interface SortableController {
  readonly state: SortableState;
  readonly model: SortableModel;
  /** Replace the lists (after the host applied a drop, or new data). */
  setContainers(containers: readonly SortableContainer[]): void;
  pickUp(itemId: string, options?: PickUpOptions): DropVerdict;
  /** Pointer travel; with a snapshot it also hit-tests and updates the target. */
  pointerMove(
    point: Point,
    snapshot?: SortableSnapshot,
    options?: Partial<PointerTargetOptions>
  ): SortableTarget | null;
  over(target: SortableTarget | null): DropVerdict | null;
  /** Keyboard intents; `pickUp` needs the focused item id. */
  intent(intent: DragIntent, itemId?: string): DropVerdict | null;
  /** Commits the current target: returns the move (apply it, then `setContainers`). */
  drop(): SortableMove | null;
  cancel(reason?: RefusalReason): void;
}

/**
 * A sortable controller: session + rules + hit-testing + announcements.
 * It never mutates the host's data; `drop()` returns the move to apply.
 */
export function createSortable(options: SortableOptions): SortableController {
  let model = createSortableModel(options.containers);
  const messages = options.messages ?? DEFAULT_DRAG_MESSAGES;
  const labelOf = options.labelOf ?? ((id: string) => id);
  const containerLabel = options.containerLabelOf ?? ((id: string) => id);
  let planned: { target: SortableTarget; plan: MovePlan } | null = null;

  const plan = (source: SortableSource, target: SortableTarget): MovePlan => {
    if (
      planned &&
      planned.target.containerId === target.containerId &&
      planned.target.index === target.index
    ) {
      return planned.plan;
    }
    const result = planMove(model, source.ids, target, options);
    planned = { target, plan: result };
    return result;
  };

  const say = (message: string) => options.announce?.(message);
  const values = (
    source: SortableSource,
    containerId: string,
    index: number,
    total: number
  ): DragMessageValues => ({
    item:
      source.ids.length === 1
        ? labelOf(source.ids[0] as string)
        : formatDragMessage(messages.itemsLabel, { count: source.ids.length }, fmt),
    count: source.ids.length,
    position: index + 1,
    total,
    container: containerLabel(containerId),
    from: containerLabel(source.origin.containerId),
  });
  const fmt = { ...(options.formatNumber ? { formatNumber: options.formatNumber } : {}) };
  const originValues = (source: SortableSource) =>
    values(
      source,
      source.origin.containerId,
      source.origin.index,
      model.container(source.origin.containerId)?.items.length ?? 0
    );
  const moveValues = (source: SortableSource, move: SortableMove) =>
    values(source, move.to, move.index, move.next[move.to]?.length ?? 0);
  const refusal = (source: SortableSource, reason: RefusalReason, target?: SortableTarget | null) =>
    formatRefusal(
      messages,
      reason,
      {
        ...originValues(source),
        ...(target ? { container: containerLabel(target.containerId) } : {}),
      },
      fmt
    );

  const session = createDragSession<SortableSource, SortableTarget>({
    ...(options.threshold === undefined ? {} : { threshold: options.threshold }),
    canDrop: (source, target) => {
      const result = plan(source, target);
      return result.ok ? ALLOW : refuse(result.reason);
    },
    ...(options.transform ? { transform: options.transform } : {}),
    onEvent: (event) => {
      if (event.type === 'start') {
        say(
          formatDragMessage(
            event.source.ids.length > 1 ? messages.pickedUpMany : messages.pickedUp,
            originValues(event.source),
            fmt
          )
        );
      } else if (event.type === 'cancel') {
        say(
          event.reason && event.reason !== 'cancelled'
            ? refusal(event.source, event.reason, event.target)
            : formatDragMessage(messages.cancelled, originValues(event.source), fmt)
        );
      }
      options.onEvent?.(event);
    },
  });

  const currentPlan = (): MovePlan | null => {
    const { source, target } = session.state;
    return source && target ? plan(source, target) : null;
  };

  const announceOver = (source: SortableSource, verdict: DropVerdict | null) => {
    const result = currentPlan();
    if (!verdict || !result) return;
    if (!result.ok) {
      say(refusal(source, result.reason, session.state.target));
      return;
    }
    const message =
      result.move.to === source.origin.containerId ? messages.moved : messages.movedContainer;
    say(formatDragMessage(message, moveValues(source, result.move), fmt));
  };

  const controller: SortableController = {
    get state() {
      const state = session.state;
      const result = currentPlan();
      return {
        phase: state.phase,
        input: state.input,
        source: state.source,
        target: state.target,
        verdict: state.verdict,
        move: result?.ok ? result.move : null,
        delta: state.delta,
      };
    },
    get model() {
      return model;
    },
    setContainers(containers) {
      model = createSortableModel(containers);
      planned = null;
    },
    pickUp(itemId, pick = {}) {
      if (session.state.phase !== 'idle') return refuse('cancelled');
      if (!model.has(itemId)) return refuse('unknown-item');
      if (options.requireHandle && !pick.fromHandle) return refuse('handle');
      const ids = pick.selection?.includes(itemId)
        ? [...new Set(pick.selection.filter((id) => model.has(id)))].sort((a, b) => {
            const at = model.locate(a) as ItemLocation;
            const bt = model.locate(b) as ItemLocation;
            return model.order(at.containerId) - model.order(bt.containerId) || at.index - bt.index;
          })
        : [itemId];
      for (const id of ids) {
        if (options.filter?.(id)) return refuse('filtered');
        if (model.isLocked(id) || options.isLocked?.(id)) return refuse('locked');
        const at = model.locate(id) as ItemLocation;
        if (model.container(at.containerId)?.disabled) return refuse('disabled');
      }
      const origin = originTarget(model, ids) as SortableTarget;
      const source: SortableSource = { ids, origin };
      planned = null;
      const input = pick.input ?? 'pointer';
      if (input === 'keyboard') {
        session.start(source, pick.point, 'keyboard');
        session.over(origin);
      } else {
        session.press(source, pick.point ?? { x: 0, y: 0 }, 'pointer');
      }
      return ALLOW;
    },
    pointerMove(point, snapshot, pointerOptions = {}) {
      session.move(point);
      const { phase, source } = session.state;
      if (phase !== 'dragging' || !source || !snapshot) return session.state.target;
      const target = pointerTarget(snapshot, point, {
        ...pointerOptions,
        model,
        activeIds: source.ids,
        ...(options.mode ? { mode: options.mode } : {}),
      });
      controller.over(target);
      return target;
    },
    over(target) {
      const before = session.state.target;
      const verdict = session.over(target);
      const source = session.state.source;
      const changed =
        target !== null &&
        (before === null ||
          before.containerId !== target.containerId ||
          before.index !== target.index);
      if (source && changed) announceOver(source, verdict);
      return verdict;
    },
    intent(intent, itemId) {
      const { phase, source, target } = session.state;
      if (intent === 'pickUp') {
        if (phase !== 'idle' || itemId === undefined) return null;
        return controller.pickUp(itemId, { input: 'keyboard', fromHandle: true });
      }
      if (phase !== 'dragging' || !source) return null;
      if (intent === 'drop') {
        controller.drop();
        return null;
      }
      if (intent === 'cancel') {
        controller.cancel();
        return null;
      }
      const from = target ?? source.origin;
      const baseline = plan(source, from);
      const baseOrder = baseline.ok ? baseline.move.next[baseline.move.to] : undefined;
      let next = keyboardTarget(model, source.ids, intent, from, options);
      if ((intent === 'movePrev' || intent === 'moveNext') && baseOrder) {
        // Step past slots a locked item pins in place: the order would not change.
        for (let guard = 0; guard < 10_000; guard += 1) {
          if (!('containerId' in next) || next.containerId !== from.containerId) break;
          const result = plan(source, next);
          const order = result.ok ? result.move.next[result.move.to] : undefined;
          if (!order || !sameOrder(order, baseOrder)) break;
          next = keyboardTarget(model, source.ids, intent, next, options);
        }
      }
      if (!('containerId' in next)) {
        say(refusal(source, next.reason, from));
        return refuse(next.reason);
      }
      const result = plan(source, next);
      if (!result.ok) {
        say(refusal(source, result.reason, next));
        return refuse(result.reason);
      }
      return controller.over(next);
    },
    drop() {
      const source = session.state.source;
      const result = currentPlan();
      const outcome = session.drop();
      if (outcome.kind !== 'drop' || !source || !result?.ok) return null;
      const move = result.move;
      session.settle();
      planned = null;
      say(
        formatDragMessage(
          move.to === source.origin.containerId ? messages.dropped : messages.droppedContainer,
          moveValues(source, move),
          fmt
        )
      );
      if (move.changed) {
        const arrived = move.items.some((item) => item.containerId !== move.to);
        if (!arrived) {
          options.onEvent?.({ type: 'update', containerId: move.to, move });
        } else if (move.kind === 'swap') {
          // Both lists lose one item and gain another.
          for (const containerId of Object.keys(move.next)) {
            options.onEvent?.({ type: 'remove', containerId, move });
            options.onEvent?.({ type: 'add', containerId, move });
          }
        } else {
          for (const containerId of Object.keys(move.next)) {
            if (containerId !== move.to) options.onEvent?.({ type: 'remove', containerId, move });
          }
          options.onEvent?.({ type: 'add', containerId: move.to, move });
        }
      }
      return move;
    },
    cancel(reason) {
      session.cancel(reason);
      planned = null;
    },
  };
  return controller;
}
