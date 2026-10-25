import { createPrimitiveContext } from '../internal/context.ts';

export type SwitchContext = {
  /** Whether the switch is on. */
  readonly checked: boolean;
  readonly disabled: boolean;
  /** Root element id for label association. */
  readonly id: string | undefined;
};

export const switchContext = createPrimitiveContext<SwitchContext>('Switch.Root');
