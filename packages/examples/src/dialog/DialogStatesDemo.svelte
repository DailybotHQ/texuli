<script lang="ts">
import { Button } from 'texuli/button';
import { AlertDialog, Dialog } from 'texuli/dialog';

let dialogOpen = $state(false);
let alertOpen = $state(true);
</script>

<section data-example="ui-dialog-states" class="demo" aria-label="Dialog and alert states">
  <h2>Dialog and AlertDialog</h2>
  <p>Closed dialog trigger beside an open destructive confirm.</p>
  <div class="row">
    <Dialog
      bind:open={dialogOpen}
      title="Invite teammate"
      description="Send a Harbor Labs invite to a teammate at example.com."
    >
      {#snippet trigger({ props })}
        <Button {...props} variant="outline">Invite</Button>
      {/snippet}
      <p>Invites expire after seven days.</p>
      {#snippet footer()}
        <Button onclick={() => (dialogOpen = false)}>Send invite</Button>
      {/snippet}
    </Dialog>

    <AlertDialog
      bind:open={alertOpen}
      title="Delete project?"
      description="This removes the Harbor Labs project from every member workspace."
      confirmLabel="Delete"
      cancelLabel="Keep project"
      destructive
      onConfirm={() => undefined}
    >
      {#snippet trigger({ props })}
        <Button {...props} variant="destructive">Delete project</Button>
      {/snippet}
    </AlertDialog>
  </div>
</section>

<style>
  .demo {
    display: grid;
    gap: 0.75rem;
    padding: 1.5rem;
    min-block-size: 18rem;
    color: var(--tx-foreground, CanvasText);
    background: var(--tx-background, Canvas);
  }
  h2 {
    margin: 0;
    font-size: 1.125rem;
  }
  p {
    margin: 0;
    color: var(--tx-muted-foreground, GrayText);
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
</style>
