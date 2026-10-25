<script lang="ts">
import { HoverCard } from '../../src/components/popover/index.ts';

let {
  openDelay = 0,
  closeDelay = 0,
  label = 'Jordan Lee',
}: {
  openDelay?: number;
  closeDelay?: number;
  label?: string;
} = $props();
</script>

<HoverCard.Root {openDelay} {closeDelay}>
  <HoverCard.Trigger>{label}</HoverCard.Trigger>
  <HoverCard.Content aria-label={label}>
    <div class="tx-hover-card__header">
      <p class="tx-hover-card__title">{label}</p>
      <p class="tx-hover-card__description">Mathematician · example.com</p>
    </div>
  </HoverCard.Content>
</HoverCard.Root>
