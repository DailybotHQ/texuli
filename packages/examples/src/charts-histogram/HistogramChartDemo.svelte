<script lang="ts">
import { HistogramChart } from '@texuli/charts/histogram';

const responseTimes = [
  82, 94, 97, 101, 108, 112, 115, 119, 126, 131, 139, 145, 151, 158, 166, 173, 181, 194, 208, 224,
  247, 273, 318, 362,
] as const;
</script>

<section class="demo" aria-labelledby="histogram-demo-title">
  <h2 id="histogram-demo-title">Histogram chart</h2>
  <p>Fictional response times grouped into 50 millisecond ranges.</p>
  <div class="modes">
    <article data-tx-mode="light" aria-label="Light mode">
      <HistogramChart
        title="Response time distribution"
        description="Most fictional requests completed between 100 and 200 milliseconds."
        values={responseTimes}
        domain={[50, 400]}
        thresholds={[100, 150, 200, 250, 300, 350]}
      />
    </article>
    <article data-tx-mode="dark" aria-label="Dark mode">
      <HistogramChart
        title="Response time distribution"
        description="Most fictional requests completed between 100 and 200 milliseconds."
        values={responseTimes}
        domain={[50, 400]}
        thresholds={[100, 150, 200, 250, 300, 350]}
      />
    </article>
  </div>
</section>

<style>
  .demo { color: var(--tx-foreground, CanvasText); display: grid; gap: 1rem; }
  h2, p { margin-block: 0; }
  .modes { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(min(100%, 24rem), 1fr)); }
  article { background: var(--tx-background, Canvas); border: 1px solid var(--tx-border, currentColor); border-radius: 0.75rem; color: var(--tx-foreground, CanvasText); padding: 1rem; }
  article[data-tx-mode='dark'] { color-scheme: dark; }
  article[data-tx-mode='light'] { color-scheme: light; }
  @media (forced-colors: active) { article { border-color: CanvasText; } }
</style>
