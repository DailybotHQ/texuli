<script lang="ts">
import {
  type PaginationSnippetProps,
  Pagination as Primitive,
} from '@texuli/primitives/pagination';
import type { ComponentProps, Snippet } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import {
  type NavSize,
  type PaginationVariant,
  paginationButtonClass,
  paginationClass,
  paginationEllipsisClass,
  paginationItemClass,
  paginationListClass,
} from './variants.ts';
import './navigation.css';

type Props = Omit<ComponentProps<typeof Primitive.Root>, 'children'> & {
  children?: Snippet<[PaginationSnippetProps]>;
  class?: ClassValue;
  size?: NavSize;
  variant?: PaginationVariant;
  page?: number;
};

let {
  children,
  class: className,
  size = 'md',
  variant = 'outline',
  page = $bindable(1),
  onPageChange,
  ...rest
}: Props = $props();

const classes = $derived(
  paginationClass({
    size,
    variant,
    class: className,
  })
);

function handlePageChange(next: number): void {
  page = next;
  onPageChange?.(next);
}
</script>

<Primitive.Root
  class={classes}
  data-tx-pagination
  data-size={size}
  data-variant={variant}
  bind:page
  onPageChange={handlePageChange}
  {...rest}
>
  {#snippet children(ctx)}
    {#if children}
      {@render children(ctx)}
    {:else}
      <ul class={paginationListClass()}>
        <li class={paginationItemClass()}>
          <Primitive.PreviousButton class={paginationButtonClass()} />
        </li>
        {#each ctx.pages as token (token)}
          <li class={paginationItemClass()}>
            {#if typeof token === 'number'}
              <Primitive.Page page={token} class={paginationButtonClass()} />
            {:else}
              <Primitive.Ellipsis class={paginationEllipsisClass()} />
            {/if}
          </li>
        {/each}
        <li class={paginationItemClass()}>
          <Primitive.NextButton class={paginationButtonClass()} />
        </li>
      </ul>
    {/if}
  {/snippet}
</Primitive.Root>
