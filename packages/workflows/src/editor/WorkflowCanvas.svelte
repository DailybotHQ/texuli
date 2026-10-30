<script lang="ts">
import {
  capturePointer,
  createPointerTracker,
  type GestureElement,
  type PointerTracker,
} from '@texuli/drag/gesture';
import { screenToWorld, type ViewTransform } from '@texuli/drag/spatial';
import { type Snippet, tick, untrack } from 'svelte';
import type { Point } from '../model/types.ts';
import CanvasNode from './CanvasNode.svelte';
import type { WorkflowController } from './controller.svelte.ts';
import { type Box, boundsOfBoxes, edgeCurve, portKey } from './geometry.ts';
import { type CanvasCommand, canvasCommand, connectCommand } from './keyboard.ts';
import { formatDragMessage, formatLabel } from './labels.ts';
import type { WorkflowNodeContext } from './types.ts';

interface Props {
  controller: WorkflowController;
  /** Custom node body. The frame, ports, focus and selection stay the editor's. */
  node?: Snippet<[WorkflowNodeContext]>;
  /** Overlays inside the viewport (the minimap). */
  children?: Snippet;
  /** Fit the graph into view once the viewport has a size. Default true. */
  fitOnMount?: boolean;
  class?: string;
}

let {
  controller,
  node: nodeSnippet,
  children,
  fitOnMount = true,
  class: className = '',
}: Props = $props();

const uid = $props.id();
const helpId = `${uid}-help`;
const markerId = `${uid}-arrow`;
let root = $state<HTMLDivElement>();
let viewportEl = $state<HTMLDivElement>();

const labels = $derived(controller.labels);
const roleDescription = $derived(formatDragMessage(controller.messages.roleDescription, {}));
const scene = $derived(controller.scene);
const tabStop = $derived(controller.focusId ?? controller.graph.nodes[0]?.id ?? null);
const connections = $derived.by(() => {
  const counts = new Map<string, number>();
  for (const edge of controller.graph.edges) {
    counts.set(edge.from.node, (counts.get(edge.from.node) ?? 0) + 1);
    counts.set(edge.to.node, (counts.get(edge.to.node) ?? 0) + 1);
  }
  return counts;
});
const groups = $derived(
  controller.graph.groups.flatMap((group) => {
    const members = controller.graph.nodes.filter((node) => node.group === group.id);
    const boxes = members.flatMap((node) => {
      const box = scene.boxes.get(node.id);
      return box ? [box] : [];
    });
    if (boxes.length === 0) return [];
    const box = boundsOfBoxes(boxes);
    const pad = 16;
    return [
      {
        group,
        box: {
          x: box.x - pad,
          y: box.y - pad * 2,
          width: box.width + pad * 2,
          height: box.height + pad * 3,
        },
      },
    ];
  })
);

/**
 * During a pointer drag the dragged nodes, and edges between two of them,
 * move with one CSS transform (the drag offset variables on the world). Only
 * edges with exactly one dragged end are redrawn each frame, as an overlay.
 */
const drag = $derived.by(() => {
  const ids = controller.dragIds;
  if (ids.size === 0) return null;
  const whole = new Set<string>();
  const cut = new Map<string, { from: boolean; item: (typeof scene.edges)[number] }>();
  for (const item of scene.edges) {
    const from = ids.has(item.edge.from.node);
    const to = ids.has(item.edge.to.node);
    if (from && to) whole.add(item.edge.id);
    else if (from || to) cut.set(item.edge.id, { from, item });
  }
  return { whole, cut };
});
const cutPaths = $derived.by(() => {
  if (!drag) return [];
  const { x, y } = controller.dragDelta;
  return [...drag.cut.values()].flatMap(({ from, item }) => {
    const a = scene.ports.get(portKey(item.edge.from.node, item.edge.from.port));
    const b = scene.ports.get(portKey(item.edge.to.node, item.edge.to.port));
    if (!a || !b) return [];
    const start = from ? { x: a.point.x + x, y: a.point.y + y } : a.point;
    const end = from ? b.point : { x: b.point.x + x, y: b.point.y + y };
    return [{ id: item.edge.id, path: edgeCurve(start, a.side, end, b.side) }];
  });
});

const world = (view: ViewTransform) => `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`;

