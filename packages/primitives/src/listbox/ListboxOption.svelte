<script lang="ts">
import { type Snippet, untrack } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { type ChildSnippet, composeChildProps } from '../internal/child.ts';
import type { RefProp } from '../internal/ref.ts';
import { listboxContext } from './context.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'value'> & {
  value: string;
  label?: string;
  disabled?: boolean;
  child?: ChildSnippet<Record<string, unknown>>;
  children?: Snippet;
} & RefProp;

let {
  value,
  label,
  disabled = false,
  child,
  children,
  ref = $bindable(null),
  ...rest
}: Props = $props();

const context = listboxContext.get();
// A consumer id wins: the context records it, so aria-activedescendant follows.
context.claimOptionId(
  untrack(() => value),
  untrack(() => rest.id)
);
$effect(() => {
  const item = value;
  context.claimOptionId(item, rest.id);
  return () => context.claimOptionId(item, undefined);
});
const effectiveDisabled = $derived(disabled || context.disabled());
const option = $derived(context.options().find((item) => item.value === value));
const optionLabel = $derived(label ?? option?.label ?? '');
const selected = $derived(context.isSelected(value));
const highlighted = $derived(context.activeValue() === value);

const baseProps = $derived({
  id: context.optionId(value),
  role: 'option' as const,
  tabindex: -1,
  'aria-selected': selected,
  'aria-disabled': effectiveDisabled ? true : undefined,
  'data-state': selected ? ('selected' as const) : ('unselected' as const),
  'data-highlighted': highlighted ? '' : undefined,
  'data-disabled': effectiveDisabled ? '' : undefined,
  'data-typeahead': optionLabel || undefined,
  onclick: () => {
    if (effectiveDisabled) return;
    context.setActive(value);
    context.select(value);
  },
});
const composedProps = $derived(composeChildProps(baseProps, rest as Partial<typeof baseProps>));
const optionProps = $derived({
  ...composedProps,
  id: context.optionId(value),
  role: 'option' as const,
  tabindex: -1,
  'aria-selected': selected,
  'aria-disabled': effectiveDisabled ? true : undefined,
  'data-state': selected ? ('selected' as const) : ('unselected' as const),
  'data-highlighted': highlighted ? '' : undefined,
  'data-disabled': effectiveDisabled ? '' : undefined,
  'data-typeahead': optionLabel || undefined,
});
</script>

{#if child}
  {@render child({ props: optionProps })}
{:else}
  <div bind:this={ref} {...optionProps}>
    {@render children?.()}
  </div>
{/if}
