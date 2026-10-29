<script lang="ts">
import type { HTMLButtonAttributes } from 'svelte/elements';
import type { RefProp } from '../internal/ref.ts';
import { menuLevelContext } from '../menu/context.ts';
import MenuTrigger from '../menu/Trigger.svelte';
import { menubarContext, menubarMenuContext } from './context.ts';

/**
 * A top-level `role="menuitem"` that opens its menu. Only the current Tab
 * stop has `tabindex="0"`. ArrowLeft and ArrowRight (swapped in RTL), Home
 * and End move between triggers; Enter, Space, ArrowDown and ArrowUp open the
 * menu (the Menu primitive's keys).
 */
type Props = Omit<HTMLButtonAttributes, 'children' | 'role'> & {
  children?: import('svelte').Snippet;
} & RefProp;

let {
  children,
  disabled = false,
  onkeydown,
  onpointerenter,
  onfocus,
  ref = $bindable(null),
  ...rest
}: Props = $props();

const bar = menubarContext.get();
const menu = menubarMenuContext.get();
const level = menuLevelContext.get();

$effect(() => {
  const value = menu.value;
  return bar.register(value, {
    level,
    trigger: () => level.triggerElement,
    disabled: () => Boolean(disabled),
  });
});

function handleKeydown(event: KeyboardEvent & { currentTarget: EventTarget & HTMLButtonElement }) {
  (onkeydown as ((e: KeyboardEvent) => void) | undefined)?.(event);
  if (event.defaultPrevented || disabled || event.altKey || event.ctrlKey || event.metaKey) return;
  const rtl = bar.isRtl(event.currentTarget);
  const step =
    event.key === (rtl ? 'ArrowLeft' : 'ArrowRight')
      ? 1
      : event.key === (rtl ? 'ArrowRight' : 'ArrowLeft')
        ? -1
        : event.key === 'Home'
          ? 'first'
          : event.key === 'End'
            ? 'last'
            : undefined;
  if (step === undefined) return;
  event.preventDefault();
  const target = bar.neighbor(menu.value, step);
  // A menu that was open stays open on the new trigger.
  if (target) bar.move(target, bar.value !== '' && target !== menu.value, 'first');
}

function handlePointerEnter(
  event: PointerEvent & { currentTarget: EventTarget & HTMLButtonElement }
) {
  (onpointerenter as ((e: PointerEvent) => void) | undefined)?.(event);
  // After the first open, hovering another trigger switches menus.
  if (event.pointerType !== 'mouse' || disabled || bar.value === '' || bar.value === menu.value)
    return;
  bar.move(menu.value, true, 'content');
}

function handleFocus(event: FocusEvent & { currentTarget: EventTarget & HTMLButtonElement }) {
  (onfocus as ((e: FocusEvent) => void) | undefined)?.(event);
  bar.setTabStop(menu.value);
}
</script>

<MenuTrigger bind:ref
  {...rest}
  {disabled}
  role="menuitem"
  tabindex={bar.tabStop === menu.value ? 0 : -1}
  data-tx-menubar-trigger=""
  data-disabled={disabled ? '' : undefined}
  onkeydown={handleKeydown}
  onpointerenter={handlePointerEnter}
  onfocus={handleFocus}
>
  {@render children?.()}
</MenuTrigger>
