<script lang="ts">
import { Root as Primitive } from '@texuli/primitives/menu';
import type { ComponentProps, Snippet } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import './menus.css';

type Props = ComponentProps<typeof Primitive> & {
  children?: Snippet;
  class?: ClassValue;
};

let { children, class: className, open = $bindable(false), ...rest }: Props = $props();
</script>

<div
  class={className}
  data-tx-dropdown-menu
  data-state={open ? 'open' : 'closed'}
>
  <Primitive bind:open {...rest}>{@render children?.()}</Primitive>
</div>