$effect(() => {
  controller.viewportElement = viewportEl ?? null;
  return () => {
    controller.viewportElement = null;
  };
});

let fitted = false;
$effect(() => {
  if (fitted || !fitOnMount || controller.viewport.width <= 0 || controller.viewport.height <= 0)
    return;
  fitted = true;
  untrack(() => controller.fit(false));
});

// Move DOM focus where the controller asks (keyboard moves, connect mode, deletes).
$effect(() => {
  const target = controller.pendingFocus;
  if (!target || !root) return;
  const host = root;
  void tick().then(() => {
    if (controller.pendingFocus !== target) return;
    controller.pendingFocus = null;
    const selector = target.kind === 'node' ? '[data-wf-node]' : '[data-wf-port]';
    for (const element of host.querySelectorAll<HTMLElement>(selector)) {
      const match =
        target.kind === 'node'
          ? element.dataset.wfNode === target.node
          : element.dataset.wfPortNode === target.node && element.dataset.wfPort === target.port;
      if (match) {
        element.focus({ preventScroll: true });
        return;
      }
    }
  });
});

// Wheel: pan, or zoom around the pointer with Control. Not passive, so the page does not scroll.
$effect(() => {
  const element = viewportEl;
  if (!element) return;
  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) {
      const rect = element.getBoundingClientRect();
      controller.zoomBy(
        Math.exp(-event.deltaY * 0.002),
        { x: event.clientX - rect.left, y: event.clientY - rect.top },
        false
      );
    } else {
      controller.panBy({ x: -event.deltaX, y: -event.deltaY });
    }
  };
  element.addEventListener('wheel', onWheel, { passive: false });
  return () => element.removeEventListener('wheel', onWheel);
});

// ---------------------------------------------------------------------------
// Pointer gestures: one at a time, through the drag gesture tracker.

type Gesture =
  | { kind: 'node'; id: string; toggle: boolean }
  | { kind: 'pan'; start: ViewTransform }
  | { kind: 'marquee'; additive: boolean }
  | { kind: 'wire' };

let tracker: PointerTracker | null = null;
let gesture: Gesture | null = null;
let origin = { left: 0, top: 0 };

function toWorld(point: Point): Point {
  return screenToWorld({ x: point.x - origin.left, y: point.y - origin.top }, controller.view);
}

function finish(): void {
  tracker = null;
  gesture = null;
}

function begin(event: PointerEvent, next: Gesture): void {
  if (tracker !== null || !root || !viewportEl) return;
  const rect = viewportEl.getBoundingClientRect();
  origin = { left: rect.left, top: rect.top };
  const active = next;
  const created = createPointerTracker({
    threshold: 4,
    onStart(e) {
      if (active.kind === 'node') controller.beginDrag(active.id);
      else if (active.kind === 'marquee') controller.beginMarquee(toWorld(e.origin));
    },
    onMove(e) {
      if (active.kind === 'node') controller.updateDrag(e.delta);
      else if (active.kind === 'pan')
        controller.setView({
          ...active.start,
          x: active.start.x + e.delta.x,
          y: active.start.y + e.delta.y,
        });
      else if (active.kind === 'marquee') controller.updateMarquee(toWorld(e.point));
      else controller.updateWire(toWorld(e.point));
    },
    onEnd(e) {
      if (active.kind === 'node') controller.endDrag();
      else if (active.kind === 'marquee') controller.endMarquee(active.additive);
      else if (active.kind === 'wire') controller.endWire(toWorld(e.point));
      finish();
    },
    onCancel() {
      if (active.kind === 'node') controller.cancelDrag();
      else if (active.kind === 'pan') controller.setView(active.start);
      else if (active.kind === 'marquee') controller.marquee = null;
      else {
        controller.connect = null;
        controller.wire = null;
      }
      finish();
    },
    onClick() {
      if (active.kind === 'node') {
        if (active.toggle) controller.toggleSelect(active.id);
        else controller.select([active.id]);
        controller.focusNode(active.id);
      } else if (active.kind === 'pan' || active.kind === 'marquee') {
        controller.clearSelection();
      } else {
        controller.connect = null;
        controller.wire = null;
      }
      finish();
    },
  });
  if (!created.down(event)) return;
  tracker = created;
  gesture = next;
  capturePointer(root as unknown as GestureElement, event.pointerId);
}

