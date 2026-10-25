<script lang="ts">
import { Root as PrimitiveRoot } from '@texuli/primitives/select';
import type { ComponentProps, Snippet } from 'svelte';
import type { SelectSize, SelectVariant } from './variants.ts';
import './select.css';

type Props = ComponentProps<typeof PrimitiveRoot> & {
  children?: Snippet;
  open?: boolean;
  value?: string;
  size?: SelectSize;
  variant?: SelectVariant;
};

let {
  children,
  open = $bindable(false),
  value = $bindable(),
  size = 'md',
  variant = 'outline',
  onOpenChange,
  onValueChange,
  ...rest
}: Props = $props();

function handleOpenChange(next: boolean): void {
  open = next;
  onOpenChange?.(next);
}

function handleValueChange(next: string): void {
  value = next;
  onValueChange?.(next);
}
</script>

<div class="tx-select-root" data-tx-select-root data-size={size} data-variant={variant}>
  <PrimitiveRoot
    bind:open
    bind:value
    onOpenChange={handleOpenChange}
    onValueChange={handleValueChange}
    {...rest}
  >
    {@render children?.()}
  </PrimitiveRoot>
</div>
