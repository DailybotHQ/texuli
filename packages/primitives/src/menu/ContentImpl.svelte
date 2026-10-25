<script lang="ts">
import { createOverlayCore, type OverlayController } from '@texuli/core/overlay-core';
import { positionFloating } from '@texuli/core/position-dom';
import type { Placement } from '@texuli/core/position-math';
import { createRovingFocus } from '@texuli/core/roving';
import { type Snippet, untrack } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { type MenuLevel, menuItems } from './context.ts';
import { pointInPolygon } from './grace.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  level: MenuLevel;
  placement: Placement;
  sideOffset: number;
  children?: Snippet;
};

let { level, placement, sideOffset, children, onkeydown, onpointermove, ...rest }: Props = $props();
// A consumer id wins: the context records it, so every reference follows.
untrack(() => level.claimId('content', rest.id));
$effect(() => {
  level.claimId('content', rest.id);
  return () => level.claimId('content', undefined);
});

let content: HTMLElement | undefined;
const roving = createRovingFocus({
  items: () => menuItems(content),
  orientation: 'vertical',
  get wrap() {
    return level.loop;
  },
  typeahead: true,
  // The highlight moved: a submenu opened from another item closes.
  onActiveChange: (_index, item) => level.closeChildrenExcept(item),
});

function focusIntent(node: HTMLElement): void {
  const items = menuItems(node);
  const enabled = items.filter((item) => item.getAttribute('aria-disabled') !== 'true');
  const target =
    level.focusIntent === 'first'
      ? enabled[0]
      : level.focusIntent === 'last'
        ? enabled.at(-1)
        : level.focusIntent === 'content'
          ? node
          : undefined;
  level.focusIntent = null;
  if (!target) return;
  if (target === node) {
    roving.sync();
    node.focus({ preventScroll: true });
  } else roving.setActive(items.indexOf(target));
}

// The overlay lives as long as the element: nothing it reads (submenu state
// included) may re-run the attachment and tear it down.
function attach(node: HTMLElement): () => void {
  return untrack(() => mount(node));
}

function mount(node: HTMLElement): () => void {
  content = node;
  const trigger = level.triggerElement;
  const rtl = !!trigger && getComputedStyle(trigger).direction === 'rtl';
  const side = level.isSub && rtl ? (placement.replace('right', 'left') as Placement) : placement;
  const controller: OverlayController = createOverlayCore(
    {
      element: node,
      ...(trigger ? { anchor: trigger } : {}),
      position: {
        placement: side,
        offset: sideOffset,
        flip: true,
        shift: true,
        boundaryPadding: 8,
      },
      dismiss: { escape: true, pointerOutside: true, focusOutside: false },
      branches: () => [level.triggerElement, ...level.childContents()],
      label: level.isSub ? 'submenu' : 'menu',
      onDismissRequest(request) {
        // The menu closes itself: Escape returns focus to the trigger, an outside press does not.
        request.preventDefault();
        if (request.reason === 'escape') level.close(true);
        else {
          const target = request.originalEvent.target;
          const insideParent =
            target instanceof Node && level.parent?.contentElement?.contains(target);
          if (insideParent) level.close(false);
          else level.closeAll(false);
        }
      },
    },
    // Positioning only: a menu is not modal, so no focus trap, inert or scroll lock.
    { position: positionFloating }
  );
  level.registerContent(node, controller);
  controller.open();
  focusIntent(node);
  return () => {
    controller.destroy();
    level.registerContent(undefined);
    content = undefined;
  };
}

function handleKeydown(event: KeyboardEvent & { currentTarget: HTMLDivElement }): void {
  onkeydown?.(event);
  if (event.defaultPrevented) return;
  if (event.key === 'Tab') {
    // A menu is not in the page's tab order: Tab leaves it and returns to the trigger.
    event.preventDefault();
    level.closeAll(true);
    return;
  }
  const closeKey =
    getComputedStyle(event.currentTarget).direction === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
  if (level.isSub && event.key === closeKey) {
    event.preventDefault();
    level.close(true);
    return;
  }
  if (event.target === event.currentTarget && /^Arrow(Down|Up)$/.test(event.key)) {
    // Focus is on the menu itself (a pointer opened it, or the pointer left):
    // ArrowDown enters on the first item and ArrowUp on the last.
    const items = menuItems(content);
    const enabled = items.filter((item) => item.getAttribute('aria-disabled') !== 'true');
    const target = event.key === 'ArrowDown' ? enabled[0] : enabled.at(-1);
    event.preventDefault();
    if (target) roving.setActive(items.indexOf(target));
    return;
  }
  roving.handleKeydown(event);
}

function handlePointerMove(event: PointerEvent & { currentTarget: HTMLDivElement }): void {
  onpointermove?.(event);
  if (event.pointerType !== 'mouse' || event.defaultPrevented) return;
  const grace = level.grace;
  if (grace) {
    // Heading for an open submenu: hovers on the way do not count.
    if (
      Date.now() < grace.until &&
      pointInPolygon({ x: event.clientX, y: event.clientY }, grace.polygon)
    )
      return;
    level.grace = null;
  }
  const item = (event.target as Element).closest<HTMLElement>('[role^="menuitem"]');
  if (!item || item.closest('[role="menu"]') !== event.currentTarget) return;
  if (item.getAttribute('aria-disabled') === 'true') {
    event.currentTarget.focus({ preventScroll: true });
    return;
  }
  if (document.activeElement !== item) roving.setActive(menuItems(content).indexOf(item));
}

function handlePointerLeave(event: PointerEvent & { currentTarget: HTMLDivElement }): void {
  if (event.pointerType !== 'mouse' || level.grace) return;
  const active = document.activeElement;
  // Leaving the menu clears the highlight, unless a submenu is open from the focused item.
  if (active instanceof HTMLElement && active.getAttribute('aria-expanded') === 'true') return;
  if (event.currentTarget.contains(active)) event.currentTarget.focus({ preventScroll: true });
}
</script>

{#if level.open}
  <div
    {...rest}
    id={level.contentId}
    role="menu"
    aria-labelledby={level.triggerId}
    aria-orientation="vertical"
    tabindex="-1"
    data-state="open"
    popover="manual"
    onkeydown={handleKeydown}
    onpointermove={handlePointerMove}
    onpointerleave={handlePointerLeave}
    onfocusin={(event) => roving.handleFocusIn(event)}
    {@attach attach}
  >
    {@render children?.()}
  </div>
{/if}
