<script lang="ts">
import type { FocusRestoreEvent, FocusTarget } from '@texuli/core/focus-scope';
import type { OverlayController, OverlayDismissEvent, OverlayMode } from '@texuli/core/overlay';
import { type Snippet, setContext } from 'svelte';
import type { AlertDialogContext } from './context.ts';
import { ALERT_DIALOG_CONTEXT } from './context.ts';

interface Props {
  open?: boolean;
  mode?: OverlayMode;
  container?: Element | null;
  /**
   * Where focus lands when the alert opens. Defaults to the Cancel control
   * (the safe choice). Pass an element or a getter to override.
   */
  initialFocus?: FocusTarget | (() => FocusTarget | null);
  onOpenChange?: (open: boolean) => void;
  onDismissRequest?: (event: OverlayDismissEvent) => void;
  onCloseAutoFocus?: (event: FocusRestoreEvent) => void;
  children?: Snippet;
}

let {
  open = $bindable(false),
  mode = 'top-layer',
  container = null,
  initialFocus,
  onOpenChange,
  onDismissRequest,
  onCloseAutoFocus,
  children,
}: Props = $props();

const uid = $props.id();
/** Consumer ids claimed by parts; they win over the generated ones. */
let claimedIds = $state<{
  trigger?: string;
  content?: string;
  title?: string;
  description?: string;
}>({});
let openSignal = $state({ value: open });
let hasDescription = $state(false);
let controller: OverlayController | undefined;
let triggerElement: HTMLElement | undefined;
let contentElement: HTMLElement | undefined;
let cancelElement: HTMLElement | undefined;
let controllerReady = $state(false);
let openingEvent: Event | undefined;
const openListeners = new Set<(open: boolean) => void>();

function updateOpenState(next: boolean): void {
  if (openSignal.value === next) return;
  openSignal.value = next;
  for (const listener of openListeners) listener(next);
}

function syncOpen(next: boolean): void {
  if (openSignal.value === next) return;
  updateOpenState(next);
  open = next;
  onOpenChange?.(next);
}

$effect(() => {
  updateOpenState(open);
});

function resolveInitialFocus(): FocusTarget | null {
  if (initialFocus !== undefined) {
    return typeof initialFocus === 'function' ? (initialFocus() ?? null) : initialFocus;
  }
  return cancelElement ?? null;
}

const context: AlertDialogContext = {
  get open() {
    return openSignal.value;
  },
  get mode() {
    return mode;
  },
  get container() {
    return container;
  },
  get triggerId() {
    return claimedIds.trigger || `${uid}-trigger`;
  },
  get contentId() {
    return claimedIds.content || `${uid}-content`;
  },
  get titleId() {
    return claimedIds.title || `${uid}-title`;
  },
  get descriptionId() {
    return claimedIds.description || `${uid}-description`;
  },
  claimId(part, id) {
    claimedIds[part] = id || undefined;
  },
  get hasDescription() {
    return hasDescription;
  },
  setHasDescription(present) {
    hasDescription = present;
  },
  get initialFocus() {
    return resolveInitialFocus;
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
  get cancelElement() {
    return cancelElement;
  },
  setOpen(next, event) {
    if (next) {
      openingEvent = event;
      if (event?.currentTarget instanceof HTMLElement) triggerElement = event.currentTarget;
      if (controller) controller.open(event);
      else syncOpen(true);
      return;
    }
    if (controller?.isOpen()) controller.close();
    else syncOpen(false);
  },
  toggle(event) {
    this.setOpen(!openSignal.value, event);
  },
  registerTrigger(element) {
    triggerElement = element;
  },
  registerContent(element) {
    contentElement = element;
  },
  registerCancel(element) {
    cancelElement = element;
  },
  registerController(next) {
    controller = next;
    if (next) controllerReady = true;
    if (next && openSignal.value) next.open(openingEvent);
  },
  subscribeOpen(listener) {
    openListeners.add(listener);
    listener(openSignal.value);
    return () => openListeners.delete(listener);
  },
  onOverlayOpenChange(next) {
    syncOpen(next);
  },
  onDismissRequest(event: OverlayDismissEvent) {
    // Alert dialogs never dismiss on outside pointer / focus-outside.
    if (event.reason === 'pointer-outside' || event.reason === 'focus-outside') {
      event.preventDefault();
    }
    onDismissRequest?.(event);
  },
  onBeforeRestoreFocus(event: FocusRestoreEvent) {
    onCloseAutoFocus?.(event);
  },
};

setContext(ALERT_DIALOG_CONTEXT, context);

$effect(() => {
  if (!controllerReady || !controller) return;
  if (openSignal.value && !controller.isOpen()) controller.open(openingEvent);
  else if (!openSignal.value && controller.isOpen()) controller.close();
});
</script>

{@render children?.()}
