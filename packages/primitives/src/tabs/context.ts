import { createPrimitiveContext } from '../internal/context.ts';

export type TabsOrientation = 'horizontal' | 'vertical';
export type TabsActivationMode = 'automatic' | 'manual';

export interface TabsContext {
  readonly value: () => string;
  select(value: string): void;
  readonly orientation: () => TabsOrientation;
  readonly activationMode: () => TabsActivationMode;
  readonly disabled: () => boolean;
  readonly loop: () => boolean;
  /** Base id for aria-controls / aria-labelledby pairing. */
  readonly baseId: () => string;
  triggerId(value: string): string;
  contentId(value: string): string;
  /** A trigger or panel records its consumer `id` (or clears it), so references use the effective id. */
  claimId(part: 'trigger' | 'content', value: string, id: string | null | undefined): void;
  registerTrigger(entry: { value: string; element: HTMLElement; disabled: boolean }): () => void;
}

export const tabsContext = createPrimitiveContext<TabsContext>('Tabs.Root');
