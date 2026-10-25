import type { OverlayController, OverlayDismissEvent } from '@texuli/core/overlay';
import type { AnyPlacement } from '@texuli/core/position-math';
import { getContext } from 'svelte';

export const POPOVER_CONTEXT = Symbol('texuli.popover');

export type PopoverContext = {
  readonly open: boolean;
  readonly modal: boolean;
  readonly positioning: boolean;
  readonly triggerId: string;
  /** A part records its consumer `id` (or clears it), so references use the effective id. */
  claimId(part: 'trigger' | 'content', id: string | null | undefined): void;
  readonly contentId: string;
  readonly placement: AnyPlacement;
  readonly sideOffset: number;
  readonly controller: OverlayController | undefined;
  readonly triggerElement: HTMLElement | undefined;
  readonly contentElement: HTMLElement | undefined;
  setOpen(next: boolean, event?: Event): void;
  toggle(event: Event): void;
  registerTrigger(element: HTMLElement | undefined): void;
  registerContent(element: HTMLElement | undefined): void;
  registerController(controller: OverlayController | undefined): void;
  onOverlayOpenChange(next: boolean): void;
  onDismissRequest(event: OverlayDismissEvent): void;
  focusContent(): void;
};

export function getPopoverContext(): PopoverContext {
  const context = getContext<PopoverContext | undefined>(POPOVER_CONTEXT);
  if (!context) throw new Error('Popover parts must be rendered inside Popover.Root');
  return context;
}
