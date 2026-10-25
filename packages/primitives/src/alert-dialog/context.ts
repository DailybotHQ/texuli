import type { FocusRestoreEvent, FocusTarget } from '@texuli/core/focus-scope';
import type { OverlayController, OverlayDismissEvent, OverlayMode } from '@texuli/core/overlay';
import { getContext } from 'svelte';

export const ALERT_DIALOG_CONTEXT = Symbol('texuli.alert-dialog');
export const ALERT_DIALOG_PORTAL_CONTEXT = Symbol('texuli.alert-dialog-portal');

export type AlertDialogContext = {
  readonly open: boolean;
  readonly mode: OverlayMode;
  readonly container: Element | null;
  readonly triggerId: string;
  /** A part records its consumer `id` (or clears it), so references use the effective id. */
  claimId(
    part: 'trigger' | 'content' | 'title' | 'description',
    id: string | null | undefined
  ): void;
  readonly contentId: string;
  readonly titleId: string;
  readonly descriptionId: string;
  /** Whether a Description is mounted (Content names it in `aria-describedby` only then). */
  readonly hasDescription: boolean;
  setHasDescription(present: boolean): void;
  readonly initialFocus?: FocusTarget | (() => FocusTarget | null);
  readonly controller: OverlayController | undefined;
  readonly triggerElement: HTMLElement | undefined;
  readonly contentElement: HTMLElement | undefined;
  readonly cancelElement: HTMLElement | undefined;
  setOpen(next: boolean, event?: Event): void;
  toggle(event: Event): void;
  registerTrigger(element: HTMLElement | undefined): void;
  registerContent(element: HTMLElement | undefined): void;
  registerCancel(element: HTMLElement | undefined): void;
  registerController(controller: OverlayController | undefined): void;
  subscribeOpen(listener: (open: boolean) => void): () => void;
  onOverlayOpenChange(next: boolean): void;
  onDismissRequest?(event: OverlayDismissEvent): void;
  onBeforeRestoreFocus(event: FocusRestoreEvent): void;
};

export type AlertDialogPortalContext = {
  readonly target: Element | null | undefined;
  /**
   * True once the portal wrapper is where it belongs. Content opens (and takes
   * focus) only then: moving a focused node blurs it.
   */
  readonly placed: boolean;
};

export function getAlertDialogContext(): AlertDialogContext {
  const context = getContext<AlertDialogContext | undefined>(ALERT_DIALOG_CONTEXT);
  if (!context) throw new Error('AlertDialog parts must be rendered inside AlertDialog.Root');
  return context;
}

export function getAlertDialogPortalContext(): AlertDialogPortalContext | undefined {
  return getContext<AlertDialogPortalContext | undefined>(ALERT_DIALOG_PORTAL_CONTEXT);
}
