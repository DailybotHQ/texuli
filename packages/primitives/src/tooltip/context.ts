import type { TooltipDelayGroup } from './delay-group.ts';

export interface TooltipContext {
  readonly id: string;
  readonly triggerId: string;
  readonly contentId: string;
  /** A part records its consumer `id` (or clears it), so references use the effective id. */
  claimId(part: 'trigger' | 'content', id: string | null | undefined): void;
  isOpen(): boolean;
  isDisabled(): boolean;
  trigger(): HTMLElement | null;
  setTrigger(element: HTMLElement | null): void;
  pointerEnter(event: PointerEvent): void;
  pointerLeave(event: PointerEvent): void;
  pointerDown(event: PointerEvent): void;
  pointerUp(event: PointerEvent): void;
  focusIn(): void;
  focusOut(): void;
  requestClose(): void;
}

export const TOOLTIP_GROUP_CONTEXT = Symbol('texuli-tooltip-group');
export const TOOLTIP_CONTEXT = Symbol('texuli-tooltip');

export type { TooltipDelayGroup };
