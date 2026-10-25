<script lang="ts">
import { Button } from 'texuli/button';
import { Dialog, type DialogSize } from 'texuli/dialog';

const sizes: DialogSize[] = ['sm', 'md', 'lg'];
let open = $state<Record<DialogSize, boolean>>({ sm: false, md: true, lg: false, xl: false });
</script>

<section data-example="ui-dialog-variants" class="demo" aria-label="Dialog sizes">
  <h2>Dialog sizes</h2>
  <p>sm, md and lg surfaces. The medium dialog is open for capture.</p>
  <div class="row">
    {#each sizes as size (size)}
      <Dialog
        bind:open={open[size]}
        title={`Harbor ${size.toUpperCase()}`}
        description={`Size ${size} dialog for the Harbor Labs settings sheet.`}
        {size}
      >
        {#snippet trigger({ props })}
          <Button {...props} variant="outline">Open {size}</Button>
        {/snippet}
        <p>Body copy for the {size} dialog.</p>
        {#snippet footer()}
          <Button onclick={() => (open[size] = false)}>Done</Button>
        {/snippet}
      </Dialog>
    {/each}
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
