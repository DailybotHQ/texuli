<script lang="ts">
import { AlertDialog, Dialog } from '../../src/components/dialog/index.ts';

let {
  kind = 'dialog',
  bound = false,
  onOpenChange,
}: {
  kind?: 'dialog' | 'alert';
  /** Bind `open` (a parent that owns the state) instead of passing it once. */
  bound?: boolean;
  onOpenChange?: (open: boolean) => void;
} = $props();

let open = $state(true);
</script>

<button type="button">Outside</button>
{#if kind === 'dialog'}
  {#if bound}
    <Dialog bind:open title="Rename project" {onOpenChange}>Body</Dialog>
  {:else}
    <Dialog open title="Rename project" {onOpenChange}>Body</Dialog>
  {/if}
{:else if bound}
  <AlertDialog bind:open title="Delete project?" confirmLabel="Delete" {onOpenChange} />
{:else}
  <AlertDialog open title="Delete project?" confirmLabel="Delete" {onOpenChange} />
{/if}
<output data-testid="open">{String(open)}</output>
