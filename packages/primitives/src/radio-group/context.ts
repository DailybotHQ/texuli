import { createPrimitiveContext } from '../internal/context.ts';

export type RadioGroupOrientation = 'horizontal' | 'vertical';

export interface RadioGroupContext {
  readonly value: () => string;
  select(value: string): void;
  readonly disabled: () => boolean;
  readonly readonly: () => boolean;
  readonly orientation: () => RadioGroupOrientation;
  readonly loop: () => boolean;
  registerItem(item: { value: string; element: HTMLElement; disabled: boolean }): () => void;
  /** Name for the native form bridge (undefined = not in a form). */
  readonly name: () => string | undefined;
  readonly required: () => boolean;
}

export const radioGroupContext = createPrimitiveContext<RadioGroupContext>('RadioGroup.Root');
