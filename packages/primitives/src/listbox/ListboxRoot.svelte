<script lang="ts">
import { createTypeahead } from '@texuli/core/roving';
import { type Snippet, untrack } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { composeHandlers } from '../internal/handlers.ts';
import type { RefProp } from '../internal/ref.ts';
import { type ListboxItemData, listboxContext } from './context.ts';

type Selection = string | readonly string[] | undefined;
type Props = HTMLAttributes<HTMLDivElement> & {
  value?: Selection;
  defaultValue?: Selection;
  multiple?: boolean;
  disabled?: boolean;
  loop?: boolean;
  id?: string;
  items: readonly ListboxItemData[];
  onValueChange?: (value: Selection) => void;
  onActiveChange?: (value: string, index: number) => void;
  children?: Snippet;
} & RefProp;

let {
  value = $bindable(),
  defaultValue,
  multiple = false,
  disabled = false,
  loop = true,
  id,
  items,
  onValueChange,
  onActiveChange,
  children,
  onkeydown,
  ref = $bindable(null),
  ...rest
}: Props = $props();

const generatedId = $props.id();
/** Consumer ids claimed by options, by value; they win over the generated ones. */
let claimedOptionIds = $state<Record<string, string | undefined>>({});
const initialValue = untrack(() => value ?? defaultValue ?? (multiple ? [] : undefined));
const controlled = untrack(() => value !== undefined);
let localValue = $state<Selection>(initialValue);
let active = $state<string>();
const selectedValues = $derived.by(() => {
  const current = value ?? localValue;
  if (Array.isArray(current)) return current;
  return current === undefined ? [] : [current];
});
const typeahead = createTypeahead();

function optionId(optionValue: string): string {
  return (
    claimedOptionIds[optionValue] ||
    `${id ?? generatedId}-option-${encodeURIComponent(optionValue)}`
  );
}

function currentOptions(): readonly ListboxItemData[] {
  return items;
}

function updateValue(next: readonly string[]): void {
  const result: Selection = multiple ? next : (next[0] ?? '');
  if (controlled) value = result;
  else {
    localValue = result;
    value = result;
  }
  onValueChange?.(result);
}

function select(optionValue: string): void {
  if (disabled) return;
  const option = currentOptions().find((item) => item.value === optionValue);
  if (!option || option.disabled) return;
  if (multiple) {
    const next = selectedValues.includes(optionValue)
      ? selectedValues.filter((selected) => selected !== optionValue)
      : [...selectedValues, optionValue];
    updateValue(next);
  } else if (!selectedValues.includes(optionValue)) {
    updateValue([optionValue]);
  }
}

function setActive(optionValue: string): void {
  if (active === optionValue) return;
  active = optionValue;
  const index = currentOptions().findIndex((item) => item.value === optionValue);
  if (index >= 0) onActiveChange?.(optionValue, index);
}

function findEnabled(
  collection: readonly ListboxItemData[],
  start: number,
  step: 1 | -1,
  wrap: boolean
): number {
  for (let offset = 0; offset < collection.length; offset += 1) {
    let index = start + offset * step;
    if (index < 0 || index >= collection.length) {
      if (!wrap) break;
      index = (index + collection.length) % collection.length;
    }
    if (!collection[index]?.disabled) return index;
  }
  return -1;
}

function navigate(event: KeyboardEvent): void {
  if (disabled) return;
  const collection = currentOptions();
  if (collection.length === 0) return;
  const current = collection.findIndex((item) => item.value === active);
  let next = -1;
  if (event.key === 'ArrowDown') {
    next = findEnabled(collection, current < 0 ? 0 : current + 1, 1, loop);
  } else if (event.key === 'ArrowUp') {
    next = findEnabled(collection, current < 0 ? collection.length - 1 : current - 1, -1, loop);
  } else if (event.key === 'Home') {
    next = findEnabled(collection, 0, 1, false);
  } else if (event.key === 'End') {
    next = findEnabled(collection, collection.length - 1, -1, false);
  } else {
    next = typeahead.match(
      event,
      collection.map((item) => item.label),
      current,
      (index) => {
        return !collection[index]?.disabled;
      }
    );
  }

  if (next >= 0 && next !== current) {
    event.preventDefault();
    const nextValue = collection[next]?.value;
    if (nextValue !== undefined) {
      setActive(nextValue);
      if (!multiple) select(nextValue);
    }
    return;
  }

  if (
    (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') &&
    active !== undefined
  ) {
    event.preventDefault();
    select(active);
  }
}

const context = {
  id: () => id ?? generatedId,
  multiple: () => multiple,
  disabled: () => disabled,
  selectedValues: () => selectedValues,
  activeValue: () => active,
  options: currentOptions,
  isSelected: (optionValue: string) => selectedValues.includes(optionValue),
  optionId,
  claimOptionId: (optionValue: string, claimed: string | null | undefined) => {
    claimedOptionIds[optionValue] = claimed || undefined;
  },
  setActive,
  select,
};

listboxContext.set(context);
</script>

<div bind:this={ref}
  {...rest}
  id={id ?? generatedId}
  role="listbox"
  tabindex={disabled ? -1 : 0}
  aria-multiselectable={multiple ? 'true' : undefined}
  aria-disabled={disabled ? 'true' : undefined}
  aria-activedescendant={active !== undefined ? optionId(active) : undefined}
  data-disabled={disabled ? '' : undefined}
  data-multiple={multiple ? '' : undefined}
  onkeydown={composeHandlers(onkeydown, navigate)}
>
  {@render children?.()}
</div>
