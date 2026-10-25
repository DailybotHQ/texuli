<script lang="ts">
import { loadDataFamily } from '@texuli/blocks/data';
import type { Component } from 'svelte';

let View = $state<Component<{ block: unknown; mode?: 'light' | 'dark' }> | null>(null);
$effect(() => {
  let cancelled = false;
  loadDataFamily().then((mod) => {
    if (!cancelled) View = mod.default as Component<{ block: unknown; mode?: 'light' | 'dark' }>;
  });
  return () => {
    cancelled = true;
  };
});

const table = {
  type: 'table',
  caption: 'Fictional squad scores',
  columns: [
    { id: 'team', label: 'Team' },
    { id: 'score', label: 'Score' },
    { id: 'notes', label: 'Notes' },
  ],
  rows: [
    { team: 'Design', score: 92, notes: 'Shipped tokens' },
    { team: 'Build', score: 88, notes: 'Charts matrix' },
    { team: 'Review', score: 85, notes: null },
  ],
};

const stat = {
  type: 'stat',
  items: [
    { label: 'Active seats', value: '128', delta: '+12%', tone: 'success' },
    { label: 'Median latency', value: '42 ms', tone: 'info' },
    { label: 'Error rate', value: '0.4%', delta: '-0.1%', tone: 'success' },
  ],
};

const kpi = {
  type: 'kpi',
  items: [
    { label: 'NPS', value: '54', delta: '+3', hint: '90 days' },
    { label: 'Churn', value: '2.1%', delta: '-0.4%' },
  ],
};

const chart = {
  type: 'chart',
  kind: 'bar',
  title: 'Weekly sign-ups',
  description: 'Fictional new account counts by week.',
  series: [
    {
      id: 'new',
      label: 'New accounts',
      points: [
        { x: 'W1', y: 18 },
        { x: 'W2', y: 24 },
        { x: 'W3', y: 21 },
        { x: 'W4', y: 30 },
      ],
    },
  ],
};

const hostile = {
  type: 'table',
  columns: [{ id: 'x', label: 'X' }],
  rows: [{ x: 'bad\u0000cell' }],
};
</script>

<div class="demo" data-example="blocks-data">
  <section>
    <h2>Table</h2>
    {#if View}<View block={table} />{/if}
  </section>
  <section>
    <h2>Stat row</h2>
    {#if View}<View block={stat} />{/if}
  </section>
  <section>
    <h2>KPI row</h2>
    {#if View}<View block={kpi} />{/if}
  </section>
  <section>
    <h2>Chart</h2>
    {#if View}<View block={chart} />{/if}
  </section>
  <section data-tx-mode="dark" class="dark">
    <h2>Dark chart</h2>
    {#if View}<View block={chart} mode="dark" />{/if}
  </section>
  <section>
    <h2>Hostile input</h2>
    {#if View}<View block={hostile} />{/if}
  </section>
</div>

<style>
  .demo {
    display: grid;
    gap: 1.5rem;
    padding: 1rem;
    max-inline-size: 48rem;
    font-family: var(--tx-font-sans, system-ui, sans-serif);
  }
  section {
    display: grid;
    gap: 0.5rem;
  }
  h2 {
    margin: 0;
    font-size: 0.85rem;
  }
  .dark {
    padding: 0.75rem;
    border-radius: 0.5rem;
    background: #0f1115;
    color: #f4f4f5;
    /* Local dark tokens so chart captions keep AA on this plate. */
    --tx-background: #0f1115;
    --tx-foreground: #f4f4f5;
    --tx-muted-foreground: #c8cdd4;
    --tx-border: #8394a5;
    --tx-surface: #0f1115;
  }

  @media (forced-colors: active) {
    .dark, [data-tx-mode="dark"] {
      background: Canvas !important;
      color: CanvasText !important;
      border-color: CanvasText !important;
      --tx-background: Canvas;
      --tx-foreground: CanvasText;
      --tx-muted-foreground: CanvasText;
      --tx-border: CanvasText;
      --tx-surface: Canvas;
      --tx-primary: Highlight;
      --tx-primary-foreground: HighlightText;
    }
  }
</style>
