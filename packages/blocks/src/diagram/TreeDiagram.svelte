<script lang="ts">
import { layoutTree } from './layout.ts';
import type { TreeDiagram as TreeDiagramData } from './schema.ts';
import { DIAGRAM_PAD, toneBorder } from './tones.ts';
import './diagram.css';

/**
 * Tree: file-tree is a nested list; org is layoutTree elbows + sr list alt text.
 */
let { block }: { block: TreeDiagramData } = $props();

const layout = $derived(layoutTree(block));
const byId = $derived(new Map(block.nodes.map((node) => [node.id, node])));
const positions = $derived(new Map(layout.positions.map((p) => [p.id, p])));
const children = $derived.by(() => {
  const map = new Map<string | null, string[]>();
  for (const node of block.nodes) {
    map.set(node.parentId, [...(map.get(node.parentId) ?? []), node.id]);
  }
  return map;
});
const roots = $derived(children.get(null) ?? []);
const stageW = $derived(layout.width + DIAGRAM_PAD * 2);
const stageH = $derived(layout.height + DIAGRAM_PAD * 2);
const summary = $derived(
  `${block.style === 'org' ? 'Organization chart' : 'File tree'} with ${block.nodes.length} ${
    block.nodes.length === 1 ? 'item' : 'items'
  }`
);

function elbow(from: string, to: string): string {
  const a = positions.get(from);
  const b = positions.get(to);
  if (!a || !b) return '';
  const mid = a.y + a.height + (b.y - a.y - a.height) / 2;
  return `M ${a.x + a.width / 2} ${a.y + a.height} V ${mid} H ${b.x + b.width / 2} V ${b.y}`;
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

{#snippet branch(id: string, visual: boolean)}
  {@const node = byId.get(id)}
  {@const kids = children.get(id) ?? []}
  {#if node}
    <li>
      {#if visual}
        <span class="tx-diagram-filetree__row">
          <svg
            class={`tx-diagram-filetree__icon ${kids.length > 0 ? 'tx-diagram-filetree__icon--folder' : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            {#if kids.length > 0}
              <path
                d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"
              />
            {:else}
              <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
              <path d="M14 2v4a2 2 0 0 0 2 2h4M16 13H8m8 4H8m2-8H8" />
            {/if}
          </svg>
          <span class={kids.length > 0 ? 'tx-diagram-filetree__name--folder' : ''}>{node.label}</span>
          {#if kids.length > 0}
            <span class="tx-diagram-sr"
              >(folder, {kids.length} {kids.length === 1 ? 'item' : 'items'})</span
            >
          {/if}
        </span>
      {:else}
        {node.label}
      {/if}
      {#if kids.length > 0}
        <ul>
          {#each kids as kid (kid)}
            {@render branch(kid, visual)}
          {/each}
        </ul>
      {/if}
    </li>
  {/if}
{/snippet}

<figure class="tx-diagram" data-tx-diagram="tree" data-style={block.style}>
  {#if block.style === 'file-tree'}
    <div class="tx-diagram-filetree">
      <ul aria-label={summary}>
        {#each roots as root (root)}
          {@render branch(root, true)}
        {/each}
      </ul>
    </div>
  {:else}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -- wide chart scrolls; keyboard users must reach it. -->
    <div class="tx-diagram__scroll" role="region" aria-label={summary} tabindex="0">
      <ul class="tx-diagram-sr">
        {#each roots as root (root)}
          {@render branch(root, false)}
        {/each}
      </ul>
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
          {#each layout.edges as edge (`${edge.from}-${edge.to}`)}
            <path
              d={elbow(edge.from, edge.to)}
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              data-edge="parent"
            />
          {/each}
        </svg>
        {#each layout.positions as node (node.id)}
          <div
            class={`tx-diagram-node tx-diagram-node--org ${toneBorder(node.tone)}`}
            style={nodeStyle(node)}
            title={node.label}
            data-node={node.id}
          >
            <span class="tx-diagram-node__label">{node.label}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</figure>
