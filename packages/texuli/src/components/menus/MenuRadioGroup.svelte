<script lang="ts">
import { RadioGroup as Primitive } from '@texuli/primitives/menu';
import type { ComponentProps, Snippet } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import './menus.css';

type Props = ComponentProps<typeof Primitive> & {
  children?: Snippet;
  class?: ClassValue;
};

let { children, class: className, value = $bindable(''), ...rest }: Props = $props();
</script>

<Primitive
  class={className}
  data-tx-menu-radio-group
  bind:value
  {...rest}
>
  {@render children?.()}
</Primitive>
