<script lang="ts">
import {
  Sortable,
  type SortableContainer,
  type SortableGroup,
  type SortableMove,
} from '@texuli/primitives/sortable';
import type { Snippet } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';
import { getPlayerInteraction, type ReorderScopeContainer, setReorderScope } from '../context.ts';

/**
 * The player's shared drag scope (spec 0.3.0 `reorder`): one `Sortable.Root`
 * around the painted tree, so a drag or a keyboard move can carry an item
 * from one `sortable-list` to another wherever they sit in the layout. It
 * adds no rule of its own: the drop verdict is the player's `canMove` (the
 * same group, accepts, locked, pull and maxItems rules `move` applies) and
 * a drop runs `interaction.move`, whose committed state repaints the lists.
 * Loaded only when the tree has a reorder container.
 */
let { children }: { children: Snippet } = $props();

const interaction = getPlayerInteraction();
const registered = new SvelteMap<number, () => ReorderScopeContainer | null>();
let nextKey = 0;

// Item ids match `^[A-Za-z0-9._:-]{1,64}$` and paths are dot-separated, so `/` splits a key.
const SEPARATOR = '/';
const listId = (path: string): string => `tx-reorder-${path}`;
const itemKey = (path: string, item: string): string => `${path}${SEPARATOR}${item}`;
function parseKey(key: string): { path: string; item: string } | null {
  const at = key.indexOf(SEPARATOR);
  return at > 0 ? { path: key.slice(0, at), item: key.slice(at + 1) } : null;
}

/** Tree order of two node paths, so keyboard moves past an edge go to the next list in reading order. */
function comparePaths(a: string, b: string): number {
  const left = a.split('.');
  const right = b.split('.');
  for (let i = 0; i < Math.min(left.length, right.length); i += 1) {
    const x = left[i] as string;
    const y = right[i] as string;
    if (x === y) continue;
    const nx = Number(x);
    const ny = Number(y);
    return Number.isInteger(nx) && Number.isInteger(ny) ? nx - ny : x < y ? -1 : 1;
  }
  return left.length - right.length;
}

/** The primitive's group: the visual hint only; `canDrop` stays the authority. */
function groupOf(entry: ReorderScopeContainer): SortableGroup {
  const { info, path } = entry;
  const own = info.group ?? `tx-scope:${path}`;
  return {
    name: own,
    pull: info.pull === 'clone' ? 'clone' : info.pull === 'move',
    put: [own, ...info.accepts],
  };
}

const entries = $derived(
  [...registered.values()]
    .map((get) => get())
    .filter((entry): entry is ReorderScopeContainer => entry !== null)
    .sort((a, b) => comparePaths(a.path, b.path))
);
const pathOfList = $derived(new Map(entries.map((entry) => [listId(entry.path), entry.path])));
const containers = $derived<SortableContainer[]>(
  entries.map((entry) => ({
    id: listId(entry.path),
    items: entry.info.list.map((item) => itemKey(entry.path, item.id)),
    orientation: entry.info.axis,
    group: groupOf(entry),
    disabled: entry.info.disabled,
    locked: entry.info.locked.map((item) => itemKey(entry.path, item)),
    ...(entry.info.maxItems !== undefined ? { maxItems: entry.info.maxItems } : {}),
  }))
);

/** The closed move a primitive move stands for, or `null` when it is not one. */
function closedMove(move: SortableMove) {
  const moved = move.items.length === 1 ? move.items[0] : undefined;
  const from = moved ? parseKey(moved.id) : null;
  const to = pathOfList.get(move.to);
  if (move.kind === 'swap' || !from || to === undefined) return null;
  return { from: from.path, item: from.item, to, index: move.index };
}

function canDrop(move: SortableMove) {
  const planned = closedMove(move);
  return planned && interaction?.canMove(planned.from, planned.item, planned.to, planned.index)
    ? ({ ok: true } as const)
    : ({ ok: false, reason: 'put' } as const);
}

function onMove(move: SortableMove): boolean {
  const planned = closedMove(move);
  if (planned) interaction?.move(planned.from, planned.item, planned.to, planned.index);
  // The committed state repaints every list; the primitive never applies a move itself.
  return false;
}

setReorderScope({
  register(get) {
    const key = nextKey;
    nextKey += 1;
    registered.set(key, get);
    return () => registered.delete(key);
  },
  listId,
  itemKey,
});
</script>

<Sortable.Root {containers} {canDrop} {onMove} crossContainers class="tx-player-reorder-scope">
  {@render children()}
</Sortable.Root>

<style>
  /* The scope adds no box: the painted tree lays out as if it were not there. */
  :global(.tx-player-reorder-scope) {
    display: contents;
  }
</style>
