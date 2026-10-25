<script lang="ts">
import { HoverCard, Popover } from 'texuli/popover';
</script>

<section data-example="ui-popover-dark" class="demo" aria-label="Popover dark">
  <h2>Dark surface</h2>
  <div class="row">
    <Popover.Root open side="bottom">
      <Popover.Trigger class="demo-trigger">Filters</Popover.Trigger>
      <Popover.Content aria-label="Filters">
        <p class="tx-popover__title">Filters</p>
        <p class="tx-popover__description">Only open tasks · example.com</p>
      </Popover.Content>
    </Popover.Root>
    <HoverCard.Root open openDelay={0} closeDelay={0}>
      <HoverCard.Trigger class="demo-trigger">Profile</HoverCard.Trigger>
      <HoverCard.Content aria-label="Profile">
        <p class="tx-hover-card__title">Northwind Labs</p>
        <p class="tx-hover-card__description">Fictional org · 24 members</p>
      </HoverCard.Content>
    </HoverCard.Root>
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
