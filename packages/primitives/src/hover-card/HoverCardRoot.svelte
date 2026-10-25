<script lang="ts">
import { onDestroy, type Snippet } from 'svelte';
import { type HoverCardContext, setHoverCardContext } from './context.ts';

type Props = {
  children?: Snippet;
  closeDelay?: number;
  id?: string;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  openDelay?: number;
};

let {
  children,
  closeDelay = 300,
  id,
  onOpenChange,
  open = $bindable(false),
  openDelay = 500,
}: Props = $props();

const generatedId = $props.id();
const baseId = $derived(`hover-card-${id ?? generatedId}`);
const contentId = $derived(`${baseId}-content`);
/** Consumer ids claimed by parts; they win over the generated ones. */
let claimedIds = $state<{ content?: string; trigger?: string }>({});
let trigger: HTMLElement | undefined;
let content: HTMLElement | undefined;
let openTimer: ReturnType<typeof setTimeout> | undefined;
let closeTimer: ReturnType<typeof setTimeout> | undefined;
let pointerWithin = false;
let focusWithin = false;

function clearTimers(): void {
  if (openTimer !== undefined) clearTimeout(openTimer);
  if (closeTimer !== undefined) clearTimeout(closeTimer);
  openTimer = undefined;
  closeTimer = undefined;
}

function setOpen(next: boolean): void {
  clearTimers();
  if (open === next) return;
  open = next;
  onOpenChange?.(next);
}

function scheduleOpen(delay = openDelay): void {
  if (open) return;
  if (closeTimer !== undefined) clearTimeout(closeTimer);
  closeTimer = undefined;
  if (openTimer !== undefined) clearTimeout(openTimer);
  openTimer = setTimeout(
    () => {
      openTimer = undefined;
      setOpen(true);
    },
    Math.max(0, delay)
  );
}

function scheduleClose(): void {
  if (openTimer !== undefined) clearTimeout(openTimer);
  openTimer = undefined;
  if (closeTimer !== undefined) clearTimeout(closeTimer);
  closeTimer = setTimeout(
    () => {
      closeTimer = undefined;
      if (!pointerWithin && !focusWithin) setOpen(false);
    },
    Math.max(0, closeDelay)
  );
}

function isInside(target: EventTarget | null): boolean {
  if (typeof target !== 'object' || target === null || !('nodeType' in target)) return false;
  const node = target as Node;
  return !!trigger?.contains(node) || !!content?.contains(node);
}

const context: HoverCardContext = {
  get contentId() {
    return claimedIds.content || contentId;
  },
  get triggerId() {
    return claimedIds.trigger || `${baseId}-trigger`;
  },
  claimId(part, id) {
    claimedIds[part] = id || undefined;
  },
  get trigger() {
    return trigger;
  },
  get open() {
    return open;
  },
  get openDelay() {
    return openDelay;
  },
  get closeDelay() {
    return closeDelay;
  },
  setOpen,
  setTrigger(node) {
    trigger = node;
  },
  setContent(node) {
    content = node;
  },
  triggerPointerEnter(event) {
    if (event.pointerType === 'touch') return;
    pointerWithin = true;
    scheduleOpen();
  },
  triggerPointerLeave(event) {
    if (event.pointerType === 'touch') return;
    pointerWithin = false;
    scheduleClose();
  },
  triggerPointerDown(event) {
    if (event.pointerType === 'touch') setOpen(!open);
  },
  triggerFocus() {
    focusWithin = true;
    scheduleOpen();
  },
  triggerBlur(event) {
    if (isInside(event.relatedTarget)) return;
    focusWithin = false;
    scheduleClose();
  },
  contentPointerEnter(event) {
    if (event.pointerType === 'touch') return;
    pointerWithin = true;
    clearTimers();
  },
  contentPointerLeave(event) {
    if (event.pointerType === 'touch') return;
    pointerWithin = false;
    scheduleClose();
  },
  contentFocusIn() {
    focusWithin = true;
    clearTimers();
  },
  contentFocusOut(event) {
    if (isInside(event.relatedTarget)) return;
    focusWithin = false;
    scheduleClose();
  },
};

setHoverCardContext(context);

onDestroy(clearTimers);
</script>

{@render children?.()}
