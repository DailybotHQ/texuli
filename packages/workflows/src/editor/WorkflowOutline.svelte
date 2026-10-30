<script lang="ts">
import { tick } from 'svelte';
import type { WorkflowEdge, WorkflowNode } from '../model/types.ts';
import { connectCandidates } from './connect.ts';
import type { WorkflowController } from './controller.svelte.ts';
import { formatLabel } from './labels.ts';

/**
 * The graph as a WAI-ARIA treegrid, so it can be read and edited without
 * the canvas (WCAG 2.5.7): nodes are rows, their outgoing connections are
 * child rows. Rows: arrows, Home and End move; Right expands or enters the
 * cells; Left collapses or returns to the parent; Enter or F2 renames;
 * Delete removes. Cells: Left and Right move; Up and Down keep the column.
 */
let { controller }: { controller: WorkflowController } = $props();

const uid = $props.id();
type Row =
  | { kind: 'node'; key: string; node: WorkflowNode; edges: WorkflowEdge[]; level: 1 }
  | { kind: 'edge'; key: string; edge: WorkflowEdge; parent: string; level: 2 };

let expanded = $state.raw(new Set<string>());
let activeKey = $state<string | null>(null);
let activeCol = $state(-1);
let editing = $state<string | null>(null);
let draft = $state('');
let connecting = $state<string | null>(null);
let body = $state<HTMLTableSectionElement>();

const labels = $derived(controller.labels);
const rows = $derived.by(() => {
  const outgoing = new Map<string, WorkflowEdge[]>();
  for (const edge of controller.graph.edges) {
    const list = outgoing.get(edge.from.node);
    if (list) list.push(edge);
    else outgoing.set(edge.from.node, [edge]);
  }
  const out: Row[] = [];
  for (const node of controller.graph.nodes) {
    const edges = outgoing.get(node.id) ?? [];
    out.push({ kind: 'node', key: `n:${node.id}`, node, edges, level: 1 });
    if (expanded.has(node.id)) {
      for (const edge of edges)
        out.push({ kind: 'edge', key: `e:${edge.id}`, edge, parent: node.id, level: 2 });
    }
  }
  return out;
});
const current = $derived(rows.find((row) => row.key === activeKey) ?? rows[0]);

function nodeName(node: WorkflowNode): string {
  return node.label || controller.registry.get(node.type)?.label || node.type;
}

function edgeName(edge: WorkflowEdge): string {
  return formatLabel(labels.outlineEdge, {
    port: controller.portLabel(edge.from.node, edge.from.port),
    target: `${controller.portLabel(edge.to.node, edge.to.port)}, ${controller.nodeLabel(edge.to.node)}`,
  });
}

function options(node: WorkflowNode) {
  const ports =
    controller.registry.get(node.type)?.ports.filter((port) => port.direction === 'out') ?? [];
  return ports.flatMap((port) =>
    connectCandidates(controller.graph, controller.registry, {
      node: node.id,
      port: port.id,
      direction: 'out',
    }).map((target) => ({
      value: JSON.stringify([port.id, target.node, target.port]),
      label: `${port.label ?? port.id} → ${controller.portLabel(target.node, target.port)}, ${controller.nodeLabel(target.node)}`,
    }))
  );
}

async function focusActive(): Promise<void> {
  await tick();
  const row = body?.querySelector<HTMLElement>(`[data-row="${activeIndex()}"]`);
  if (!row) return;
  if (activeCol < 0) {
    row.focus();
    return;
  }
  const cell = row.querySelectorAll<HTMLElement>('[role="gridcell"]')[activeCol];
  const target = cell?.querySelector<HTMLElement>('button, input, select') ?? cell;
  target?.focus();
}

function activeIndex(): number {
  return Math.max(
    0,
    rows.findIndex((row) => row.key === current?.key)
  );
}

function setActive(index: number, col = activeCol): void {
  const row = rows[Math.max(0, Math.min(rows.length - 1, index))];
  if (!row) return;
  activeKey = row.key;
  activeCol = col;
  if (row.kind === 'node') controller.focusId = row.node.id;
  void focusActive();
}

function toggle(id: string, open: boolean): void {
  const next = new Set(expanded);
  if (open) next.add(id);
  else next.delete(id);
  expanded = next;
}

function remove(row: Row): void {
  const index = activeIndex();
  const result =
    row.kind === 'node'
      ? controller.apply({ op: 'removeNode', id: row.node.id })
      : controller.apply({ op: 'disconnect', id: row.edge.id });
  if (!result.ok) return;
  controller.announce(
    row.kind === 'node'
      ? formatLabel(labels.removed, { count: 1 })
      : formatLabel(labels.disconnected)
  );
  activeKey = null;
  setActive(Math.min(index, rows.length - 1), -1);
}

function startRename(node: WorkflowNode): void {
  if (controller.readonly) return;
  editing = node.id;
  draft = node.label;
  activeCol = 0;
  void focusActive();
}

