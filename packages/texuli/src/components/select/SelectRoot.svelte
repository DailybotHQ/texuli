<script lang="ts">
import { Root as PrimitiveRoot } from '@texuli/primitives/select';
import type { ComponentProps, Snippet } from 'svelte';
import type { SelectSize, SelectVariant } from './variants.ts';
import './select.css';
import { designDefaults, withDefault } from '../../internal/design-defaults.ts';

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
  size: sizeProp,
  variant: variantProp,
  onOpenChange,
  onValueChange,
  ...rest
}: Props = $props();
const txDefaults = designDefaults('select');
const size = $derived(withDefault(sizeProp, txDefaults().size, 'md'));
const variant = $derived(withDefault(variantProp, txDefaults().variant, 'outline'));

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
