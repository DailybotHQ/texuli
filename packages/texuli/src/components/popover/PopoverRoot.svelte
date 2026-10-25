<script lang="ts">
import { Root as PrimitiveRoot } from '@texuli/primitives/popover';
import type { ComponentProps, Snippet } from 'svelte';

type RootProps = ComponentProps<typeof PrimitiveRoot> & {
  children?: Snippet;
  open?: boolean;
};

let { children, open = $bindable(false), onOpenChange, ...rest }: RootProps = $props();

function handleOpenChange(next: boolean): void {
  open = next;
  onOpenChange?.(next);
}
</script>

<div data-tx-popover-root class="tx-popover-root">
  <PrimitiveRoot bind:open onOpenChange={handleOpenChange} {...rest}>
    {@render children?.()}
  </PrimitiveRoot>
</div>
