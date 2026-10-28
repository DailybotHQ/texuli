<script lang="ts">
/**
 * G38 and G44: a file input bound to `files` (null default, reset by setting
 * null) and numeric inputs bound to a number (null while empty).
 */
import { Input } from '../../src/components/input/index.ts';

let {
  kind,
}: {
  kind: 'file' | 'number' | 'range';
} = $props();

let files = $state<FileList | null>(null);
let amount = $state<string | number | null>(3);
</script>

{#if kind === 'file'}
  <Input type="file" aria-label="Attachment" bind:files />
  <button type="button" onclick={() => (files = null)}>Reset</button>
  <output data-testid="files">{files === null ? 'null' : files.length}</output>
{:else}
  <Input type={kind} aria-label="Amount" min="0" max="10" bind:value={amount} />
  <output data-testid="amount">{amount === null ? 'null' : `${typeof amount}:${amount}`}</output>
{/if}
