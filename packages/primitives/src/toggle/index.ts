/**
 * Headless Toggle and ToggleGroup (WAI-ARIA APG toggle button / toolbar patterns).
 * Owned implementation on the texels.
 */
import ToggleRoot from './Toggle.svelte';
import ToggleGroupRoot from './ToggleGroup.svelte';
import ToggleGroupItem from './ToggleGroupItem.svelte';

export const Toggle = {
  Root: ToggleRoot,
};

export const ToggleGroup = {
  Root: ToggleGroupRoot,
  Item: ToggleGroupItem,
};

export { default as ToggleRoot } from './Toggle.svelte';
export { default as ToggleGroupRoot } from './ToggleGroup.svelte';
export { default as ToggleGroupItem } from './ToggleGroupItem.svelte';

export type {
  ToggleGroupItemAttrs,
  ToggleGroupItemProps,
  ToggleGroupOrientation,
  ToggleGroupRootProps,
  ToggleGroupType,
  ToggleRootAttrs,
  ToggleRootProps,
} from './types.ts';
