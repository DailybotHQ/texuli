<script lang="ts">
import { composeChildProps } from '../internal/child.ts';
import type { RefProp } from '../internal/ref.ts';
import { paginationContext } from './context.ts';
import type { PaginationClickEvent, PaginationNavigationButtonProps } from './types.ts';

let {
  disabled = false,
  label = 'Previous page',
  child,
  children,
  onclick,
  class: className,
  ref = $bindable(null),
  ...rest
}: PaginationNavigationButtonProps & RefProp = $props();
const context = paginationContext.get();
const isDisabled = $derived(Boolean(disabled || context.disabled() || context.page() <= 1));

function handleClick(event: PaginationClickEvent): void {
  onclick?.(event);
  if (!event.defaultPrevented && !isDisabled) context.goToPage(context.page() - 1);
}

const attrs = $derived({
  ...rest,
  type: 'button' as const,
  disabled: isDisabled || undefined,
  'aria-label': label,
  'data-state': isDisabled ? ('disabled' as const) : ('active' as const),
  'data-disabled': isDisabled ? '' : undefined,
  class: typeof className === 'string' ? className : undefined,
  onclick: handleClick,
});
const childProps = $derived(child ? composeChildProps(attrs, {}) : attrs);
</script>

{#if child}
  {@render child({ props: childProps })}
{:else}
  <button bind:this={ref} {...childProps}>
    {#if children}{@render children()}{:else}{label}{/if}
  </button>
{/if}
