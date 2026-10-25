<script lang="ts">
import { Popover } from 'texuli/popover';

let open = $state(true);
</script>

<section data-example="ui-popover" class="demo" aria-label="Popover default">
  <h2>Popover</h2>
  <p>A floating panel with an arrow, open by default for visual capture.</p>
  <Popover.Root bind:open side="bottom" align="center">
    <Popover.Trigger class="demo-trigger">Account</Popover.Trigger>
    <Popover.Content aria-label="Account menu">
      <div class="tx-popover__header">
        <p class="tx-popover__title">Marta Ruiz</p>
        <p class="tx-popover__description">marta@example.com · Workspace admin</p>
      </div>
      <ul class="list">
        <li>Profile</li>
        <li>Billing</li>
        <li>Sign out</li>
      </ul>
      <div class="tx-popover__footer">
        <Popover.Close>Close</Popover.Close>
      </div>
    </Popover.Content>
  </Popover.Root>
</section>

<style>
  .demo {
    display: grid;
    gap: 0.75rem;
    padding: 1.5rem;
    min-block-size: 16rem;
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
  .demo :global(.demo-trigger) {
    justify-self: start;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.375rem;
    padding-block: 0.4rem;
    padding-inline: 0.75rem;
    background: var(--tx-surface, Canvas);
    color: inherit;
    cursor: pointer;
  }
  .list {
    margin: 0;
    padding-inline-start: 1.1rem;
  }
</style>
