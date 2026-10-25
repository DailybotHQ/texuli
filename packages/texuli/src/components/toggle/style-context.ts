import type { ToggleSize, ToggleVariant } from './variants.ts';

export const TOGGLE_GROUP_STYLE = Symbol('texuli.toggle-group-style');

export type ToggleGroupStyleContext = {
  readonly variant: ToggleVariant;
  readonly size: ToggleSize;
};
