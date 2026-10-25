<script lang="ts">
import { HoverCardRoot as PrimitiveRoot } from '@texuli/primitives/hover-card';
import type { ComponentProps, Snippet } from 'svelte';

type Props = ComponentProps<typeof PrimitiveRoot> & {
  children?: Snippet;
  open?: boolean;
};

let { children, open = $bindable(false), onOpenChange, ...rest }: Props = $props();

function handleOpenChange(next: boolean): void {
  open = next;
  onOpenChange?.(next);
}
</script>

<div data-tx-hover-card-root class="tx-hover-card-root">
  <PrimitiveRoot bind:open onOpenChange={handleOpenChange} {...rest}>
    {@render children?.()}
  </PrimitiveRoot>
</div>
