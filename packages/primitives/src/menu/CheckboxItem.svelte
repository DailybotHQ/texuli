<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { chainHandlers, composeHandlers } from '../internal/handlers.ts';
import type { RefProp } from '../internal/ref.ts';
import { menuLevelContext } from './context.ts';
import { activationKey, type MenuSelectEvent, selectItem } from './item.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onselect'> & {
  /** `bind:checked`. */
  checked?: boolean;
  /** Shows the mixed state (`aria-checked="mixed"`); the next choice checks it. */
  indeterminate?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  textValue?: string;
  onSelect?: (event: MenuSelectEvent) => void;
  /** Close the menu after toggling. Default `true`. */
  closeOnSelect?: boolean;
  children?: Snippet<[{ checked: boolean; indeterminate: boolean }]>;
} & RefProp;

let {
  checked = $bindable(false),
  indeterminate = $bindable(false),
  onCheckedChange,
  disabled = false,
  textValue,
  onSelect,
  closeOnSelect = true,
  children,
  ref = $bindable(null),
  onfocus,
  onblur,
  onclick,
  onkeydown,
  ...rest
}: Props = $props();
const level = menuLevelContext.get();
let highlighted = $state(false);

function run(event: Event & { currentTarget: EventTarget & HTMLElement }): void {
  if (disabled) return;
  const next = indeterminate ? true : !checked;
  indeterminate = false;
  checked = next;
  onCheckedChange?.(next);
  selectItem(event.currentTarget, level, event, { onSelect, closeOnSelect });
}

const dataState = $derived(indeterminate ? 'indeterminate' : checked ? 'checked' : 'unchecked');
</script>

<div bind:this={ref}
  {...rest}
  role="menuitemcheckbox"
  tabindex="-1"
  aria-checked={indeterminate ? 'mixed' : checked}
  aria-disabled={disabled ? 'true' : undefined}
  data-state={dataState}
  data-disabled={disabled ? '' : undefined}
  data-highlighted={highlighted ? '' : undefined}
  data-typeahead={textValue}
  onfocus={chainHandlers(onfocus, () => (highlighted = true))}
  onblur={chainHandlers(onblur, () => (highlighted = false))}
  onclick={composeHandlers(onclick, run)}
  onkeydown={composeHandlers(onkeydown, (event: KeyboardEvent & { currentTarget: EventTarget & HTMLElement }) => {
    if (!activationKey(event)) return;
    event.preventDefault();
    run(event);
  })}
>
  {@render children?.({ checked, indeterminate })}
</div>
