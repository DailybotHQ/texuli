<script lang="ts">
import { DEFAULT_TEXT_BLOCK_LABELS } from '../text/labels.ts';
import RichText from '../text/RichText.svelte';

/**
 * Renders a short markdown body through the owned closed subset. No HTML sink.
 */
let { text }: { text: string } = $props();
</script>

<div class="tx-structure-body">
  <RichText source={text} labels={DEFAULT_TEXT_BLOCK_LABELS} />
</div>
