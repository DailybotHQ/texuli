<script lang="ts">
import { NavigationMenu as Primitive } from '@texuli/primitives/navigation-menu';
import type { ComponentProps, Snippet } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import { navigationMenuViewportClass } from './variants.ts';

type Props = ComponentProps<typeof Primitive.Viewport> & {
  children?: Snippet;
  class?: ClassValue;
};

let { children, class: className, ref = $bindable(null), ...rest }: Props = $props();
</script>

<Primitive.Viewport bind:ref
  class={navigationMenuViewportClass({
    class: className,
  })}
  {...rest}
>
  {@render children?.()}
</Primitive.Viewport>
