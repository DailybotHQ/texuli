import Alpha from './Alpha.svelte';
import Area from './Area.svelte';
import FormatInput from './FormatInput.svelte';
import Hue from './Hue.svelte';
import Root from './Root.svelte';
import Swatch from './Swatch.svelte';

export type {
  ColorFormat,
  OklchColor,
} from './color.ts';

/** Composable, headless color picker parts. */
export const ColorPicker = {
  Root,
  Area,
  Hue,
  Alpha,
  FormatInput,
  Swatch,
};
