<script lang="ts">
import { loadDiagramFamily } from '@texuli/blocks/diagram';
import type { Component } from 'svelte';

let Family: Component<{ block: unknown }> | null = $state(null);
let error: string | null = $state(null);

$effect(() => {
  let cancelled = false;
  void loadDiagramFamily().then(
    (mod) => {
      if (!cancelled) Family = mod.default;
    },
    (err: unknown) => {
      if (!cancelled) error = err instanceof Error ? err.message : 'Failed to load';
    }
  );
  return () => {
    cancelled = true;
  };
});

const flow = {
  type: 'flow',
  nodes: [
    { id: 'brief', label: 'Write brief' },
    { id: 'build', label: 'Build prototype', tone: 'info' },
    { id: 'review', label: 'Review with team', tone: 'success' },
  ],
  loopBack: true,
};

const org = {
  type: 'tree',
  variant: 'org',
  nodes: [
    { id: 'lead', parentId: null, label: 'Product lead' },
    { id: 'design', parentId: 'lead', label: 'Design' },
    { id: 'eng', parentId: 'lead', label: 'Engineering' },
  ],
};

const board = {
  type: 'board',
  columns: [
    {
      id: 'todo',
      title: 'Todo',
      cards: [{ id: 't1', title: 'Outline slides', tone: 'warning' }],
    },
    {
      id: 'doing',
      title: 'Doing',
      cards: [{ id: 't2', title: 'Draft diagrams', tone: 'info' }],
    },
  ],
};

const terminal = {
  type: 'terminal',
  lines: [
    { kind: 'comment', text: '# Fictional session' },
    { kind: 'prompt', text: 'pnpm protoyard validate demo' },
    { kind: 'output', text: 'ok — 12 checks passed' },
  ],
};

const hostile = {
  type: 'flow',
  nodes: [{ id: 'x', label: `Click${String.fromCharCode(0x202e)}me` }],
};
</script>

<section data-example="blocks-diagram" aria-labelledby="diagram-demo-title">
  <h2 id="diagram-demo-title">Diagram blocks</h2>

  {#if error}
    <p role="alert">{error}</p>
  {:else if !Family}
    <p role="status">Loading diagrams…</p>
  {:else}
    <h3>Flow (sequence)</h3>
    <Family block={flow} />

    <h3>Org chart</h3>
    <div dir="rtl">
      <Family block={org} />
    </div>

    <h3>Board</h3>
    <Family block={board} />

    <h3>Terminal</h3>
    <Family block={terminal} />

    <h3>Hostile input</h3>
    <Family block={hostile} />
  {/if}
</section>

<style>
  section {
    display: grid;
    gap: 1.25rem;
    padding: 1rem;
    color: var(--tx-foreground, CanvasText);
    background: var(--tx-background, Canvas);
  }
  h2,
  h3 {
    margin: 0;
  }
</style>
