export {
  type RadioGroupContext,
  type RadioGroupOrientation,
  radioGroupContext,
} from './context.ts';
export { default as Root } from './RadioGroup.svelte';
export { default as Item } from './RadioGroupItem.svelte';

import Root from './RadioGroup.svelte';
import Item from './RadioGroupItem.svelte';

/** The radio group parts, composed as `RadioGroup.Root` and `RadioGroup.Item` (APG radio group). */
export const RadioGroup = {
  Root,
  Item,
};
