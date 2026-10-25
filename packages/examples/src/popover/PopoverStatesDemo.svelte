<script lang="ts">
import { HoverCard, Popover } from 'texuli/popover';
</script>

<section data-example="ui-popover-states" class="demo" aria-label="Popover and hover card states">
  <h2>States</h2>
  <div class="row">
    <div>
      <h3>Closed popover</h3>
      <Popover.Root open={false}>
        <Popover.Trigger class="demo-trigger">Closed</Popover.Trigger>
        <Popover.Content aria-label="Hidden">Should not show</Popover.Content>
      </Popover.Root>
    </div>
    <div>
      <h3>Open, no arrow</h3>
      <Popover.Root open>
        <Popover.Trigger class="demo-trigger">No arrow</Popover.Trigger>
        <Popover.Content aria-label="No arrow" arrow={false}>
          <p class="tx-popover__description">Arrow omitted for dense layouts.</p>
        </Popover.Content>
      </Popover.Root>
    </div>
    <div>
      <h3>Hover card (open)</h3>
      <HoverCard.Root open openDelay={0} closeDelay={0}>
        <HoverCard.Trigger class="demo-trigger">Jordan Lee</HoverCard.Trigger>
        <HoverCard.Content aria-label="Jordan Lee">
          <p class="tx-hover-card__title">Jordan Lee</p>
          <p class="tx-hover-card__description">Harbor Notes editor · jordan@example.com</p>
        </HoverCard.Content>
      </HoverCard.Root>
    </div>
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
  h2,
  h3 {
    margin: 0;
  }
  h3 {
    font-size: 0.875rem;
    margin-block-end: 0.5rem;
    color: var(--tx-muted-foreground, GrayText);
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 2rem;
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
