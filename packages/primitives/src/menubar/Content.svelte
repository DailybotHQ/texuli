<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import MenuContent from '../menu/Content.svelte';
import { menubarContext, menubarMenuContext } from './context.ts';

/**
 * A menu's content. ArrowRight and ArrowLeft (swapped in RTL) close it and
 * open the next or previous menu of the bar on its first item. On a submenu
 * trigger ArrowRight opens the submenu; inside a submenu ArrowLeft closes it,
 * and ArrowRight on a plain item moves on to the next menu (APG).
 */
type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
  children?: Snippet;
};

let { onkeydown, children, ...rest }: Props = $props();

const bar = menubarContext.get();
const menu = menubarMenuContext.get();

function handleKeydown(event: KeyboardEvent & { currentTarget: EventTarget & HTMLDivElement }) {
  (onkeydown as ((e: KeyboardEvent) => void) | undefined)?.(event);
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
  const target = event.target as Element;
  const rtl = bar.isRtl(event.currentTarget);
  const forward = event.key === (rtl ? 'ArrowLeft' : 'ArrowRight');
  const back = event.key === (rtl ? 'ArrowRight' : 'ArrowLeft');
  if (!forward && !back) return;
  // In an open submenu, the back key closes the submenu (the Menu primitive
  // handles it first); only the forward key reaches the next menu (APG).
  if (back && target.closest('[role="menu"]') !== event.currentTarget) return;
  // A submenu trigger handles its own ArrowRight first (it opens the submenu
  // and prevents the default), so it never reaches this point.
  const next = bar.neighbor(menu.value, forward ? 1 : -1);
  if (!next || next === menu.value) return;
  event.preventDefault();
  bar.move(next, true, 'first');
}
</script>

<MenuContent {...rest} onkeydown={handleKeydown}>{@render children?.()}</MenuContent>
