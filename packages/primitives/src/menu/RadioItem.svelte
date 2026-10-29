<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { chainHandlers, composeHandlers } from '../internal/handlers.ts';
import type { RefProp } from '../internal/ref.ts';
import { menuLevelContext, menuRadioContext } from './context.ts';
import { activationKey, type MenuSelectEvent, selectItem } from './item.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onselect'> & {
  value: string;
  disabled?: boolean;
  textValue?: string;
  onSelect?: (event: MenuSelectEvent) => void;
  /** Close the menu after choosing. Default `true`. */
  closeOnSelect?: boolean;
  children?: Snippet<[{ checked: boolean }]>;
} & RefProp;

let {
  value,
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
const radio = menuRadioContext.get();
let highlighted = $state(false);
const checked = $derived(radio.value === value);

function run(event: Event & { currentTarget: EventTarget & HTMLElement }): void {
  if (disabled) return;
  radio.select(value);
  selectItem(event.currentTarget, level, event, { onSelect, closeOnSelect });
}
</script>

<div bind:this={ref}
  {...rest}
  role="menuitemradio"
  tabindex="-1"
  aria-checked={checked}
  aria-disabled={disabled ? 'true' : undefined}
  data-state={checked ? 'checked' : 'unchecked'}
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
  {@render children?.({ checked })}
</div>
