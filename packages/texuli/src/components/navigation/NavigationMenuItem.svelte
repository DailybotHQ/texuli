<script lang="ts">
import { NavigationMenu as Primitive } from '@texuli/primitives/navigation-menu';
import type { ComponentProps, Snippet } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import { navigationMenuItemClass } from './variants.ts';

type Props = ComponentProps<typeof Primitive.Item> & {
  children?: Snippet;
  class?: ClassValue;
};

let { children, class: className, ref = $bindable(null), ...rest }: Props = $props();
</script>

<Primitive.Item bind:ref
  class={navigationMenuItemClass({ class: className })}
  {...rest}
>
  {@render children?.()}
</Primitive.Item>
