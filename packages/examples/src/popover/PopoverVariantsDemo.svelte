<script lang="ts">
import { Popover } from 'texuli/popover';
</script>

<section data-example="ui-popover-variants" class="demo" aria-label="Popover variants">
  <h2>Popover variants</h2>
  <div class="row">
    <Popover.Root open side="bottom">
      <Popover.Trigger class="demo-trigger">Elevated md</Popover.Trigger>
      <Popover.Content aria-label="Elevated" variant="elevated" size="md">
        <p class="tx-popover__title">Elevated</p>
        <p class="tx-popover__description">Default shadow surface.</p>
      </Popover.Content>
    </Popover.Root>
    <Popover.Root open side="bottom">
      <Popover.Trigger class="demo-trigger">Flat sm</Popover.Trigger>
      <Popover.Content aria-label="Flat" variant="flat" size="sm">
        <p class="tx-popover__title">Flat</p>
        <p class="tx-popover__description">Border only, no shadow.</p>
      </Popover.Content>
    </Popover.Root>
    <Popover.Root open side="bottom">
      <Popover.Trigger class="demo-trigger">Large</Popover.Trigger>
      <Popover.Content aria-label="Large" variant="elevated" size="lg">
        <p class="tx-popover__title">Large</p>
        <p class="tx-popover__description">Wider content for longer copy on example.com pages.</p>
      </Popover.Content>
    </Popover.Root>
  </div>
</section>

<style>
  .demo {
    display: grid;
    gap: 1rem;
    padding: 1.5rem;
    min-block-size: 14rem;
    color: var(--tx-foreground, CanvasText);
    background: var(--tx-background, Canvas);
  }
  h2 {
    margin: 0;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 2.5rem;
    align-items: flex-start;
  }
  .demo :global(.demo-trigger) {
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.375rem;
    padding-block: 0.35rem;
    padding-inline: 0.65rem;
    background: var(--tx-surface, Canvas);
    color: inherit;
  }
</style>
