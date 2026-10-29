<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { ChildSnippet } from '../internal/child.ts';
import { chainHandlers } from '../internal/handlers.ts';
import type { RefProp } from '../internal/ref.ts';
import { menuLevelContext } from './context.ts';
import { activationKey, type MenuSelectEvent, selectItem } from './item.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onselect'> & {
  disabled?: boolean;
  /** Text typeahead matches (defaults to the item's text). */
  textValue?: string;
  /** Called when the item runs; `event.preventDefault()` keeps the menu open. */
  onSelect?: (event: MenuSelectEvent) => void;
  /** Close the menu after the item runs. Default `true`. */
  closeOnSelect?: boolean;
  children?: Snippet;
  child?: ChildSnippet<Record<string, unknown>>;
} & RefProp;

let {
  disabled = false,
  textValue,
  onSelect,
  closeOnSelect = true,
  children,
  child,
  onclick,
  onkeydown,
  onfocus,
  onblur,
  ref = $bindable(null),
  ...rest
}: Props = $props();
const level = menuLevelContext.get();
let highlighted = $state(false);

function run(event: Event & { currentTarget: EventTarget & HTMLElement }): void {
  if (disabled) return;
  selectItem(event.currentTarget, level, event, { onSelect, closeOnSelect });
}

const itemProps = $derived({
  ...rest,
  role: 'menuitem',
  tabindex: -1,
  'aria-disabled': disabled ? ('true' as const) : undefined,
  'data-disabled': disabled ? '' : undefined,
  'data-highlighted': highlighted ? '' : undefined,
  'data-typeahead': textValue,
  onfocus: chainHandlers(onfocus, () => (highlighted = true)),
  onblur: chainHandlers(onblur, () => (highlighted = false)),
  onclick: (event: MouseEvent & { currentTarget: EventTarget & HTMLDivElement }) => {
    onclick?.(event);
    if (!event.defaultPrevented) run(event);
  },
  onkeydown: (event: KeyboardEvent & { currentTarget: EventTarget & HTMLDivElement }) => {
    onkeydown?.(event);
    if (event.defaultPrevented || !activationKey(event)) return;
    event.preventDefault();
    run(event);
  },
});
</script>

{#if child}
  {@render child({ props: itemProps })}
{:else}
  <div bind:this={ref} {...itemProps}>{@render children?.()}</div>
{/if}
