<script lang="ts">
import { NavigationMenu as Primitive } from '@texuli/primitives/navigation-menu';
import type { ComponentProps, Snippet } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import { navigationMenuListClass } from './variants.ts';

type Props = ComponentProps<typeof Primitive.List> & {
  children?: Snippet;
  class?: ClassValue;
};

let { children, class: className, ...rest }: Props = $props();
</script>

<Primitive.List
  class={navigationMenuListClass({ class: className })}
  {...rest}
>
  {@render children?.()}
</Primitive.List>
