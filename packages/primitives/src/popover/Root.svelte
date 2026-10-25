<script lang="ts">
import type { OverlayController, OverlayDismissEvent } from '@texuli/core/overlay';
import type { AnyPlacement } from '@texuli/core/position-math';
import { type Snippet, setContext } from 'svelte';
import type { PopoverContext } from './context.ts';
import { POPOVER_CONTEXT } from './context.ts';
import type { PopoverAlign, PopoverSide } from './types.ts';

interface Props {
  open?: boolean;
  modal?: boolean;
  positioning?: boolean;
  side?: PopoverSide;
  align?: PopoverAlign;
  sideOffset?: number;
  onOpenChange?: (open: boolean) => void;
  children?: Snippet;
}

let {
  open = $bindable(false),
  modal = false,
  positioning = true,
  side = 'bottom',
  align = 'center',
  sideOffset = 6,
  onOpenChange,
  children,
}: Props = $props();

const uid = $props.id();
/** Consumer ids claimed by parts; they win over the generated ones. */
let claimedIds = $state<{ trigger?: string; content?: string }>({});
let controller: OverlayController | undefined;
let triggerElement: HTMLElement | undefined;
let contentElement: HTMLElement | undefined;
let controllerReady = $state(false);
let restoreFocusOnClose = true;
let openingEvent: Event | undefined;

// A modal popover's features load lazily; start loading them as soon as the
// root mounts, so the first open does not wait for the chunk.
$effect(() => {
  if (modal) void import('./modal-features.ts');
});

function syncOpen(next: boolean): void {
  if (open === next) return;
  open = next;
  onOpenChange?.(next);
}

function focusContent(): void {
  if (!contentElement) return;
  const tabbable = contentElement.querySelector<HTMLElement>(
    'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
  );
  (tabbable ?? contentElement).focus({ preventScroll: true });
}

const placement = $derived<AnyPlacement>(
  align === 'center' ? side : (`${side}-${align}` as AnyPlacement)
);

const context: PopoverContext = {
  get open() {
    return open;
  },
  get modal() {
    return modal;
  },
  get positioning() {
    return positioning;
  },
  get triggerId() {
    return claimedIds.trigger || `${uid}-trigger`;
  },
  get contentId() {
    return claimedIds.content || `${uid}-content`;
  },
  claimId(part, id) {
    claimedIds[part] = id || undefined;
  },
  get placement() {
    return placement;
  },
  get sideOffset() {
    return sideOffset;
  },
  get controller() {
    return controller;
  },
  get triggerElement() {
    return triggerElement;
  },
  get contentElement() {
    return contentElement;
  },
  setOpen(next, event) {
    if (next) {
      restoreFocusOnClose = true;
      openingEvent = event;
      if (event?.currentTarget instanceof HTMLElement) triggerElement = event.currentTarget;
      if (controller) controller.open(event);
      else syncOpen(true);
      return;
    }
    restoreFocusOnClose = true;
    if (controller?.isOpen()) controller.close();
    else syncOpen(false);
  },
  toggle(event) {
    this.setOpen(!open, event);
  },
  registerTrigger(element) {
    triggerElement = element;
    if (element && controller) controller.setAnchor(element);
  },
  registerContent(element) {
    contentElement = element;
  },
  registerController(next) {
    controller = next;
    if (next) controllerReady = true;
    if (!next) return;
    if (triggerElement) next.setAnchor(triggerElement);
    if (open) next.open(openingEvent);
  },
  onOverlayOpenChange(next) {
    syncOpen(next);
    if (next && !modal) focusContent();
    if (!next && !modal && restoreFocusOnClose) triggerElement?.focus({ preventScroll: true });
    if (!next) restoreFocusOnClose = true;
  },
  onDismissRequest(event: OverlayDismissEvent) {
    restoreFocusOnClose = event.reason === 'escape';
  },
  focusContent,
};

setContext(POPOVER_CONTEXT, context);

$effect(() => {
  if (!controllerReady || !controller) return;
  if (open && !controller.isOpen()) {
    controller.open(openingEvent);
  } else if (!open && controller.isOpen()) controller.close();
});
</script>

{@render children?.()}
