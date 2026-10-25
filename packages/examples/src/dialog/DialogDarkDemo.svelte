<script lang="ts">
import { Button } from 'texuli/button';
import { AlertDialog, Dialog } from 'texuli/dialog';

let open = $state(true);
let alertOpen = $state(false);
</script>

<section data-example="ui-dialog-dark" class="demo" data-theme="dark" aria-label="Dialog dark">
  <h2>Dialog on dark</h2>
  <p>Token colors only. The settings dialog is open for capture.</p>
  <div class="row">
    <Dialog
      bind:open
      title="Workspace settings"
      description="Harbor Labs dark-surface preferences."
    >
      {#snippet trigger({ props })}
        <Button {...props}>Open settings</Button>
      {/snippet}
      <p>Theme, density and motion preferences for the lab.</p>
      {#snippet footer()}
        <Button variant="outline" onclick={() => (open = false)}>Cancel</Button>
        <Button onclick={() => (open = false)}>Save</Button>
      {/snippet}
    </Dialog>
    <AlertDialog
      bind:open={alertOpen}
      title="Archive workspace?"
      description="Harbor Labs will hide the workspace from the gallery."
      confirmLabel="Archive"
      cancelLabel="Keep"
      destructive
    >
      {#snippet trigger({ props })}
        <Button {...props} variant="destructive">Archive</Button>
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
