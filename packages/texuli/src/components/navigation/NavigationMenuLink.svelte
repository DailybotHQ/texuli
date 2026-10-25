<script lang="ts">
import { NavigationMenu as Primitive } from '@texuli/primitives/navigation-menu';
import type { ComponentProps, Snippet } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import { navigationMenuLinkClass } from './variants.ts';

type Props = ComponentProps<typeof Primitive.Link> & {
  children?: Snippet;
  class?: ClassValue;
};

let { children, class: className, active = false, ...rest }: Props = $props();
</script>

<Primitive.Link
  class={navigationMenuLinkClass({
    class: className,
    active: Boolean(active),
  })}
  {active}
  {...rest}
>
  {@render children?.()}
</Primitive.Link>
