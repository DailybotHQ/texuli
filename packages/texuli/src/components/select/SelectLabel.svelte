<script lang="ts">
import { GroupLabel as PrimitiveGroupLabel } from '@texuli/primitives/select';
import type { ComponentProps, Snippet } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import { selectLabelClass } from './variants.ts';

type Props = Omit<ComponentProps<typeof PrimitiveGroupLabel>, 'children'> & {
  children?: Snippet;
  class?: ClassValue;
};

let { children, class: className, ref = $bindable(null), ...rest }: Props = $props();
</script>

<!--
  Composes the primitive GroupLabel: rendered inside a Select.Group it names
  that group (select group context → aria-labelledby). Like the primitive,
  it must sit inside a Select.Group.
-->
<PrimitiveGroupLabel bind:ref class={selectLabelClass({ class: className })} data-tx-select-label {...rest}>
  {@render children?.()}
</PrimitiveGroupLabel>
