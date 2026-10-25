import { createPrimitiveContext } from '../internal/context.ts';
import type { AccordionOrientation } from './types.ts';

export interface AccordionRootContext {
  readonly orientation: AccordionOrientation;
  readonly disabled: boolean;
  isOpen(value: string): boolean;
  /** Whether the item may be closed by its own trigger (single, not collapsible). */
  canClose(value: string): boolean;
  toggle(value: string): void;
}

export interface AccordionItemContext {
  readonly value: string;
  readonly open: boolean;
  readonly disabled: boolean;
  readonly orientation: AccordionOrientation;
  readonly triggerId: string;
  readonly contentId: string;
  /** A trigger or content records its consumer `id` (or clears it), so references use the effective id. */
  claimId(part: 'trigger' | 'content', id: string | null | undefined): void;
  /** False when the open item of a non-collapsible single accordion cannot close. */
  readonly canClose: boolean;
  toggle(): void;
}

export const rootContext = createPrimitiveContext<AccordionRootContext>('Accordion.Root');
export const itemContext = createPrimitiveContext<AccordionItemContext>('Accordion.Item');

/** `data-*` attributes every part shares. */
export function partAttributes(item: AccordionItemContext): Record<string, string | undefined> {
  return {
    'data-state': item.open ? 'open' : 'closed',
    'data-orientation': item.orientation,
    'data-disabled': item.disabled ? '' : undefined,
  };
}
