<script lang="ts">
/**
 * A `{ type: "math", tex }` block (Markdown `$$`): the owned TeX subset
 * converted to MathML Core by `texToMath` and painted element by element.
 * A formula outside the subset shows its TeX source as code with a note,
 * never as markup. The TeX source is the accessible text (`alttext`).
 */
import { texToMath } from '@texuli/deck/math';
import MathNode from './MathNode.svelte';

let { tex, label = 'Formula' }: { tex: string; label?: string } = $props();
let result = $derived(texToMath(tex, { display: true }));
let root = $derived({ ...result.node, attrs: { ...result.node.attrs, alttext: tex } });
</script>

<figure class="tx-deck-math" data-tx-deck-math={result.ok ? 'ok' : 'source'}>
  {#if result.ok}
    <MathNode node={root} />
  {:else}
    <pre class="tx-deck-math__source"><code>{tex}</code></pre>
    <figcaption class="tx-deck-math__note" role="note">
      {label}: {result.issues[0]?.message ?? ''}
    </figcaption>
  {/if}
</figure>

<style>
  .tx-deck-math {
    margin: 0;
    margin-block: 0.5em;
    font-size: 1.25em;
    overflow-x: auto;
  }
  .tx-deck-math__source {
    margin: 0;
    font-size: 0.8em;
  }
  .tx-deck-math__note {
    font-size: 0.7em;
    opacity: 0.8;
  }
</style>
