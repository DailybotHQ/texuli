<script lang="ts">
import type { FieldIssue } from '@texuli/blocks';
import { TextBlockView } from '@texuli/blocks/text/renderers';
import { TEXT_FAMILY_HOSTILE } from './samples.ts';

/** Hostile block data: inert text or a rejection notice, never markup. */
let rejected = $state<Record<number, string>>({});
const report = (index: number) => (issues: FieldIssue[]) => {
  rejected[index] = issues.map((issue) => issue.message).join('; ');
};
</script>

<article class="demo" data-example="blocks-text-hostile" aria-labelledby="hostile-title">
  <h2 id="hostile-title">Hostile input</h2>
  {#each TEXT_FAMILY_HOSTILE as sample, i (sample.label)}
    <section class="case" aria-label={sample.label}>
      <h3>{sample.label}</h3>
      <TextBlockView block={sample.block} oninvalid={report(i)} />
      {#if rejected[i]}<p class="issue" data-rejected>Rejected: {rejected[i]}</p>{/if}
    </section>
  {/each}
</article>

<style>
  .demo {
    display: grid;
    gap: 1.25rem;
    max-inline-size: 42rem;
    padding: 1.5rem;
  }
  .case {
    display: grid;
    gap: 0.5rem;
  }
  .case h3,
  .demo h2 {
    margin: 0;
  }
  .issue {
    margin: 0;
    font-size: 0.875rem;
  }
</style>
