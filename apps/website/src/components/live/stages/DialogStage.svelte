<!-- Lazily loaded: carry the styles with the component (Astro attaches lazily
     imported component CSS only to some pages). -->
<svelte:options css="injected" />

<script lang="ts">
/**
 * Dialog and AlertDialog, opened from a trigger by click or keyboard. Focus
 * moves in, Escape closes, focus returns to the trigger.
 */
import { Button } from 'texuli/button';
import { AlertDialog, Dialog } from 'texuli/dialog';
import { Input } from 'texuli/input';
import { readers, type StageValues } from './values.ts';

type Props = { componentId: string; values: StageValues; portal?: HTMLElement };

let { componentId, values, portal }: Props = $props();

const { str, bool, pick } = readers(() => values);

let open = $state(false);
let title = $state('Harbor launch notes');
let result = $state('');
</script>

<div class="stage" data-tx-dialog-stage={componentId}>
  {#if componentId === 'dialog'}
    <Dialog
      bind:open
      title={str('title', 'Edit note')}
      description={str('description', 'Harbor Notes settings')}
      size={pick('size', ['sm', 'md', 'lg', 'xl'] as const, 'md')}
      hideClose={bool('hideClose')}
      closeLabel={str('closeLabel', 'Close')}
      {portal}
    >
      {#snippet trigger({ props })}
        <Button {...props}>Edit note</Button>
      {/snippet}
      <label class="field">
        <span>Title</span>
        <Input bind:value={title} />
      </label>
      {#snippet footer()}
        <Button variant="outline" onclick={() => (open = false)}>Cancel</Button>
        <Button
          onclick={() => {
            result = `Saved “${title}”.`;
            open = false;
          }}
        >
          Save
        </Button>
      {/snippet}
    </Dialog>
  {:else}
    <AlertDialog
      bind:open
      title={str('title', 'Delete note?')}
      description={str('description', 'This cannot be undone.')}
      confirmLabel={str('confirmLabel', 'Delete')}
      cancelLabel={str('cancelLabel', 'Cancel')}
      destructive={bool('destructive', true)}
      {portal}
      onConfirm={() => {
        result = 'Note deleted.';
      }}
    >
      {#snippet trigger({ props })}
        <Button {...props} variant="destructive">Delete note</Button>
      {/snippet}
    </AlertDialog>
  {/if}
  <p class="state" role="status">{result}</p>
</div>

<style>
  .stage {
    display: grid;
    gap: 0.5rem;
    justify-items: start;
  }
  .field {
    display: grid;
    gap: 0.35rem;
  }
  .state {
    margin: 0;
    min-block-size: 1.5em;
    font-size: 0.875rem;
  }
</style>
