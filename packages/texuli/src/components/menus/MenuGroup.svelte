<script lang="ts">
import { Group as Primitive } from '@texuli/primitives/menu';
import type { ComponentProps, Snippet } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import './menus.css';

type Props = ComponentProps<typeof Primitive> & {
  children?: Snippet;
  class?: ClassValue;
};

let { children, class: className, ...rest }: Props = $props();
</script>

<Primitive
  class={className}
  data-tx-menu-group
  {...rest}
>
  {@render children?.()}
</Primitive>
