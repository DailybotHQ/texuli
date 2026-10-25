<script lang="ts">
import type { RenderNode } from '@texuli/catalog/render/renderer';

/**
 * Inert preview of sink-free render nodes. Uses text only — never HTML sinks.
 */

type Props = {
  roots: readonly RenderNode[];
};

let { roots }: Props = $props();

function propEntries(props: Readonly<Record<string, unknown>>): [string, string][] {
  return Object.entries(props).map(([k, v]) => {
    if (v === null || v === undefined) return [k, '—'];
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      return [k, String(v)];
    }
    try {
      return [k, JSON.stringify(v)];
    } catch {
      return [k, '[unserializable]'];
    }
  });
}
</script>

{#if roots.length === 0}
  <p class="empty" role="status">Nothing to show. The tree was empty or every node was dropped.</p>
{:else}
  <ul class="tree" data-tx-playground-tree="">
    {#each roots as node, index (index)}
      {@render renderNode(node)}
    {/each}
  </ul>
{/if}

{#snippet renderNode(node: RenderNode)}
  {#if node.kind === 'placeholder'}
    <li class="node node--placeholder" data-kind="placeholder" data-reason={node.reason}>
      <p class="node__title" role="note">{node.label}</p>
      <p class="node__meta">placeholder · {node.reason} · requested id: {node.id}</p>
    </li>
  {:else}
    <li class="node node--component" data-kind="component" data-id={node.id}>
      <p class="node__title">{node.id}</p>
      {#if Object.keys(node.props).length > 0}
        <dl class="node__props">
          {#each propEntries(node.props) as [key, value] (key)}
            <div class="node__prop">
              <dt>{key}</dt>
              <dd>{value}</dd>
            </div>
          {/each}
        </dl>
      {/if}
      {#if node.children.length > 0}
        <ul class="tree tree--nested">
          {#each node.children as child, i (i)}
            {@render renderNode(child)}
          {/each}
        </ul>
      {/if}
    </li>
  {/if}
{/snippet}

<style>
  .empty {
    margin: 0;
    color: var(--tx-foreground);
  }
  .tree {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.75rem;
  }
  .tree--nested {
    margin-block-start: 0.75rem;
    padding-inline-start: 0.75rem;
    border-inline-start: 2px solid var(--tx-border);
  }
  .node {
    margin: 0;
    padding: 0.75rem;
    border: 1px solid var(--tx-border);
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-background);
    color: var(--tx-foreground);
  }
  .node--placeholder {
    border-style: dashed;
  }
  .node__title {
    margin: 0;
    font-weight: 600;
    font-family: var(--tx-font-mono, ui-monospace, monospace);
    font-size: 0.9375rem;
  }
  .node__meta {
    margin: 0.25rem 0 0;
    font-size: 0.8125rem;
  }
  .node__props {
    margin: 0.5rem 0 0;
    display: grid;
    gap: 0.25rem;
  }
  .node__prop {
    display: grid;
    grid-template-columns: minmax(5rem, 8rem) 1fr;
    gap: 0.5rem;
    font-size: 0.8125rem;
  }
  .node__prop dt {
    margin: 0;
    font-weight: 600;
    font-family: var(--tx-font-mono, ui-monospace, monospace);
  }
  .node__prop dd {
    margin: 0;
    overflow-wrap: anywhere;
  }
  @media (forced-colors: active) {
    .node {
      border-color: ButtonText;
      forced-color-adjust: none;
    }
  }
</style>
