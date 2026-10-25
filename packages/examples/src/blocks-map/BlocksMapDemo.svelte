<script lang="ts">
import type { FieldIssue } from '@texuli/blocks';
import { MapBlockView } from '@texuli/blocks/map/renderers';
import { DELIVERY_MAP, HOSTILE_MAP } from './samples.ts';

/** A map block from validated data, and a hostile one the guard rejects. */
let rejected = $state('');
const report = (issues: FieldIssue[]) => {
  rejected = issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
};
</script>

<article class="demo" data-example="blocks-map" aria-labelledby="blocks-map-title">
  <h2 id="blocks-map-title">Map block</h2>
  <MapBlockView block={DELIVERY_MAP} locale="en" />
  <section class="case" aria-labelledby="blocks-map-hostile">
    <h3 id="blocks-map-hostile">Hostile input is rejected</h3>
    <MapBlockView block={HOSTILE_MAP} oninvalid={report} />
    {#if rejected}<p class="issue" data-rejected>Rejected: {rejected}</p>{/if}
  </section>
</article>

<style>
  .demo {
    display: grid;
    gap: 1.5rem;
    max-inline-size: 52rem;
    padding: 1.5rem;
  }
  .demo h2,
  .case h3,
  .issue {
    margin: 0;
  }
  .case {
    display: grid;
    gap: 0.5rem;
  }
  .issue {
    font-size: 0.875rem;
  }
</style>
