<script lang="ts">
import EmbedApp from './EmbedApp.svelte';
import type { EmbedBlockViewProps } from './family.ts';
import { DEFAULT_EMBED_BLOCK_LABELS } from './family.ts';
import LinkPreview from './LinkPreview.svelte';
import { checkEmbedBlock } from './schema.ts';

let { block, mountEmbed, labels, oninvalid }: EmbedBlockViewProps = $props();
const check = $derived(checkEmbedBlock(block));
const text = $derived({ ...DEFAULT_EMBED_BLOCK_LABELS, ...labels });
$effect(() => {
  if (!check.ok) oninvalid?.(check.issues);
});
</script>

{#if !check.ok}
  <p class="tx-embed-invalid" data-tx-block="invalid" role="note">{text.invalid}</p>
{:else if check.block.type === 'embed-app'}
  <EmbedApp block={check.block} {mountEmbed} labels={text} />
{:else}
  <LinkPreview block={check.block} labels={text} />
{/if}

<style>
  .tx-embed-invalid {
    margin: 0;
    padding: 0.625em 0.875em;
    border: var(--tx-border-width-thin) dashed currentColor;
    border-radius: 0.375em;
    overflow-wrap: anywhere;
  }
</style>
