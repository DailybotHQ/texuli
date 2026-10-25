<script lang="ts">
import { getContext, onDestroy, type Snippet, setContext } from 'svelte';
import {
  TOOLTIP_CONTEXT,
  TOOLTIP_GROUP_CONTEXT,
  type TooltipContext,
  type TooltipDelayGroup,
} from './context.ts';
import { createTooltipDelayGroup } from './delay-group.ts';

interface Props {
  open?: boolean;
  disabled?: boolean;
  delayDuration?: number;
  onOpenChange?: (open: boolean) => void;
  children?: Snippet;
}

let {
  open = $bindable(false),
  disabled = false,
  delayDuration,
  onOpenChange,
  children,
}: Props = $props();

const id = $props.id();
/** Consumer ids claimed by parts; they win over the generated ones. */
let claimedIds = $state<{ trigger?: string; content?: string }>({});
const inheritedGroup = getContext<TooltipDelayGroup | undefined>(TOOLTIP_GROUP_CONTEXT);
const group = inheritedGroup ?? createTooltipDelayGroup();
let triggerElement = $state<HTMLElement | null>(null);
let openTimer: ReturnType<typeof setTimeout> | undefined;
let closeTimer: ReturnType<typeof setTimeout> | undefined;
let longPressTimer: ReturnType<typeof setTimeout> | undefined;
let pointerInside = false;
let focusInside = false;
let openedByLongPress = false;
let wasOpen = open;

function clearOpenTimer() {
  if (openTimer !== undefined) clearTimeout(openTimer);
  openTimer = undefined;
}

function clearCloseTimer() {
  if (closeTimer !== undefined) clearTimeout(closeTimer);
  closeTimer = undefined;
}

function clearLongPressTimer() {
  if (longPressTimer !== undefined) clearTimeout(longPressTimer);
  longPressTimer = undefined;
}

function requestOpen(next: boolean) {
  if (next && disabled) return;
  if (open === next) return;
  open = next;
  onOpenChange?.(next);
}

function closeIfInactive(delay = 0) {
  clearCloseTimer();
  if (pointerInside || focusInside) return;
  if (delay === 0) requestOpen(false);
  else {
    closeTimer = setTimeout(() => {
      closeTimer = undefined;
      if (!pointerInside && !focusInside) requestOpen(false);
    }, delay);
  }
}

function pointerEnter(event: PointerEvent) {
  if (disabled || event.pointerType === 'touch') return;
  pointerInside = true;
  clearCloseTimer();
  if (open) return;
  clearOpenTimer();
  const delay = delayDuration ?? group.openDelay();
  if (delay <= 0) requestOpen(true);
  else
    openTimer = setTimeout(() => {
      openTimer = undefined;
      requestOpen(true);
    }, delay);
}

function pointerLeave(event: PointerEvent) {
  pointerInside = false;
  clearOpenTimer();
  clearLongPressTimer();
  if (event.pointerType === 'touch' && openedByLongPress) {
    openedByLongPress = false;
    closeIfInactive();
    return;
  }
  closeIfInactive(100);
}

function pointerDown(event: PointerEvent) {
  if (disabled || event.pointerType !== 'touch') return;
  clearLongPressTimer();
  openedByLongPress = false;
  longPressTimer = setTimeout(() => {
    longPressTimer = undefined;
    openedByLongPress = true;
    requestOpen(true);
  }, 500);
}

function pointerUp(event: PointerEvent) {
  clearLongPressTimer();
  if (event.pointerType === 'touch' && openedByLongPress) {
    openedByLongPress = false;
    requestOpen(false);
  }
}

function focusIn() {
  if (disabled) return;
  focusInside = true;
  clearOpenTimer();
  clearCloseTimer();
  requestOpen(true);
}

function focusOut() {
  focusInside = false;
  closeIfInactive(100);
}

const context: TooltipContext = {
  id,
  get triggerId() {
    return claimedIds.trigger || `${id}-trigger`;
  },
  get contentId() {
    return claimedIds.content || `${id}-content`;
  },
  claimId(part, claimed) {
    claimedIds[part] = claimed || undefined;
  },
  isOpen: () => open,
  isDisabled: () => disabled,
  trigger: () => triggerElement,
  setTrigger: (element) => {
    triggerElement = element;
  },
  pointerEnter,
  pointerLeave,
  pointerDown,
  pointerUp,
  focusIn,
  focusOut,
  requestClose: () => requestOpen(false),
};

setContext(TOOLTIP_CONTEXT, context);
onDestroy(() => {
  clearOpenTimer();
  clearCloseTimer();
  clearLongPressTimer();
  if (!inheritedGroup) group.destroy();
});

$effect(() => {
  if (!inheritedGroup) group.configure({ delayDuration });
});

$effect(() => {
  if (disabled && open) requestOpen(false);
});

$effect(() => {
  if (open !== wasOpen) {
    if (open) group.opened();
    else group.closed();
    wasOpen = open;
  }
});
</script>

{@render children?.()}
