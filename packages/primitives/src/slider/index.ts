/**
 * Slider: owned, headless APG Slider and multi-thumb (range) Slider
 * (T-prim-slider), composed as `Slider.*`.
 */
import Range from './SliderRange.svelte';
import Root from './SliderRoot.svelte';
import Thumb from './SliderThumb.svelte';
import Tick from './SliderTick.svelte';

export const Slider = { Root, Range, Thumb, Tick };

export {
  clamp,
  closestThumb,
  percentOf,
  type SliderKeyAction,
  type SliderScale,
  sliderKeyAction,
  snapToStep,
  thumbBounds,
  valueFromPointer,
} from './math.ts';
export type {
  SliderMultipleRootProps,
  SliderOrientation,
  SliderRangeProps,
  SliderRootProps,
  SliderRootSnippetProps,
  SliderSingleRootProps,
  SliderThumbItem,
  SliderThumbProps,
  SliderTickItem,
  SliderTickProps,
} from './types.ts';
