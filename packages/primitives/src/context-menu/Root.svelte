<script lang="ts">
import type { OverlayController } from '@texuli/core/overlay-core';
import type { VirtualElement } from '@texuli/core/position-dom';
import type { Snippet } from 'svelte';
import { menuLevelContext } from '../menu/context.ts';
import { createMenuLevel } from '../menu/level.ts';
import { type ContextMenuPoint, contextMenuContext } from './context.ts';

interface Props {
  /** Whether the menu is open (`bind:open`). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Arrow keys wrap from the last item to the first. Default `true`. */
  loop?: boolean;
  children?: Snippet;
}

let { open = $bindable(false), onOpenChange, loop = true, children }: Props = $props();

const uid = $props.id();
/** Consumer ids claimed by the trigger and content; they win over the generated ones. */
const claims = $state<{ trigger?: string; content?: string }>({});
const level = createMenuLevel({
  claims,
  id: uid,
  parent: null,
  getOpen: () => open,
  setOpenValue(next) {
    open = next;
    onOpenChange?.(next);
  },
  loop: () => loop,
});

// The Menu machinery, anchored at a point instead of the trigger. The point
// is kept relative to the trigger region, so the menu follows it on scroll.
let offset: ContextMenuPoint = { x: 0, y: 0 };
let controller: OverlayController | undefined;
let returnFocus: HTMLElement | null = null;
const anchor: VirtualElement = {
  getBoundingClientRect() {
    const box = level.triggerElement?.getBoundingClientRect();
    return { x: (box?.x ?? 0) + offset.x, y: (box?.y ?? 0) + offset.y, width: 0, height: 0 };
  },
  get contextElement() {
    return level.triggerElement;
  },
};

const registerContent = level.registerContent;
level.registerContent = (element, next) => {
  registerContent(element);
  controller = element ? next : undefined;
  if (element) next?.setAnchor(anchor);
};
// The trigger region need not be focusable: closing returns focus to what
// had it before the menu opened.
const close = level.close;
level.close = (restore) => {
  close(false);
  if (restore && returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
};

contextMenuContext.set({
  openAt(point, intent, focus) {
    const box = level.triggerElement?.getBoundingClientRect();
    offset = { x: point.x - (box?.x ?? 0), y: point.y - (box?.y ?? 0) };
    returnFocus = focus instanceof HTMLElement && focus !== focus.ownerDocument.body ? focus : null;
    if (level.open) {
      // Already open: move it to the new point and take focus again.
      controller?.update();
      level.contentElement?.focus({ preventScroll: true });
      return;
    }
    level.setOpen(true, intent);
  },
});
menuLevelContext.set(level);
</script>

{@render children?.()}
