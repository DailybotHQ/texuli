<script lang="ts">
import { type Snippet, untrack } from 'svelte';
import type { HTMLInputAttributes } from 'svelte/elements';
import type { ChildSnippet } from '../internal/child.ts';
import { getComboboxContext } from './context.ts';

type Props = Omit<HTMLInputAttributes, 'value' | 'children'> & {
  value?: string;
  children?: Snippet;
  child?: ChildSnippet<Record<string, unknown>>;
};

let { value, child, oninput, onkeydown, ...rest }: Props = $props();
const context = getComboboxContext();
// A consumer id wins: the context records it, so every reference follows.
context.claimId(
  'input',
  untrack(() => rest.id)
);
$effect(() => {
  context.claimId('input', rest.id);
  return () => context.claimId('input', undefined);
});
const text = $derived(value ?? context.query);

function attach(node: HTMLInputElement): () => void {
  context.registerInput(node);
  return () => context.registerInput(undefined);
}

function handleInput(event: Event): void {
  oninput?.(event as InputEvent & { currentTarget: EventTarget & HTMLInputElement });
  if (event.defaultPrevented) return;
  context.setQuery((event.currentTarget as HTMLInputElement).value);
}

function handleKeydown(event: KeyboardEvent): void {
  onkeydown?.(event as KeyboardEvent & { currentTarget: EventTarget & HTMLInputElement });
  if (event.defaultPrevented || context.disabled) return;
  const enabled = context.items.filter((item) => !item.disabled);
  const currentIndex = enabled.findIndex((item) => item.value === context.activeValue);
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    if (!context.open) context.setOpen(true, event);
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    const start =
      currentIndex < 0 ? (direction > 0 ? 0 : enabled.length - 1) : currentIndex + direction;
    const next = enabled[(start + enabled.length) % enabled.length];
    if (next) context.setActive(next.value);
  } else if (event.key === 'Enter' && context.activeValue) {
    event.preventDefault();
    context.select(context.activeValue);
  } else if (event.key === 'Escape' && context.open) {
    event.preventDefault();
    context.setOpen(false);
  } else if (event.key === 'Backspace' && context.multiple && !text) {
    const last = context.selected.at(-1);
    if (last) context.remove(last);
  }
}

const inputProps = $derived({
  ...rest,
  id: context.inputId,
  role: 'combobox' as const,
  value: text,
  disabled: context.disabled || undefined,
  autocomplete: 'off' as const,
  'aria-autocomplete': 'list' as const,
  'aria-expanded': context.open,
  'aria-controls': context.listId,
  'aria-haspopup': 'listbox' as const,
  'aria-activedescendant': context.activeValue ? context.itemId(context.activeValue) : undefined,
  'aria-busy': context.loading || undefined,
  'data-state': context.open ? 'open' : 'closed',
  'data-disabled': context.disabled ? '' : undefined,
  oninput: handleInput,
  onkeydown: handleKeydown,
});
</script>

{#if child}
  {@render child({ props: inputProps })}
{:else}
  <input {...inputProps} {@attach attach} />
{/if}
