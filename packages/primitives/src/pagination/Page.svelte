<script lang="ts">
import { composeChildProps } from '../internal/child.ts';
import { paginationContext } from './context.ts';
import type { PaginationClickEvent, PaginationPageProps } from './types.ts';

let {
  page,
  label,
  disabled = false,
  child,
  children,
  onclick,
  class: className,
  ...rest
}: PaginationPageProps = $props();
const context = paginationContext.get();
const current = $derived(context.page() === page);
const isDisabled = $derived(Boolean(disabled || context.disabled()));

function handleClick(event: PaginationClickEvent): void {
  onclick?.(event);
  if (!event.defaultPrevented && !isDisabled) context.goToPage(page);
}

const attrs = $derived({
  ...rest,
  type: 'button' as const,
  disabled: isDisabled || undefined,
  'aria-current': current ? ('page' as const) : undefined,
  'aria-label': label ?? `Page ${page}`,
  'data-state': current ? ('active' as const) : ('inactive' as const),
  'data-disabled': isDisabled ? '' : undefined,
  class: typeof className === 'string' ? className : undefined,
  onclick: handleClick,
});
const childProps = $derived(child ? composeChildProps(attrs, {}) : attrs);
</script>

{#if child}
  {@render child({ props: childProps })}
{:else}
  <button {...childProps}>{@render children?.()}</button>
{/if}