function onBackgroundDown(event: PointerEvent): void {
  if (event.target !== viewportEl && !(event.target as Element).closest?.('[data-wf-world]'))
    return;
  if ((event.target as Element).closest?.('[data-wf-node]')) return;
  begin(
    event,
    event.shiftKey
      ? { kind: 'marquee', additive: event.ctrlKey || event.metaKey }
      : { kind: 'pan', start: controller.view }
  );
}

function onNodeDown(event: PointerEvent, id: string): void {
  if ((event.target as Element).closest?.('a, input, textarea, select, button')) return;
  event.stopPropagation();
  begin(event, { kind: 'node', id, toggle: event.shiftKey || event.ctrlKey || event.metaKey });
}

function onPortDown(event: PointerEvent, node: string, port: string): void {
  event.stopPropagation();
  if (controller.connect) return;
  if (!controller.startWire(node, port)) return;
  begin(event, { kind: 'wire' });
  if (tracker === null) {
    controller.connect = null;
    controller.wire = null;
  }
}

function onPortClick(node: string, port: string): void {
  const state = controller.connect;
  if (state && state.index >= 0) {
    if (controller.isCandidate(node, port)) controller.commitConnect({ node, port });
    else controller.cancelConnect();
    return;
  }
  if (state) {
    controller.connect = null;
    controller.wire = null;
  }
  controller.startConnect(node, port);
}

// ---------------------------------------------------------------------------
// Keyboard

function run(command: CanvasCommand, id: string, event: KeyboardEvent): void {
  switch (command.kind) {
    case 'focus':
      controller.focusId = id;
      controller.moveFocus(command.direction);
      break;
    case 'nudge':
      controller.focusId = id;
      controller.nudge(command.direction, command.large);
      break;
    case 'toggleSelect':
      controller.toggleSelect(id);
      break;
    case 'remove':
      controller.focusId = id;
      controller.removeSelection();
      break;
    case 'undo':
      controller.undo();
      break;
    case 'redo':
      controller.redo();
      break;
    case 'zoomIn':
      controller.zoomIn();
      break;
    case 'zoomOut':
      controller.zoomOut();
      break;
    case 'fit':
      controller.fit();
      break;
    case 'selectAll':
      controller.selectAll();
      break;
    case 'copy':
      controller.focusId = id;
      controller.copy();
      break;
    case 'cut':
      controller.focusId = id;
      controller.cut();
      break;
    case 'paste':
      // With nothing copied here, let the browser fire `paste` with the system clipboard.
      if (!controller.paste()) return;
      break;
    case 'group':
      controller.focusId = id;
      controller.group();
      break;
    case 'ungroup':
      controller.focusId = id;
      controller.ungroup();
      break;
    case 'escape':
      if (controller.selection.size === 0 && controller.selectedEdge === null) return;
      controller.clearSelection();
      break;
    case 'first':
    case 'last':
      controller.focusEdgeOf(command.kind);
      break;
  }
  event.preventDefault();
}

function onKeydown(event: KeyboardEvent): void {
  if (gesture !== null) {
    if (event.key === 'Escape') {
      event.preventDefault();
      tracker?.cancel();
    }
    return;
  }
  if (controller.connect && controller.wire === null) {
    const command = connectCommand(event);
    if (!command) return;
    event.preventDefault();
    event.stopPropagation();
    if (command === 'next') controller.cycleConnect(1);
    else if (command === 'previous') controller.cycleConnect(-1);
    else if (command === 'commit') controller.commitConnect();
    else controller.cancelConnect();
    return;
  }
  const target = event.target as HTMLElement;
  const nodeElement = target.closest<HTMLElement>('[data-wf-node]');
  const id = nodeElement?.dataset.wfNode;
  if (!nodeElement || id === undefined) return;
  const port = target.dataset.wfPort;
  if (port !== undefined && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
    controller.startConnect(id, port);
    return;
  }
  // Keys inside custom node content (a link, a field) stay with that content.
  if (target !== nodeElement && port === undefined) return;
  if (event.key === 'Enter' && port === undefined) {
    event.preventDefault();
    controller.select([id]);
    controller.announce(formatLabel(labels.selection, { count: 1 }));
    return;
  }
  const command = canvasCommand(event, controller.dir);
  if (command) run(command, id, event);
}

