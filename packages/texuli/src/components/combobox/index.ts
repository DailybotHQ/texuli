/**
 * Styled Combobox and MultiSelect on `@texuli/primitives/combobox`.
 */
import ComboboxChip from './ComboboxChip.svelte';
import ComboboxChips from './ComboboxChips.svelte';
import ComboboxContent from './ComboboxContent.svelte';
import ComboboxEmpty from './ComboboxEmpty.svelte';
import ComboboxError from './ComboboxError.svelte';
import ComboboxField from './ComboboxField.svelte';
import ComboboxInput from './ComboboxInput.svelte';
import ComboboxItem from './ComboboxItem.svelte';
import ComboboxLoading from './ComboboxLoading.svelte';
import ComboboxPortal from './ComboboxPortal.svelte';
import ComboboxRoot from './ComboboxRoot.svelte';
import ComboboxTrigger from './ComboboxTrigger.svelte';
import ComboboxViewport from './ComboboxViewport.svelte';
import MultiSelectRoot from './MultiSelectRoot.svelte';

export const Combobox: {
  readonly Root: typeof ComboboxRoot;
  readonly Field: typeof ComboboxField;
  readonly Input: typeof ComboboxInput;
  readonly Trigger: typeof ComboboxTrigger;
  readonly Portal: typeof ComboboxPortal;
  readonly Content: typeof ComboboxContent;
  readonly Viewport: typeof ComboboxViewport;
  readonly Item: typeof ComboboxItem;
  readonly Chips: typeof ComboboxChips;
  readonly Chip: typeof ComboboxChip;
  readonly Empty: typeof ComboboxEmpty;
  readonly Error: typeof ComboboxError;
  readonly Loading: typeof ComboboxLoading;
} = {
  Root: ComboboxRoot,
  Field: ComboboxField,
  Input: ComboboxInput,
  Trigger: ComboboxTrigger,
  Portal: ComboboxPortal,
  Content: ComboboxContent,
  Viewport: ComboboxViewport,
  Item: ComboboxItem,
  Chips: ComboboxChips,
  Chip: ComboboxChip,
  Empty: ComboboxEmpty,
  Error: ComboboxError,
  Loading: ComboboxLoading,
} as const;

export const MultiSelect: {
  readonly Root: typeof MultiSelectRoot;
  readonly Field: typeof ComboboxField;
  readonly Input: typeof ComboboxInput;
  readonly Trigger: typeof ComboboxTrigger;
  readonly Portal: typeof ComboboxPortal;
  readonly Content: typeof ComboboxContent;
  readonly Viewport: typeof ComboboxViewport;
  readonly Item: typeof ComboboxItem;
  readonly Chips: typeof ComboboxChips;
  readonly Chip: typeof ComboboxChip;
  readonly Empty: typeof ComboboxEmpty;
  readonly Error: typeof ComboboxError;
  readonly Loading: typeof ComboboxLoading;
} = {
  Root: MultiSelectRoot,
  Field: ComboboxField,
  Input: ComboboxInput,
  Trigger: ComboboxTrigger,
  Portal: ComboboxPortal,
  Content: ComboboxContent,
  Viewport: ComboboxViewport,
  Item: ComboboxItem,
  Chips: ComboboxChips,
  Chip: ComboboxChip,
  Empty: ComboboxEmpty,
  Error: ComboboxError,
  Loading: ComboboxLoading,
} as const;

export {
  type ComboboxFilter,
  type ComboboxItemData,
  type ComboboxSelection,
  createFoldedFilter,
  defaultComboboxFilter,
  type FoldedFilterOptions,
  foldSearchText,
} from '@texuli/primitives/combobox';
export { default as ComboboxChip } from './ComboboxChip.svelte';
export { default as ComboboxChips } from './ComboboxChips.svelte';
export { default as ComboboxContent } from './ComboboxContent.svelte';
export { default as ComboboxEmpty } from './ComboboxEmpty.svelte';
export { default as ComboboxError } from './ComboboxError.svelte';
export { default as ComboboxField } from './ComboboxField.svelte';
export { default as ComboboxInput } from './ComboboxInput.svelte';
export { default as ComboboxItem } from './ComboboxItem.svelte';
export { default as ComboboxLoading } from './ComboboxLoading.svelte';
export { default as ComboboxPortal } from './ComboboxPortal.svelte';
export { default as ComboboxRoot } from './ComboboxRoot.svelte';
export { default as ComboboxTrigger } from './ComboboxTrigger.svelte';
export { default as ComboboxViewport } from './ComboboxViewport.svelte';
export { default as MultiSelectRoot } from './MultiSelectRoot.svelte';

export {
  COMBOBOX_SIZES,
  COMBOBOX_VARIANTS,
  type ComboboxSize,
  type ComboboxVariant,
  comboboxChipClass,
  comboboxChipsClass,
  comboboxContentClass,
  comboboxEmptyClass,
  comboboxErrorClass,
  comboboxFieldClass,
  comboboxInputClass,
  comboboxItemClass,
  comboboxLoadingClass,
  comboboxRootClass,
  comboboxTriggerClass,
} from './variants.ts';
