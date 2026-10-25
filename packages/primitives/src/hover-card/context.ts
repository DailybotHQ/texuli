import { createPrimitiveContext } from '../internal/context.ts';

export interface HoverCardContext {
  readonly contentId: string;
  readonly triggerId: string;
  /** A part records its consumer `id` (or clears it), so references use the effective id. */
  claimId(part: 'trigger' | 'content', id: string | null | undefined): void;
  readonly trigger: HTMLElement | undefined;
  readonly open: boolean;
  readonly openDelay: number;
  readonly closeDelay: number;
  setOpen(open: boolean): void;
  setTrigger(node: HTMLElement | undefined): void;
  setContent(node: HTMLElement | undefined): void;
  triggerPointerEnter(event: PointerEvent): void;
  triggerPointerLeave(event: PointerEvent): void;
  triggerPointerDown(event: PointerEvent): void;
  triggerFocus(): void;
  triggerBlur(event: FocusEvent): void;
  contentPointerEnter(event: PointerEvent): void;
  contentPointerLeave(event: PointerEvent): void;
  contentFocusIn(): void;
  contentFocusOut(event: FocusEvent): void;
}

const context = createPrimitiveContext<HoverCardContext>('HoverCard.Root');

export function getHoverCardContext(): HoverCardContext {
  return context.get();
}

export function setHoverCardContext(value: HoverCardContext): HoverCardContext {
  return context.set(value);
}
