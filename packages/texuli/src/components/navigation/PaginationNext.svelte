<script lang="ts">
import { Pagination as Primitive } from '@texuli/primitives/pagination';
import type { ComponentProps, Snippet } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import { paginationButtonClass } from './variants.ts';

type Props = ComponentProps<typeof Primitive.NextButton> & {
  children?: Snippet;
  class?: ClassValue;
};

let { children, class: className, ...rest }: Props = $props();
</script>

<Primitive.NextButton
  class={paginationButtonClass({
    class: className,
  })}
  {...rest}
>
  {@render children?.()}
</Primitive.NextButton>
