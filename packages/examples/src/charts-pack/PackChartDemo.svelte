<script lang="ts">
import { PackChart, type PackTree } from '@texuli/charts/pack';

const capacity: PackTree = {
  id: 'workspace',
  label: 'Example workspace',
  children: [
    {
      id: 'product',
      label: 'Product',
      children: [
        { id: 'design', label: 'Design', value: 8 },
        { id: 'engineering', label: 'Engineering', value: 20 },
        { id: 'research', label: 'Research', value: 6 },
      ],
    },
    {
      id: 'operations',
      label: 'Operations',
      children: [
        { id: 'support', label: 'Support', value: 7 },
        { id: 'finance', label: 'Finance', value: 5 },
      ],
    },
  ],
};
</script>

<section class="demo" aria-labelledby="pack-demo-title">
  <h2 id="pack-demo-title">Pack chart</h2>
  <p>Circle area represents fictional team capacity.</p>
  <div class="modes">
    <article data-tx-mode="light" aria-label="Light mode">
      <PackChart
        title="Capacity by team"
        description="Engineering has the largest capacity in this fictional workspace."
        root={capacity}
        height={360}
      />
    </article>
    <article data-tx-mode="dark" aria-label="Dark mode">
      <PackChart
        title="Capacity by team"
        description="Engineering has the largest capacity in this fictional workspace."
        root={capacity}
        height={360}
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
