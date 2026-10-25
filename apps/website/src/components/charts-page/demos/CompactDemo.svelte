<script lang="ts">
import { BulletChart, Gauge, ProgressRing, Sparkline } from '@texuli/charts/compact';

const trend = [18, 21, 19, 25, 27, 23, 31, 34] as const;
</script>

<div class="grid" data-tx-charts-demo="compact">
  <div class="cell">
    <h3 class="cell__title">Weekly signups</h3>
    <Sparkline values={trend} label="Weekly signups" period="eight weeks" variant="area" />
  </div>
  <div class="cell">
    <h3 class="cell__title">Quarterly target</h3>
    <BulletChart label="Quarterly revenue" value={74} max={100} target={80} ranges={[55, 85]} />
  </div>
  <div class="cell">
    <h3 class="cell__title">Service health</h3>
    <Gauge
      label="Service health"
      value={86}
      thresholds={[60, 80]}
      bandLabels={['Needs attention', 'Good', 'Excellent']}
    />
  </div>
  <div class="cell">
    <h3 class="cell__title">Project completion</h3>
    <ProgressRing label="Project completion" value={7} max={10} />
  </div>
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 10rem), 1fr));
    gap: 1rem;
    align-items: start;
  }
  .cell {
    min-inline-size: 0;
  }
  .cell__title {
    margin: 0 0 0.5rem;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--tx-foreground);
  }
</style>