function onFocusin(event: FocusEvent): void {
  const element = (event.target as HTMLElement).closest<HTMLElement>('[data-wf-node]');
  const id = element?.dataset.wfNode;
  if (id !== undefined && controller.focusId !== id) controller.focusId = id;
}

function onPaste(event: ClipboardEvent): void {
  const text = event.clipboardData?.getData('text/plain');
  if (text && controller.pasteText(text)) event.preventDefault();
}

function boxStyle(box: Box): string {
  return `left:${box.x}px;top:${box.y}px;width:${box.width}px;height:${box.height}px`;
}
</script>

<!-- Coordinates are physical world units from the model, so nodes are placed with left/top on purpose;
     right-to-left flips port sides, arrow keys and auto-layout instead. -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -- keys and pointers bubble from the focusable nodes and ports inside. -->
<div
  bind:this={root}
  class={['tx-workflow-canvas', className]}
  role="region"
  aria-label={formatLabel(labels.canvas)}
  data-readonly={controller.readonly || undefined}
  data-connecting={controller.connect ? true : undefined}
  onkeydown={onKeydown}
  onfocusin={onFocusin}
  onpaste={onPaste}
  onpointermove={(event) => tracker?.move(event)}
  onpointerup={(event) => tracker?.up(event)}
  onpointercancel={(event) => tracker?.cancel(event)}
