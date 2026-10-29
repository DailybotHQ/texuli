<script lang="ts">
import { untrack } from 'svelte';
import { createAttachmentKey } from 'svelte/attachments';
import type { HTMLAttributes } from 'svelte/elements';
import type { ChildSnippet } from '../internal/child.ts';
import type { RefProp } from '../internal/ref.ts';
import { menuLevelContext } from '../menu/context.ts';
import {
  type ContextMenuPoint,
  contextMenuContext,
  LONG_PRESS_MS,
  LONG_PRESS_SLOP,
} from './context.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** No menu: the browser's own context menu shows. */
  disabled?: boolean;
  children?: import('svelte').Snippet;
  child?: ChildSnippet<Record<string, unknown>>;
} & RefProp;
type Div<E extends Event> = E & { currentTarget: EventTarget & HTMLDivElement };

let { disabled = false, children, child, ref = $bindable(null), ...rest }: Props = $props();
const level = menuLevelContext.get();
// A consumer id wins: the context records it, so every reference follows.
level.claimId(
  'trigger',
  untrack(() => rest.id)
);
$effect(() => {
  level.claimId('trigger', rest.id);
  return () => level.claimId('trigger', undefined);
});
const menu = contextMenuContext.get();

let press: { id: number; x: number; y: number; timer: ReturnType<typeof setTimeout> } | null = null;
let lastPointerDown = Number.NEGATIVE_INFINITY;
let swallow = false;

function register(node: HTMLElement): () => void {
  level.registerTrigger(node);
  // No iOS callout during a long press (CSSOM, so it reaches a child element too).
  node.style.setProperty('-webkit-touch-callout', 'none');
  return () => {
    level.registerTrigger(undefined);
    cancelPress();
  };
}

function cancelPress(): void {
  if (press) clearTimeout(press.timer);
  press = null;
}

function oncontextmenu(event: Div<MouseEvent>): void {
  rest.oncontextmenu?.(event);
  if (disabled || event.defaultPrevented) return;
  event.preventDefault();
  // A long press already opened it (some browsers then fire contextmenu too).
  if (swallow) return;
  cancelPress();
  const active = event.currentTarget.ownerDocument.activeElement;
  if (event.timeStamp - lastPointerDown < 1000) {
    // A pointer (right button, Ctrl+click or a long press): at the pointer, focus on the menu.
    menu.openAt({ x: event.clientX, y: event.clientY }, 'content', active);
    return;
  }
  // The keyboard (the Menu key or Shift+F10): under the focused element, on its first item.
  const box = (event.target as Element).getBoundingClientRect();
  menu.openAt({ x: box.x, y: box.y + box.height }, 'first', active);
}

function onpointerdown(event: Div<PointerEvent>): void {
  rest.onpointerdown?.(event);
  lastPointerDown = event.timeStamp;
  swallow = false;
  // The region counts as inside the menu for outside dismissal, so a press on
  // it that is not a context press (right button, Ctrl+click) closes it here.
  if (level.open && event.button !== 2 && !event.ctrlKey) level.closeAll(false);
  if (disabled || event.defaultPrevented || event.pointerType === 'mouse' || !event.isPrimary)
    return;
  cancelPress();
  const point: ContextMenuPoint = { x: event.clientX, y: event.clientY };
  const active = event.currentTarget.ownerDocument.activeElement;
  press = {
    id: event.pointerId,
    ...point,
    timer: setTimeout(() => {
      press = null;
      swallow = true;
      menu.openAt(point, 'content', active);
    }, LONG_PRESS_MS),
  };
}

function onpointermove(event: Div<PointerEvent>): void {
  rest.onpointermove?.(event);
  if (!press || event.pointerId !== press.id) return;
  if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > LONG_PRESS_SLOP) cancelPress();
}

function onpointerup(event: Div<PointerEvent>): void {
  rest.onpointerup?.(event);
  if (press?.id === event.pointerId) cancelPress();
}

function onpointercancel(event: Div<PointerEvent>): void {
  rest.onpointercancel?.(event);
  if (press?.id === event.pointerId) cancelPress();
}

function onclickcapture(event: Div<MouseEvent>): void {
  rest.onclickcapture?.(event);
  // Lifting the finger after a long press is not a click on the region.
  if (!swallow) return;
  swallow = false;
  event.preventDefault();
  event.stopPropagation();
}

const registerKey = createAttachmentKey();
const triggerProps = $derived({
  ...rest,
  id: level.triggerId,
  'data-state': level.open ? 'open' : 'closed',
  'data-disabled': disabled ? '' : undefined,
  'data-context-menu-trigger': '',
  oncontextmenu,
  onpointerdown,
  onpointermove,
  onpointerup,
  onpointercancel,
  onclickcapture,
  // Part of the trigger props, so a `child` snippet's element registers too.
  [registerKey]: register,
});
</script>

{#if child}
  {@render child({ props: triggerProps })}
{:else}
  <div bind:this={ref} {...triggerProps}>
    {@render children?.()}
  </div>
{/if}
