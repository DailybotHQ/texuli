<script lang="ts">
import { layoutFlow } from './layout.ts';
import type { FlowDiagram } from './schema.ts';
import { DIAGRAM_PAD, toneBorder } from './tones.ts';
import './diagram.css';

/**
 * Flow steps left to right from layoutFlow, joined by arrows, optional loop-back.
 * Ordered list is the text alternative; drawing is aria-hidden.
 */
let { block }: { block: FlowDiagram } = $props();

const uid = $props.id();
const arrow = `tx-flow-arrow-${uid}`;
const layout = $derived(layoutFlow(block));
const byId = $derived(new Map(layout.positions.map((p) => [p.id, p])));
const stageW = $derived(layout.width + DIAGRAM_PAD * 2);
const stageH = $derived(layout.height + DIAGRAM_PAD * 2);
const summary = $derived(
  `Flow with ${block.nodes.length} ${block.nodes.length === 1 ? 'step' : 'steps'}${
    block.loopBack && block.nodes.length > 1 ? ', repeating from the last step to the first' : ''
  }`
);

function edgePath(from: string, to: string, kind: string): string {
  const a = byId.get(from);
  const b = byId.get(to);
  if (!a || !b) return '';
  if (kind === 'loop-back') {
    const y = a.y + a.height + 24;
    return `M ${a.x + a.width / 2} ${a.y + a.height} V ${y} H ${b.x + b.width / 2} V ${b.y + b.height + 6}`;
  }
  const y = a.y + a.height / 2;
  return `M ${a.x + a.width} ${y} H ${b.x - 6}`;
}

function nodeStyle(node: { x: number; y: number; width: number; height: number }): string {
  return [
    `--tx-dx:${node.x + DIAGRAM_PAD}px`,
    `--tx-dy:${node.y + DIAGRAM_PAD}px`,
    `--tx-dw:${node.width}px`,
    `--tx-dh:${node.height}px`,
  ].join(';');
}
</script>

<figure class="tx-diagram" data-tx-diagram="flow">
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -- wide flow scrolls; keyboard users must reach it (WCAG 2.1.1). -->
  <div class="tx-diagram__scroll" role="region" aria-label={summary} tabindex="0">
    <ol class="tx-diagram-sr">
      {#each block.nodes as node, index (node.id)}
        <li>Step {index + 1} of {block.nodes.length}: {node.label}</li>
      {/each}
      {#if block.loopBack && block.nodes.length > 1}
        <li>Then back to step 1: {block.nodes[0]?.label}</li>
      {/if}
    </ol>
    <div
      class="tx-diagram__stage"
      aria-hidden="true"
      style={`--tx-diagram-w:${stageW}px;--tx-diagram-h:${stageH}px`}
    >
      <svg
        class="tx-diagram__svg"
        width={stageW}
        height={stageH}
        viewBox={`${-DIAGRAM_PAD} ${-DIAGRAM_PAD} ${stageW} ${stageH}`}
        focusable="false"
      >
        <defs>
          <marker
            id={arrow}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
          </marker>
        </defs>
        {#each layout.edges as edge (`${edge.from}-${edge.to}-${edge.kind}`)}
          <path
            d={edgePath(edge.from, edge.to, edge.kind)}
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-dasharray={edge.kind === 'loop-back' ? '4 4' : undefined}
            marker-end={`url(#${arrow})`}
            data-edge={edge.kind}
          />
        {/each}
      </svg>
      {#each layout.positions as node, index (node.id)}
        <div
          class={`tx-diagram-node ${toneBorder(node.tone)}`}
          style={nodeStyle(node)}
          title={node.label}
          data-node={node.id}
        >
          <span class="tx-diagram-node__index">{index + 1}</span>
          <span class="tx-diagram-node__label">{node.label}</span>
        </div>
      {/each}
    </div>
  </div>
</figure>
