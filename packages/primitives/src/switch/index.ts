import Root from './Root.svelte';
import Thumb from './Thumb.svelte';

export { type SwitchContext, switchContext } from './context.ts';
export { Root, Thumb };

/** The switch parts, composed as `Switch.Root` and `Switch.Thumb` (APG switch). */
export const Switch = {
  Root,
  Thumb,
};
