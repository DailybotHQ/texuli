<script lang="ts">
import { type Snippet, untrack } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { type ChildSnippet, composeChildProps } from '../internal/child.ts';
import type { RefProp } from '../internal/ref.ts';
import { commandContext, getOptionalCommandGroupContext } from './context.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'value' | 'children'> & {
  child?: ChildSnippet<Record<string, unknown>>;
  children?: Snippet;
  disabled?: boolean;
  keywords?: readonly string[];
  label?: string;
  onSelect?: (value: string) => void;
  value: string;
} & RefProp;
let {
  child,
  children,
  disabled = false,
  keywords = [],
  label,
  onSelect,
  value,
  ref = $bindable(null),
  ...rest
}: Props = $props();
const context = commandContext.get();
// A consumer id wins: the context records it, so aria-activedescendant follows.
context.claimId(
  `item:${untrack(() => value)}`,
  untrack(() => rest.id)
);
$effect(() => {
  const part = `item:${value}` as const;
  context.claimId(part, rest.id);
  return () => context.claimId(part, undefined);
});
const group = getOptionalCommandGroupContext();
const token = {};
const text = $derived(label ?? value);
const effectiveDisabled = $derived(disabled || Boolean(group?.disabled));
const visible = $derived(context.isVisible(token));
const active = $derived(context.isActive(value));
$effect(() =>
  context.register(token, {
    value,
    label: text,
    keywords,
    disabled: effectiveDisabled,
    ...(onSelect ? { onSelect: () => onSelect(value) } : {}),
    ...(group ? { group: group.value, groupDisabled: group.disabled } : { groupDisabled: false }),
  })
);

function activate(): void {
  if (effectiveDisabled) return;
  context.select(value);
}

const optionProps = $derived(
  composeChildProps(
    {
      id: context.itemId(value),
      role: 'option' as const,
      tabindex: -1,
      'aria-selected': active,
      'aria-disabled': effectiveDisabled ? true : undefined,
      'data-state': active ? 'selected' : 'unselected',
      'data-highlighted': active ? '' : undefined,
      'data-disabled': effectiveDisabled ? '' : undefined,
      hidden: !visible,
      onclick: activate,
      onpointermove: () => {
        if (!effectiveDisabled) context.setActive(value);
      },
    },
    rest as Partial<Record<string, unknown>>
  )
);
</script>

{#if child}
  {@render child({ props: optionProps })}
{:else}
  <div bind:this={ref} {...optionProps} data-command-item="">{@render children?.()}</div>
{/if}
