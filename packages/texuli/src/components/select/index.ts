/**
 * Styled Select on the token contract.
 * Built on `@texuli/primitives/select`.
 */
import SelectContent from './SelectContent.svelte';
import SelectGroup from './SelectGroup.svelte';
import SelectItem from './SelectItem.svelte';
import SelectLabel from './SelectLabel.svelte';
import SelectPortal from './SelectPortal.svelte';
import SelectRoot from './SelectRoot.svelte';
import SelectSeparator from './SelectSeparator.svelte';
import SelectTrigger from './SelectTrigger.svelte';
import SelectValue from './SelectValue.svelte';
import SelectViewport from './SelectViewport.svelte';

export const Select: {
  Root: typeof SelectRoot;
  Trigger: typeof SelectTrigger;
  Value: typeof SelectValue;
  Portal: typeof SelectPortal;
  Content: typeof SelectContent;
  Viewport: typeof SelectViewport;
  Item: typeof SelectItem;
  Group: typeof SelectGroup;
  Label: typeof SelectLabel;
  Separator: typeof SelectSeparator;
} = {
  Root: SelectRoot,
  Trigger: SelectTrigger,
  Value: SelectValue,
  Portal: SelectPortal,
  Content: SelectContent,
  Viewport: SelectViewport,
  Item: SelectItem,
  Group: SelectGroup,
  Label: SelectLabel,
  Separator: SelectSeparator,
};

export { default as SelectContent } from './SelectContent.svelte';
export { default as SelectGroup } from './SelectGroup.svelte';
export { default as SelectItem } from './SelectItem.svelte';
export { default as SelectLabel } from './SelectLabel.svelte';
export { default as SelectPortal } from './SelectPortal.svelte';
export { default as SelectRoot } from './SelectRoot.svelte';
export { default as SelectSeparator } from './SelectSeparator.svelte';
export { default as SelectTrigger } from './SelectTrigger.svelte';
export { default as SelectValue } from './SelectValue.svelte';
export { default as SelectViewport } from './SelectViewport.svelte';

export {
  SELECT_SIZES,
  SELECT_VARIANTS,
  type SelectSize,
  type SelectVariant,
  selectContentClass,
  selectDescriptionClass,
  selectGroupClass,
  selectIconClass,
  selectItemClass,
  selectLabelClass,
  selectSeparatorClass,
  selectTriggerClass,
  selectValueClass,
} from './variants.ts';
