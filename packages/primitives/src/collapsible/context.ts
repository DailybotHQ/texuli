import { createPrimitiveContext } from '../internal/context.ts';

export interface CollapsibleContextValue {
  readonly open: boolean;
  readonly disabled: boolean;
  readonly triggerId: string;
  readonly contentId: string;
  /** A trigger or content records its consumer `id` (or clears it), so references use the effective id. */
  claimId(part: 'trigger' | 'content', id: string | null | undefined): void;
  toggle(): void;
}

export const collapsibleContext = createPrimitiveContext<CollapsibleContextValue>('Collapsible');
