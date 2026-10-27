<script lang="ts">
import { Group as PrimitiveGroup } from '@texuli/primitives/select';
import type { ComponentProps, Snippet } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import { selectGroupClass } from './variants.ts';

type Props = Omit<ComponentProps<typeof PrimitiveGroup>, 'children'> & {
  children?: Snippet;
  class?: ClassValue;
};

let { children, class: className, ...rest }: Props = $props();
</script>

<!--
  Composes the primitive Group so the group is a named `role="group"`:
  the Select.Label inside it publishes its id through the select group
  context and the primitive wires `aria-labelledby` (APG listbox grouping).
-->
<PrimitiveGroup class={selectGroupClass({ class: className })} data-tx-select-group {...rest}>
  {@render children?.()}
</PrimitiveGroup>
