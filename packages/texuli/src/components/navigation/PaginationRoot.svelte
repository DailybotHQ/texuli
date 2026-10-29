<script lang="ts">
import {
  type PaginationSnippetProps,
  Pagination as Primitive,
} from '@texuli/primitives/pagination';
import type { ComponentProps, Snippet } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import { getStablePageTokens } from './pagination-tokens.ts';
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
  /**
   * Keep the number of tokens (pages and ellipses) constant and size every
   * page button for the widest page number, so the control never shifts as
   * the page changes. Custom `children` receive the stable `pages` too.
   */
  stableCount?: boolean;
};

let {
  children,
  class: className,
  size = 'md',
  variant = 'outline',
  page = $bindable(1),
  siblings = 1,
  boundaries = 1,
  stableCount = false,
  onPageChange,
  ref = $bindable(null),
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

function tokensFor(ctx: PaginationSnippetProps): PaginationSnippetProps {
  if (!stableCount) return ctx;
  return { ...ctx, pages: getStablePageTokens(ctx.page, ctx.pageCount, siblings, boundaries) };
}

/** Widest page number, in digits: every page button reserves that width. */
const digitsStyle = (ctx: PaginationSnippetProps) =>
  `--tx-pagination-digits: ${String(ctx.pageCount).length}`;
</script>

<Primitive.Root bind:ref
  class={classes}
  data-tx-pagination
  data-size={size}
  data-variant={variant}
  data-stable-count={stableCount ? '' : undefined}
  bind:page
  onPageChange={handlePageChange}
  {siblings}
  {boundaries}
  {...rest}
>
  {#snippet children(given)}
    {@const ctx = tokensFor(given)}
    {#if children}
      {@render children(ctx)}
    {:else}
      <ul class={paginationListClass()} style={stableCount ? digitsStyle(ctx) : undefined}>
        <li class={paginationItemClass()}>
          <Primitive.PreviousButton class={paginationButtonClass()} />
        </li>
        {#each ctx.pages as token (token)}
          <li class={paginationItemClass()}>
            {#if typeof token === 'number'}
              <Primitive.Page page={token} class={paginationButtonClass()} data-tx-pagination-page="">
                {token}
              </Primitive.Page>
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
