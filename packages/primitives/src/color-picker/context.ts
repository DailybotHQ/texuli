import { getContext, setContext } from 'svelte';
import type { ColorFormat, OklchColor } from './color.ts';

const COLOR_PICKER_KEY = Symbol('texuli.color-picker');

export interface ColorPickerContext {
  readonly color: OklchColor;
  readonly value: string;
  readonly format: ColorFormat;
  readonly disabled: boolean;
  setColor: (next: OklchColor) => void;
}

export function setColorPickerContext(context: ColorPickerContext): void {
  setContext(COLOR_PICKER_KEY, context);
}

export function getColorPickerContext(): ColorPickerContext {
  const context = getContext<ColorPickerContext | undefined>(COLOR_PICKER_KEY);
  if (!context) throw new Error('ColorPicker parts must be rendered inside ColorPicker.Root.');
  return context;
}
