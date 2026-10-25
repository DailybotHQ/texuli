<script lang="ts">
import { loadDataFamily } from '@texuli/blocks/data';
import type { Component } from 'svelte';

type BlockView = Component<{ block: unknown }>;

let View = $state<BlockView | null>(null);
let root = $state<HTMLElement>();
let phase = $state<'loading' | 'ready' | 'error'>('loading');

$effect(() => {
  let cancelled = false;
  loadDataFamily().then((mod) => {
    if (!cancelled) View = mod.default as BlockView;
  });
  return () => {
    cancelled = true;
  };
});

// Chart blocks load their chart family lazily; report ready only once every
// block has replaced its loading placeholder, so captures never see it.
$effect(() => {
  if (!View || !root) return;
  const element = root;
  let frame = 0;
  const check = () => {
    if (element.querySelector('.tx-block-chart-error')) phase = 'error';
    else if (element.querySelector('.tx-block-chart-loading')) frame = requestAnimationFrame(check);
    else phase = 'ready';
  };
  frame = requestAnimationFrame(check);
  return () => cancelAnimationFrame(frame);
});

const weeks = ['W1', 'W2', 'W3', 'W4', 'W5'];
const signUps = [18, 24, 21, 30, 34];
const activations = [11, 15, 14, 19, 25];
const line = (id: string, label: string, values: number[]) => ({
  id,
  label,
  points: values.map((y, i) => ({ x: weeks[i], y })),
});

const blocks = [
  {
    heading: 'Pie (part-whole)',
    block: {
      type: 'chart',
      kind: 'pie',
      title: 'Workspaces by plan',
      description: 'Team is the most common fictional plan.',
      props: {
        data: [
          { id: 'team', label: 'Team', value: 62 },
          { id: 'business', label: 'Business', value: 27 },
          { id: 'free', label: 'Free', value: 11 },
        ],
      },
    },
  },
  {
    heading: 'Gauge (compact)',
    block: {
      type: 'chart',
      kind: 'gauge',
      title: 'Check-in completion',
      description: 'Fictional completion is in the healthy band.',
      props: { value: 78, thresholds: [40, 70], bandLabels: ['Low', 'Fair', 'Healthy'] },
    },
  },
  {
    heading: 'Sankey (flow)',
    block: {
      type: 'chart',
      kind: 'sankey',
      title: 'Trial outcomes',
      description: 'Most fictional trials convert to a paid plan.',
      props: {
        nodes: [
          { id: 'trial', label: 'Trial' },
          { id: 'paid', label: 'Paid' },
          { id: 'lapsed', label: 'Lapsed' },
        ],
        links: [
          { source: 'trial', target: 'paid', value: 64 },
          { source: 'trial', target: 'lapsed', value: 36 },
        ],
        height: 220,
      },
    },
  },
  {
    heading: 'Histogram',
    block: {
      type: 'chart',
      kind: 'histogram',
      title: 'Stand-up length',
      description: 'Most fictional stand-ups take 10 to 15 minutes.',
      props: {
        values: [6, 8, 9, 11, 11, 12, 12, 13, 13, 14, 14, 15, 17, 19, 23],
        thresholds: [5, 10, 15, 20, 25],
        domain: [5, 25],
        height: 220,
      },
    },
  },
  {
    heading: 'Pack',
    block: {
      type: 'chart',
      kind: 'pack',
      title: 'Reports by team',
      description: 'Build files the most fictional reports.',
      props: {
        root: {
          id: 'all',
          label: 'All teams',
          children: [
            { id: 'build', label: 'Build', value: 9 },
            { id: 'design', label: 'Design', value: 5 },
            { id: 'review', label: 'Review', value: 3 },
          ],
        },
        height: 260,
      },
    },
  },
  {
    heading: 'Calendar',
    block: {
      type: 'chart',
      kind: 'calendar',
      title: 'January check-ins',
      description: 'Fictional check-ins peak mid-month.',
      props: {
        start: '2026-01-01',
        end: '2026-01-31',
        values: { '2026-01-05': 3, '2026-01-12': 6, '2026-01-14': 8, '2026-01-21': 4 },
      },
    },
  },
  {
    heading: 'Combo',
    block: {
      type: 'chart',
      kind: 'combo',
      title: 'Sign-ups and activations',
      description: 'Fictional activations track sign-ups a week behind.',
      series: [
        line('signups', 'Sign-ups', signUps),
        line('activations', 'Activations', activations),
      ],
      props: { renderer: 'svg' },
    },
  },
  {
    heading: 'Line with annotations',
    block: {
      type: 'chart',
      kind: 'line',
      title: 'Weekly sign-ups against goal',
      description: 'Fictional sign-ups pass the goal in week 4.',
      series: [line('signups', 'Sign-ups', signUps)],
      props: {
        renderer: 'svg',
        annotations: [
          { id: 'goal', type: 'line', axis: 'y', value: 28, label: 'Goal' },
          { id: 'promo', type: 'band', axis: 'x', start: 'W2', end: 'W3', label: 'Promo' },
          { id: 'peak', type: 'point', x: 'W5', y: 34, label: 'Peak' },
        ],
      },
    },
  },
  {
    heading: 'Scatter with series labels',
    block: {
      type: 'chart',
      kind: 'scatter',
      title: 'Effort versus impact',
      description: 'Fictional projects with more effort tend to land more impact.',
      points: [
        { id: 'a', label: 'Search', x: 2, y: 3, seriesId: 'core' },
        { id: 'b', label: 'Boards', x: 5, y: 7, seriesId: 'core' },
        { id: 'c', label: 'Themes', x: 3, y: 4, seriesId: 'polish' },
        { id: 'd', label: 'Exports', x: 7, y: 8, seriesId: 'polish' },
      ],
      props: {
        height: 260,
        series: [
          { id: 'core', label: 'Core' },
          { id: 'polish', label: 'Polish' },
        ],
      },
    },
  },
];
</script>

{#if phase === 'loading'}
  <p role="status">Loading chart blocks…</p>
{:else if phase === 'error'}
  <p role="alert">A chart block failed to load.</p>
{/if}
<div class="demo" data-example="blocks-data-charts" bind:this={root}>
  {#each blocks as item (item.heading)}
    <section>
      <h2>{item.heading}</h2>
      {#if View}<View block={item.block} />{/if}
    </section>
  {/each}
</div>

<style>
  .demo {
    display: grid;
    gap: 1.5rem;
    padding: 1rem;
    max-inline-size: 48rem;
    color: var(--tx-foreground, CanvasText);
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
</style>