>
  <span id={helpId} class="tx-workflow-sr-only">{formatLabel(labels.canvasInstructions)}</span>
  <!-- svelte-ignore a11y_no_static_element_interactions -- pan and marquee are pointer conveniences; the keyboard pans by focus and zooms with keys. -->
  <div
    bind:this={viewportEl}
    class="tx-workflow-canvas__viewport"
    bind:clientWidth={controller.viewport.width}
    bind:clientHeight={controller.viewport.height}
    onpointerdown={onBackgroundDown}
  >
    <div
      class="tx-workflow-canvas__world"
      data-wf-world
      style:transform={world(controller.view)}
      style:--tx-workflow-drag-x={`${controller.dragDelta.x}px`}
      style:--tx-workflow-drag-y={`${controller.dragDelta.y}px`}
    >
      {#each groups as item (item.group.id)}
        <div class="tx-workflow-group" style={boxStyle(item.box)}>
          <span class="tx-workflow-group__label">{item.group.label}</span>
        </div>
      {/each}

      <svg class="tx-workflow-edges" aria-hidden="true" width="1" height="1">
        <defs>
          <marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M0 0L10 5L0 10z" class="tx-workflow-edge__arrow" />
          </marker>
        </defs>
        {#each scene.edges as item (item.edge.id)}
          <g
            class="tx-workflow-edge"
            data-selected={controller.selectedEdge === item.edge.id || undefined}
            data-drag={drag?.whole.has(item.edge.id) ? 'whole' : drag?.cut.has(item.edge.id) ? 'cut' : undefined}
          >
            <!-- svelte-ignore a11y_no_static_element_interactions -- edges are edited from the outline by keyboard. -->
            <path
              class="tx-workflow-edge__hit"
              d={item.path}
              onpointerdown={(event) => {
                event.stopPropagation();
                controller.selectEdge(item.edge.id);
              }}
            />
            <path class="tx-workflow-edge__line" d={item.path} marker-end={`url(#${markerId})`} />
            {#if item.edge.label}
              <text class="tx-workflow-edge__label" x={(item.from.x + item.to.x) / 2} y={(item.from.y + item.to.y) / 2 - 6} text-anchor="middle">{item.edge.label}</text>
            {/if}
          </g>
        {/each}
        {#each cutPaths as item (item.id)}
          <path class="tx-workflow-edge__line" d={item.path} marker-end={`url(#${markerId})`} />
        {/each}
        {#if controller.wire}
          <path class="tx-workflow-wire" d={`M${controller.wire.from.x} ${controller.wire.from.y}L${controller.wire.to.x} ${controller.wire.to.y}`} />
        {/if}
      </svg>

      {#each controller.graph.nodes as node (node.id)}
        {@const box = scene.boxes.get(node.id)}
        {#if box}
          <CanvasNode
            {node}
            spec={controller.registry.get(node.type)}
            {box}
            ports={scene.nodePorts.get(node.id) ?? []}
            selected={controller.selection.has(node.id)}
            tabbable={tabStop === node.id}
            dragging={controller.dragIds.has(node.id)}
            connections={connections.get(node.id) ?? 0}
            connect={controller.connect}
            readonly={controller.readonly}
            {labels}
            {roleDescription}
            {uid}
            {helpId}
            body={nodeSnippet}
            onnodedown={onNodeDown}
            onportdown={onPortDown}
            onportclick={onPortClick}
          />
        {/if}
      {/each}

      {#if controller.marquee}
        <div class="tx-workflow-marquee" style={boxStyle(controller.marquee)}></div>
      {/if}
    </div>
    {@render children?.()}
  </div>
</div>

<style>
  @layer tx.components {
    .tx-workflow-canvas {
      position: relative;
      display: grid;
      min-block-size: 20rem;
      color: var(--tx-foreground, CanvasText);
      background: var(--tx-surface, Canvas);
      border: var(--tx-border-width-thin) solid var(--tx-border, CanvasText);
      border-radius: var(--tx-shape-radius-xl);
      color-scheme: light dark;
      overflow: hidden;
    }

    .tx-workflow-canvas__viewport {
      position: relative;
      overflow: hidden;
      min-block-size: inherit;
      touch-action: none;
      cursor: grab;
      background-image: radial-gradient(var(--tx-border, GrayText) 1px, transparent 1px);
      background-size: 16px 16px;
    }

    .tx-workflow-canvas__world {
      position: absolute;
      inset-block-start: 0;
      inset-inline-start: 0;
      transform-origin: 0 0;
      direction: ltr;
    }

    .tx-workflow-sr-only {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      margin: -1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }

    .tx-workflow-edges {
      position: absolute;
      inset-block-start: 0;
      inset-inline-start: 0;
      overflow: visible;
    }

    .tx-workflow-edge[data-drag='cut'] {
      display: none;
    }

    .tx-workflow-edge[data-drag='whole'] {
      transform: translate(var(--tx-workflow-drag-x, 0), var(--tx-workflow-drag-y, 0));
    }

    .tx-workflow-edge__hit {
      fill: none;
      stroke: transparent;
      stroke-width: 14;
      pointer-events: stroke;
      cursor: pointer;
    }

    .tx-workflow-edge__line,
    .tx-workflow-wire {
      fill: none;
      stroke: var(--tx-muted-foreground, GrayText);
      stroke-width: 2;
      pointer-events: none;
    }

    .tx-workflow-edge__arrow {
      fill: var(--tx-muted-foreground, GrayText);
    }

    .tx-workflow-edge[data-selected] .tx-workflow-edge__line {
      stroke: var(--tx-primary, Highlight);
      stroke-width: 3;
    }

    .tx-workflow-edge__label {
      fill: var(--tx-foreground, CanvasText);
      font-size: var(--tx-type-caption-size);
      paint-order: stroke;
      stroke: var(--tx-surface, Canvas);
      stroke-width: 4;
    }

    .tx-workflow-wire {
      stroke: var(--tx-primary, Highlight);
      stroke-dasharray: 6 4;
    }

    .tx-workflow-group {
      position: absolute;
      border: var(--tx-border-width-thin) dashed var(--tx-border, CanvasText);
      border-radius: var(--tx-shape-radius-xl);
      background: color-mix(in oklab, var(--tx-muted, Canvas) 60%, transparent);
    }

    .tx-workflow-group__label {
      display: block;
      padding: var(--tx-space-1) var(--tx-space-2);
      font-size: var(--tx-type-caption-size);
      color: var(--tx-muted-foreground, GrayText);
    }

    .tx-workflow-marquee {
      position: absolute;
      border: var(--tx-border-width-thin) solid var(--tx-primary, Highlight);
      background: color-mix(in oklab, var(--tx-primary, Highlight) 12%, transparent);
      pointer-events: none;
    }

    @media (forced-colors: active) {
      .tx-workflow-edge__line,
      .tx-workflow-wire {
        stroke: CanvasText;
      }

      .tx-workflow-edge[data-selected] .tx-workflow-edge__line {
        stroke: Highlight;
      }

      .tx-workflow-edge__arrow {
        fill: CanvasText;
      }
    }
  }
</style>
