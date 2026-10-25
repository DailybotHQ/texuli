<script lang="ts">
import { TextBlockView } from '@texuli/blocks/text/renderers';
import { TEXT_FAMILY_SAMPLES } from './samples.ts';

/** Every text family block rendered from untrusted, validated data. */
</script>

<article class="demo" data-example="blocks-text" aria-label="Text blocks">
  {#each TEXT_FAMILY_SAMPLES as block, i (i)}
    <TextBlockView {block} />
  {/each}
</article>

<style>
  .demo {
    display: grid;
    gap: 1.5rem;
    max-inline-size: 42rem;
    padding: 1.5rem;
  }
</style>
