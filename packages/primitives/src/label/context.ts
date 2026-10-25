import { createPrimitiveContext } from '../internal/context.ts';
import type { FieldState } from './attributes.ts';

export interface FieldContextValue extends FieldState {
  /** Mounted description and error parts register so references never dangle. */
  registerDescription(): () => void;
  registerError(): () => void;
  /** A part records its consumer `id` (or clears it), so references use the effective id. */
  claimId(part: 'control' | 'label' | 'description' | 'error', id: string | null | undefined): void;
}

export const fieldContext = createPrimitiveContext<FieldContextValue>('Field');
