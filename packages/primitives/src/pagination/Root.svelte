<script lang="ts">
import { composeChildProps } from '../internal/child.ts';
import type { RefProp } from '../internal/ref.ts';
import { stateAttributes } from '../internal/state.ts';
import { paginationContext } from './context.ts';
import { getPageCount, getPageTokens } from './pages.ts';
import type { PaginationRootProps } from './types.ts';

let {
  page = $bindable(1),
  pageCount,
  total,
  pageSize = 10,
  siblings = 1,
  boundaries = 1,
  disabled = false,
  label = 'Pagination',
  previousLabel = 'Previous page',
  nextLabel = 'Next page',
  getPageLabel = (value: number) => `Page ${value}`,
  onPageChange,
  child,
  children,
  class: className,
  ref = $bindable(null),
  ...rest
}: PaginationRootProps & RefProp = $props();

const count = $derived(getPageCount(pageCount, total, pageSize));
const currentPage = $derived(
  Math.min(Math.max(Number.isFinite(page) ? Math.floor(page) : 1, 1), count)
);
const tokens = $derived(getPageTokens(currentPage, count, siblings, boundaries));

function goToPage(requested: number): void {
  if (disabled || !Number.isFinite(requested)) return;
  const next = Math.min(Math.max(Math.floor(requested), 1), count);
  if (next === currentPage) return;
  page = next;
  onPageChange?.(next);
}

paginationContext.set({
  page: () => currentPage,
  pageCount: () => count,
  disabled: () => disabled,
  goToPage,
});

const snippetArgs = $derived({
  page: currentPage,
  pageCount: count,
  pages: tokens,
  previousLabel,
  nextLabel,
  getPageLabel,
});
const rootProps = $derived({
  ...rest,
  ...stateAttributes(disabled ? 'disabled' : 'active'),
  'data-tx-pagination-root': '',
  'aria-label': label,
  class: typeof className === 'string' ? className : undefined,
});
const childProps = $derived(child ? composeChildProps(rootProps, {}) : rootProps);
</script>

{#if child}
  {@render child({ props: childProps })}
{:else}
  <nav bind:this={ref} {...childProps}>
    {#if children}
      {@render children(snippetArgs)}
    {:else}
      <ul>
        <li><button type="button" aria-label={previousLabel} disabled={disabled || currentPage <= 1} onclick={() => goToPage(currentPage - 1)}>{previousLabel}</button></li>
        {#each tokens as token (token)}
          {#if typeof token === 'number'}
            <li>
              <button
                type="button"
                aria-label={getPageLabel(token)}
                aria-current={token === currentPage ? 'page' : undefined}
                data-state={token === currentPage ? 'active' : 'inactive'}
                disabled={disabled}
                onclick={() => goToPage(token)}
              >{token}</button>
            </li>
          {:else}
            <li><span aria-hidden="true" data-state="inactive">…</span></li>
          {/if}
        {/each}
        <li><button type="button" aria-label={nextLabel} disabled={disabled || currentPage >= count} onclick={() => goToPage(currentPage + 1)}>{nextLabel}</button></li>
      </ul>
    {/if}
  </nav>
{/if}
