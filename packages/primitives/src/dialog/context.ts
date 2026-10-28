import type { FocusRestoreEvent, FocusTarget } from '@texuli/core/focus-scope';
import type { LayerStack } from '@texuli/core/layer-stack';
import type { OverlayController, OverlayDismissEvent, OverlayMode } from '@texuli/core/overlay';
import { getContext } from 'svelte';

export const DIALOG_CONTEXT = Symbol('texuli.dialog');
export const DIALOG_PORTAL_CONTEXT = Symbol('texuli.dialog-portal');

export type DialogContext = {
  readonly open: boolean;
  readonly mode: OverlayMode;
  readonly container: Element | null;
  /** The layer stack the content registers on (default: the page-wide one). */
  readonly stack: LayerStack | undefined;
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
  setOpen(next: boolean, event?: Event): void;
  toggle(event: Event): void;
  registerTrigger(element: HTMLElement | undefined): void;
  registerContent(element: HTMLElement | undefined): void;
  registerController(controller: OverlayController | undefined): void;
  subscribeOpen(listener: (open: boolean) => void): () => void;
  onOverlayOpenChange(next: boolean): void;
  onDismissRequest?(event: OverlayDismissEvent): void;
  onBeforeRestoreFocus(event: FocusRestoreEvent): void;
};

export type DialogPortalContext = {
  readonly target: Element | null | undefined;
  /**
   * True once the portal wrapper is where it belongs. Content opens (and takes
   * focus) only then: moving a focused node blurs it.
   */
  readonly placed: boolean;
};

export function getDialogContext(): DialogContext {
  const context = getContext<DialogContext | undefined>(DIALOG_CONTEXT);
  if (!context) throw new Error('Dialog parts must be rendered inside Dialog.Root');
  return context;
}

export function getDialogPortalContext(): DialogPortalContext | undefined {
  return getContext<DialogPortalContext | undefined>(DIALOG_PORTAL_CONTEXT);
}
