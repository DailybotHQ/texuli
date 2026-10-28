<script lang="ts">
/**
 * A host free-slide renderer for the stage tests: it paints its own block
 * types (`host-card` with a `title`) as plain text, the way a host whose
 * blocks are not `@texuli/blocks` would.
 */
import type { FreeSlide } from '@texuli/deck/model';

let { slide }: { slide: FreeSlide } = $props();
</script>

<div data-host-free>
  {#each slide.blocks as block, index (index)}
    <p>{String((block as { title?: unknown }).title ?? '')}</p>
  {/each}
</div>
