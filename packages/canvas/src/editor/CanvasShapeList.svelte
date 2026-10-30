<script lang="ts">
// The screen-reader structure of the canvas: every shape (frames and groups
// nest) and every connector as a WAI-ARIA tree in reading order, next to the
// application region. Up and Down move, Right and Left open, close or go to
// the parent, Home and End jump, Space toggles selection, Enter goes to the
// shape on the canvas, Delete removes it.
import { indexShapes, isContainer } from '../model/document.ts';
import type { CanvasShape } from '../model/types.ts';
import type { CanvasController } from './controller.svelte.ts';

interface Props {
  controller: CanvasController;
  class?: string;
}

let { controller, class: className = '' }: Props = $props();

interface Row {
  id: string;
  name: string;
  kind: string;
  level: number;
  setsize: number;
  posinset: number;
  parent: string | null;
  container: boolean;
}

let collapsed = $state.raw<ReadonlySet<string>>(new Set());
let active = $state<string | null>(null);
let items: Record<string, HTMLElement | undefined> = $state({});

const L = $derived(controller.labels);
const rows = $derived.by(() => {
  const doc = controller.doc;
  const index = indexShapes(doc);
  const order = controller.order;
  const rank = new Map(order.map((id, i) => [id, i]));
  const sorted = (list: CanvasShape[]) =>
    [...list].sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
  const out: Row[] = [];
  const visit = (list: CanvasShape[], level: number, parent: string | null) => {
    const ordered = sorted(list);
    ordered.forEach((shape, i) => {
      out.push({
        id: shape.id,
        name: controller.nameOf(shape.id),
        kind: controller.label(L.kinds[shape.type] ?? shape.type),
        level,
        setsize: ordered.length + (level === 1 ? doc.connectors.length : 0),
        posinset: i + 1,
        parent,
        container: isContainer(shape) && shape.children.length > 0,
      });
      if (isContainer(shape) && !collapsed.has(shape.id))
        visit(shape.children, level + 1, shape.id);
    });
  };
  visit(doc.shapes, 1, null);
  void index;
  doc.connectors.forEach((connector, i) => {
    out.push({
      id: connector.id,
      name: controller.nameOf(connector.id),
      kind: '',
      level: 1,
      setsize: doc.shapes.length + doc.connectors.length,
      posinset: doc.shapes.length + i + 1,
      parent: null,
      container: false,
    });
  });
  return out;
});

const current = $derived(
  active !== null && rows.some((row) => row.id === active)
    ? active
    : controller.focusId !== null && rows.some((row) => row.id === controller.focusId)
      ? controller.focusId
      : (rows[0]?.id ?? null)
);

function move(id: string | null | undefined): void {
  if (!id) return;
  active = id;
  items[id]?.focus();
}

function onKeydown(event: KeyboardEvent, row: Row): void {
  const at = rows.findIndex((each) => each.id === row.id);
  switch (event.key) {
    case 'ArrowDown':
      move(rows[at + 1]?.id);
      break;
    case 'ArrowUp':
      move(rows[at - 1]?.id);
      break;
    case 'Home':
      move(rows[0]?.id);
      break;
    case 'End':
      move(rows[rows.length - 1]?.id);
      break;
    case 'ArrowRight':
      if (row.container && collapsed.has(row.id))
        collapsed = new Set([...collapsed].filter((id) => id !== row.id));
      else if (row.container) move(rows[at + 1]?.id);
      else return;
      break;
    case 'ArrowLeft':
      if (row.container && !collapsed.has(row.id)) collapsed = new Set([...collapsed, row.id]);
      else if (row.parent) move(row.parent);
      else return;
      break;
    case ' ':
      controller.toggle(row.id);
      break;
    case 'Enter':
      controller.select([row.id]);
      if (indexShapes(controller.doc).has(row.id)) {
        controller.focusId = row.id;
        controller.pendingFocus = row.id;
        controller.reveal(row.id);
      }
      break;
    case 'Delete':
    case 'Backspace':
      controller.select([row.id], false);
      controller.removeSelection();
      break;
    default:
      return;
  }
  event.preventDefault();
}
</script>

<div class={['tx-canvas-shape-list', className]}>
  {#if rows.length === 0}
    <p class="tx-canvas-shape-list__empty">{controller.label(L.empty)}</p>
  {:else}
    <ul role="tree" aria-label={controller.label(L.shapeList)} aria-multiselectable="true" class="tx-canvas-shape-list__tree">
      {#each rows as row (row.id)}
        <li
          bind:this={items[row.id]}
          role="treeitem"
          class="tx-canvas-shape-list__item"
          data-tx-shape-item={row.id}
          aria-level={row.level}
          aria-setsize={row.setsize}
          aria-posinset={row.posinset}
          aria-selected={controller.selection.has(row.id)}
          aria-expanded={row.container ? !collapsed.has(row.id) : undefined}
          tabindex={row.id === current ? 0 : -1}
          style:padding-inline-start={`${0.5 + (row.level - 1) * 1}rem`}
          onkeydown={(event) => onKeydown(event, row)}
          onfocus={() => (active = row.id)}
          onclick={() => {
            active = row.id;
            controller.select([row.id]);
          }}
        >{row.name}{#if row.kind && row.kind !== row.name}<span class="tx-canvas-shape-list__kind">, {row.kind}</span>{/if}</li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  @layer tx.components {
    .tx-canvas-shape-list {
      overflow: auto;
      max-block-size: 100%;
      padding: var(--tx-space-1);
      font-size: var(--tx-type-label-size);
      background: var(--tx-surface, Canvas);
      color: var(--tx-foreground, CanvasText);
    }

    .tx-canvas-shape-list__tree {
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .tx-canvas-shape-list__item {
      padding-block: calc(var(--tx-space-unit) * 1.5);
      padding-inline-end: var(--tx-space-2);
      border-radius: var(--tx-shape-radius-sm);
      cursor: pointer;
      overflow-wrap: anywhere;
    }

    .tx-canvas-shape-list__item[aria-selected='true'] {
      background: color-mix(in oklab, var(--tx-primary, Highlight) 14%, transparent);
    }

    .tx-canvas-shape-list__item:focus-visible {
      outline: var(--tx-focus-ring-width, 2px) solid var(--tx-ring, Highlight);
      outline-offset: -2px;
    }

    .tx-canvas-shape-list__kind,
    .tx-canvas-shape-list__empty {
      color: var(--tx-muted-foreground, GrayText);
    }

    .tx-canvas-shape-list__empty {
      margin: var(--tx-space-2);
    }

    @media (forced-colors: active) {
      .tx-canvas-shape-list__item[aria-selected='true'] {
        outline: 1px solid Highlight;
      }
    }
  }
</style>
