import { createPrimitiveContext } from '../internal/context.ts';
import type { ToggleGroupOrientation, ToggleGroupType } from './types.ts';

export interface ToggleGroupContext {
  readonly type: ToggleGroupType;
  readonly orientation: ToggleGroupOrientation;
  readonly loop: boolean;
  readonly rovingFocus: boolean;
  readonly disabled: boolean;
  isPressed(value: string): boolean;
  toggle(value: string): void;
  register(value: string, el: HTMLElement | null): void;
}

export const toggleGroupContext = createPrimitiveContext<ToggleGroupContext>('ToggleGroup.Root');