function commitRename(id: string): void {
  if (editing !== id) return;
  editing = null;
  controller.apply({ op: 'setProps', id, label: draft });
  activeCol = -1;
  void focusActive();
}

function cancelEdits(): void {
  editing = null;
  connecting = null;
  activeCol = -1;
  void focusActive();
}

function connectTo(node: WorkflowNode, value: string): void {
  connecting = null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return;
  }
  if (
    !Array.isArray(parsed) ||
    parsed.length !== 3 ||
    !parsed.every((part) => typeof part === 'string')
  )
    return;
  const [port, target, targetPort] = parsed as [string, string, string];
  const id = controller.uniqueId(`${node.id}-${target}`);
  const result = controller.apply({
    op: 'connect',
    edge: { id, from: { node: node.id, port }, to: { node: target, port: targetPort } },
  });
  if (result.ok) {
    toggle(node.id, true);
    controller.announce(
      formatLabel(labels.connected, {
        port: controller.portLabel(node.id, port),
        target: `${controller.portLabel(target, targetPort)}, ${controller.nodeLabel(target)}`,
      })
    );
  }
  activeCol = -1;
  void focusActive();
}

function onKeydown(event: KeyboardEvent): void {
  const row = current;
  if (!row || editing !== null || connecting !== null) {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelEdits();
    }
    return;
  }
  const index = activeIndex();
  const rtl = controller.dir === 'rtl';
  const key =
    rtl && event.key === 'ArrowLeft'
      ? 'ArrowRight'
      : rtl && event.key === 'ArrowRight'
        ? 'ArrowLeft'
        : event.key;
  const handled = () => event.preventDefault();
  switch (key) {
    case 'ArrowDown':
      handled();
      setActive(index + 1);
      return;
    case 'ArrowUp':
      handled();
      setActive(index - 1);
      return;
    case 'Home':
      handled();
      setActive(0);
      return;
    case 'End':
      handled();
      setActive(rows.length - 1);
      return;
    case 'ArrowRight':
      handled();
      if (
        activeCol < 0 &&
        row.kind === 'node' &&
        row.edges.length > 0 &&
        !expanded.has(row.node.id)
      ) {
        toggle(row.node.id, true);
        return;
      }
      setActive(index, Math.min(3, activeCol + 1));
      return;
    case 'ArrowLeft':
      handled();
      if (activeCol >= 0) {
        setActive(index, activeCol - 1);
        return;
      }
      if (row.kind === 'node' && expanded.has(row.node.id)) toggle(row.node.id, false);
      else if (row.kind === 'edge')
        setActive(
          rows.findIndex((r) => r.key === `n:${row.parent}`),
          -1
        );
      return;
    case 'Enter':
    case 'F2':
      if (activeCol > 0) return;
      handled();
      if (row.kind === 'node') startRename(row.node);
      return;
    case 'Delete':
    case 'Backspace':
      if (activeCol >= 0 || controller.readonly) return;
      handled();
      remove(row);
      return;
  }
}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -- the WAI-ARIA treegrid pattern on a table. -->
<table class="tx-workflow-outline" role="treegrid" aria-label={formatLabel(labels.outline)} aria-readonly={controller.readonly || undefined}>
  <thead>
    <tr>
      <th scope="col">{formatLabel(labels.outlineName)}</th>
      <th scope="col">{formatLabel(labels.outlineType)}</th>
      <th scope="col"><span class="tx-workflow-outline__sr">{formatLabel(labels.outlineConnect, { node: '' })}</span></th>
      <th scope="col"><span class="tx-workflow-outline__sr">{formatLabel(labels.remove)}</span></th>
    </tr>
  </thead>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -- keys bubble from the focusable rows and cells. -->
  <tbody bind:this={body} onkeydown={onKeydown}>
    {#each rows as row, index (row.key)}
      {@const active = row.key === current?.key}
      <tr
        data-row={index}
        aria-level={row.level}
        aria-expanded={row.kind === 'node' && row.edges.length > 0 ? expanded.has(row.node.id) : undefined}
        aria-selected={row.kind === 'node' ? controller.selection.has(row.node.id) : undefined}
        tabindex={active && activeCol < 0 ? 0 : -1}
        onfocus={(event) => {
          if (event.target === event.currentTarget) {
            activeKey = row.key;
            activeCol = -1;
          }
        }}
        onclick={() => {
          activeKey = row.key;
          if (row.kind === 'node') controller.select([row.node.id]);
        }}
      >
        {#if row.kind === 'node'}
          <td role="gridcell" class="tx-workflow-outline__name">
            {#if editing === row.node.id}
              <input
                class="tx-workflow-outline__input"
                aria-label={formatLabel(labels.outlineRename, { node: nodeName(row.node) })}
                bind:value={draft}
                onkeydown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    commitRename(row.node.id);
                  } else if (event.key === 'Escape') {
                    event.preventDefault();
                    event.stopPropagation();
                    cancelEdits();
                  }
                }}
                onblur={() => commitRename(row.node.id)}
              />
            {:else}
              {#if row.edges.length > 0}
                <button
                  type="button"
                  class="tx-workflow-outline__toggle"
                  tabindex="-1"
                  aria-hidden="true"
                  onclick={(event) => {
                    event.stopPropagation();
                    toggle(row.node.id, !expanded.has(row.node.id));
                  }}>{expanded.has(row.node.id) ? '▾' : '▸'}</button
                >
              {/if}
              {nodeName(row.node)}
            {/if}
          </td>
          <td role="gridcell">{controller.registry.get(row.node.type)?.label ?? row.node.type}</td>
          <td role="gridcell">
            {#if connecting === row.node.id}
              {@const choices = options(row.node)}
              <select
                class="tx-workflow-outline__select"
                aria-label={formatLabel(labels.outlineConnectTo, { node: nodeName(row.node) })}
                onchange={(event) => connectTo(row.node, (event.currentTarget as HTMLSelectElement).value)}
                onkeydown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    event.stopPropagation();
                    cancelEdits();
                  }
                }}
              >
                <option value="">—</option>
                {#each choices as choice (choice.value)}
                  <option value={choice.value}>{choice.label}</option>
                {/each}
              </select>
            {:else if !controller.readonly}
              <button
                type="button"
                class="tx-workflow-outline__action"
                tabindex="-1"
                aria-describedby={`${uid}-connect-help`}
                onclick={() => {
                  activeKey = row.key;
                  activeCol = 2;
                  connecting = row.node.id;
                  void focusActive();
                }}>{formatLabel(labels.outlineConnect, { node: nodeName(row.node) })}</button
              >
            {/if}
          </td>
          <td role="gridcell">
            {#if !controller.readonly}
              <button type="button" class="tx-workflow-outline__action" tabindex="-1" onclick={() => remove(row)}
                >{formatLabel(labels.outlineDelete, { node: nodeName(row.node) })}</button
              >
            {/if}
          </td>
        {:else}
          <td role="gridcell" class="tx-workflow-outline__name tx-workflow-outline__child">{edgeName(row.edge)}</td>
          <td role="gridcell">{row.edge.label ?? ''}</td>
          <td role="gridcell"></td>
          <td role="gridcell">
            {#if !controller.readonly}
              <button type="button" class="tx-workflow-outline__action" tabindex="-1" onclick={() => remove(row)}
                >{formatLabel(labels.disconnect, {
                  port: controller.portLabel(row.edge.from.node, row.edge.from.port),
                  target: controller.nodeLabel(row.edge.to.node),
                })}</button
              >
            {/if}
          </td>
        {/if}
      </tr>
    {/each}
  </tbody>
</table>
<span id={`${uid}-connect-help`} class="tx-workflow-outline__sr">{formatLabel(labels.outlineConnectTo, { node: '' })}</span>

<style>
  @layer tx.components {
    .tx-workflow-outline {
      inline-size: 100%;
      border-collapse: collapse;
      font-size: var(--tx-type-label-size);
    }

    .tx-workflow-outline th {
      text-align: start;
      font-weight: 600;
      padding: var(--tx-space-1) var(--tx-space-2);
      border-block-end: var(--tx-border-width-thin) solid var(--tx-border, CanvasText);
    }

    .tx-workflow-outline td {
      padding: calc(var(--tx-space-unit) * 0.5) var(--tx-space-2);
      border-block-end: var(--tx-border-width-thin) solid color-mix(in oklab, var(--tx-border, CanvasText) 50%, transparent);
    }

    .tx-workflow-outline tr[aria-selected='true'] {
      background: color-mix(in oklab, var(--tx-primary, Highlight) 12%, transparent);
    }

    .tx-workflow-outline tr:focus-visible,
    .tx-workflow-outline :global(button:focus-visible),
    .tx-workflow-outline :global(select:focus-visible),
    .tx-workflow-outline :global(input:focus-visible) {
      outline: 3px solid var(--tx-ring, Highlight);
      outline-offset: -3px;
    }

    .tx-workflow-outline__child {
      padding-inline-start: var(--tx-space-8);
    }

    .tx-workflow-outline__toggle {
      inline-size: 24px;
      block-size: 24px;
      padding: 0;
      font: inherit;
      color: inherit;
      background: none;
      border: 0;
      cursor: pointer;
    }

    .tx-workflow-outline__action,
    .tx-workflow-outline__select,
    .tx-workflow-outline__input {
      min-block-size: 24px;
      font: inherit;
    }

    .tx-workflow-outline__action {
      padding: 0 var(--tx-space-2);
      color: inherit;
      background: var(--tx-surface, ButtonFace);
      border: var(--tx-border-width-thin) solid var(--tx-border, ButtonText);
      border-radius: var(--tx-shape-radius-sm);
      cursor: pointer;
    }

    .tx-workflow-outline__sr {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      margin: -1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }

    @media (forced-colors: active) {
      .tx-workflow-outline tr[aria-selected='true'] {
        outline: 2px solid Highlight;
        outline-offset: -2px;
      }
    }
  }
</style>
