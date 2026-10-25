<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
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
};

let {
  value,
  disabled = false,
  textValue,
  onSelect,
  closeOnSelect = true,
  children,
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

<div
  {...rest}
  role="menuitemradio"
  tabindex="-1"
  aria-checked={checked}
  aria-disabled={disabled ? 'true' : undefined}
  data-state={checked ? 'checked' : 'unchecked'}
  data-disabled={disabled ? '' : undefined}
  data-highlighted={highlighted ? '' : undefined}
  data-typeahead={textValue}
  onfocus={() => (highlighted = true)}
  onblur={() => (highlighted = false)}
  onclick={(event) => run(event)}
  onkeydown={(event) => {
    if (!activationKey(event)) return;
    event.preventDefault();
    run(event);
  }}
>
  {@render children?.({ checked })}
</div>
