<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';
import { composeHandlers } from '../internal/handlers.ts';
import type { RefProp } from '../internal/ref.ts';
import { stateAttributes } from '../internal/state.ts';
import { getSelectContext } from './context.ts';

type Props = Omit<HTMLAttributes<HTMLElement>, 'children'> & {
  value: string;
  label?: string;
  disabled?: boolean;
  children?: import('svelte').Snippet;
} & RefProp;

let {
  value,
  label,
  disabled = false,
  children,
  class: className,
  onclick,
  onpointermove,
  ref = $bindable(null),
  ...rest
}: Props = $props();

const context = getSelectContext();
const text = $derived(label ?? value);
const selected = $derived(context.value === value);
const highlighted = $derived(context.highlighted === value);
const inactive = $derived(Boolean(disabled));

function register(node: HTMLElement): () => void {
  const record = {
    value,
    get label() {
      return text;
    },
    get disabled() {
      return inactive;
    },
    element: node,
  };
  return context.registerItem(record);
}

function onClick(event: MouseEvent): void {
  if (inactive) {
    event.preventDefault();
    return;
  }
  context.selectValue(value);
}

function onPointerMove(): void {
  if (!inactive) context.setHighlighted(value);
}

const itemProps = $derived({
  ...rest,
  role: 'option' as const,
  'aria-selected': selected,
  'aria-disabled': inactive ? ('true' as const) : undefined,
  'data-highlighted': highlighted ? '' : undefined,
  'data-typeahead': text,
  ...stateAttributes(selected ? 'checked' : 'unchecked', inactive),
  class: className,
  onclick: composeHandlers(onclick, onClick),
  onpointermove: composeHandlers(onpointermove, onPointerMove),
});
</script>

<div bind:this={ref} {...itemProps} {@attach register}>
  {#if children}
    {@render children()}
  {:else}
    {text}
  {/if}
</div>
