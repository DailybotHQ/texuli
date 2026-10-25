<script lang="ts">
import { CalendarHeatmap } from '@texuli/charts/calendar';

const activity = {
  '2026-03-02': 4,
  '2026-03-03': 7,
  '2026-03-05': 2,
  '2026-03-07': 11,
  '2026-03-10': 6,
  '2026-03-12': 9,
  '2026-03-16': 3,
  '2026-03-19': 12,
  '2026-03-23': 8,
  '2026-03-25': 5,
  '2026-03-29': 10,
  '2026-04-01': 7,
  '2026-04-04': 4,
  '2026-04-08': 13,
  '2026-04-11': 6,
  '2026-04-15': 9,
  '2026-04-18': 2,
  '2026-04-22': 11,
  '2026-04-25': 5,
  '2026-04-29': 8,
} as const;
</script>

<section class="demo" aria-labelledby="calendar-demo-title">
  <h2 id="calendar-demo-title">Calendar heatmap</h2>
  <p>Fictional daily activity; blank cells mean no data was recorded.</p>
  <div class="modes">
    <article data-tx-mode="light" aria-label="Light mode">
      <CalendarHeatmap
        title="Daily activity"
        description="Fictional activity recorded during March and April 2026."
        start="2026-03-01"
        end="2026-04-30"
        values={activity}
      />
    </article>
    <article data-tx-mode="dark" aria-label="Dark mode">
      <CalendarHeatmap
        title="Daily activity"
        description="Fictional activity recorded during March and April 2026."
        start="2026-03-01"
        end="2026-04-30"
        values={activity}
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
