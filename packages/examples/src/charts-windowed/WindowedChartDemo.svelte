<script lang="ts">
import { type CartesianSeries, LineChart } from '@texuli/charts/cartesian';

const COUNT = 200;
const SPAN = 20;
// Deterministic fictional latency in milliseconds for request numbers 0–199.
const series: CartesianSeries[] = [
  {
    id: 'latency',
    label: 'Latency',
    points: Array.from({ length: COUNT }, (_, x) => ({ x, y: 120 + ((x * 37) % 60) })),
  },
];

let start = $state(40);
let full = $state(false);
const visibleDomain = $derived<[number, number] | undefined>(
  full ? undefined : [start, start + SPAN]
);

let root = $state<HTMLElement>();
let ready = $state(false);

// The line chart loads its interaction chunk lazily; hold a status until the
// plot is no longer pending, so captures never see the placeholder.
$effect(() => {
  if (!root) return;
  const element = root;
  let frame = 0;
  const check = () => {
    if (element.querySelector('[data-chart-pending]')) frame = requestAnimationFrame(check);
    else ready = true;
  };
  frame = requestAnimationFrame(check);
  return () => cancelAnimationFrame(frame);
});

function move(step: number) {
  full = false;
  start = Math.min(COUNT - 1 - SPAN, Math.max(0, start + step));
}
</script>

{#if !ready}
  <p role="status">Loading chart…</p>
{/if}
<section
  class="demo"
  data-example="charts-windowed"
  aria-labelledby="charts-windowed-title"
  bind:this={root}
>
  <h2 id="charts-windowed-title">Windowed series</h2>
  <div class="controls" role="group" aria-label="Visible window">
    <button type="button" onclick={() => move(-SPAN)}>Previous window</button>
    <button type="button" onclick={() => move(SPAN)}>Next window</button>
    <button type="button" onclick={() => (full = true)}>Full range</button>
  </div>
  <p data-window>
    {full ? `Showing requests 0 to ${COUNT - 1}` : `Showing requests ${start} to ${start + SPAN}`}
  </p>
  <LineChart
    title="Latency by request"
    description="Fictional latency for each request, in milliseconds."
    {series}
    {visibleDomain}
  />
</section>

<style>
  .demo {
    display: grid;
    gap: 0.75rem;
    max-inline-size: 48rem;
    color: var(--tx-foreground, CanvasText);
  }
  h2,
  p {
    margin: 0;
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  button {
    min-block-size: 2.75rem;
    padding-inline: 0.75rem;
  }
</style>
