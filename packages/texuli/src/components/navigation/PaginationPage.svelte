<script lang="ts">
import { Pagination as Primitive } from '@texuli/primitives/pagination';
import type { ComponentProps, Snippet } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import { paginationButtonClass } from './variants.ts';

type Props = ComponentProps<typeof Primitive.Page> & {
  children?: Snippet;
  class?: ClassValue;
};

let { children, class: className, page, ref = $bindable(null), ...rest }: Props = $props();
</script>

<Primitive.Page bind:ref
  {page}
  data-tx-pagination-page=""
  class={paginationButtonClass({
    class: className,
  })}
  {...rest}
>
  {#if children}
    {@render children()}
  {:else}
    {page}
  {/if}
</Primitive.Page>
