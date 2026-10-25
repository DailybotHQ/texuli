<script lang="ts">
import { BoxPlotChart, EcdfChart, type StatGroup, ViolinChart } from '@texuli/charts/statistical';

// Fictional response times in milliseconds for two service regions.
const groups: StatGroup[] = [
  {
    id: 'north',
    label: 'North region',
    values: [82, 94, 97, 101, 108, 112, 115, 119, 126, 131, 139, 145, 151, 158, 166, 173, 194, 362],
  },
  {
    id: 'south',
    label: 'South region',
    values: [96, 104, 118, 122, 129, 137, 141, 148, 152, 160, 171, 182, 190, 205, 214, 233, 247],
  },
];
const domain: [number, number] = [50, 400];
const modes = ['light', 'dark'] as const;
</script>

<section class="demo" aria-labelledby="statistical-demo-title">
  <h2 id="statistical-demo-title">Statistical charts</h2>
  <p>Fictional response times for two regions, shown three ways.</p>
  <div class="modes">
    {#each modes as mode (mode)}
      <article data-tx-mode={mode} aria-label={mode === 'light' ? 'Light mode' : 'Dark mode'}>
        <BoxPlotChart
          title="Response time spread"
          description="South is slower at the median; North has one slow outlier."
          {groups}
          {domain}
          height={240}
        />
        <ViolinChart
          title="Response time density"
          description="Most North requests cluster near 120 milliseconds."
          {groups}
          {domain}
          height={240}
        />
        <EcdfChart
          title="Share of requests under a time"
          description="About half of North requests finish within 130 milliseconds."
          series={groups}
          {domain}
          height={240}
        />
      </article>
    {/each}
  </div>
</section>

<style>
  .demo { color: var(--tx-foreground, CanvasText); display: grid; gap: 1rem; }
  h2, p { margin-block: 0; }
  .modes { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(min(100%, 24rem), 1fr)); }
  article { background: var(--tx-background, Canvas); border: 1px solid var(--tx-border, currentColor); border-radius: 0.75rem; color: var(--tx-foreground, CanvasText); display: grid; gap: 1.5rem; padding: 1rem; }
  article[data-tx-mode='dark'] { color-scheme: dark; }
  article[data-tx-mode='light'] { color-scheme: light; }
  @media (forced-colors: active) { article { border-color: CanvasText; } }
</style>
