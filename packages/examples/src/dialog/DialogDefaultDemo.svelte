<script lang="ts">
import { Button } from 'texuli/button';
import { Dialog } from 'texuli/dialog';

let open = $state(true);
</script>

<section data-example="ui-dialog" class="demo" aria-label="Dialog default">
  <h2>Dialog</h2>
  <p>Styled modal with header, body and footer. Open by default for visual capture.</p>
  <Dialog
    bind:open
    title="Workspace settings"
    description="Update the Harbor Labs workspace name and timezone."
    size="md"
  >
    {#snippet trigger({ props })}
      <Button {...props}>Open settings</Button>
    {/snippet}
    <p>
      Name, region and default locale for the Harbor Labs workspace. Changes apply to every
      member.
    </p>
    {#snippet footer()}
      <Button variant="outline" onclick={() => (open = false)}>Cancel</Button>
      <Button onclick={() => (open = false)}>Save changes</Button>
    {/snippet}
  </Dialog>
</section>

<style>
  .demo {
    display: grid;
    gap: 0.75rem;
    padding: 1.5rem;
    min-block-size: 20rem;
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
</style>
