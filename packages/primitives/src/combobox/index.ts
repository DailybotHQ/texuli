import Chip from './Chip.svelte';
import ChipRemove from './ChipRemove.svelte';
import Chips from './Chips.svelte';
import Content from './Content.svelte';
import Empty from './Empty.svelte';
import ErrorPart from './Error.svelte';
import Input from './Input.svelte';
import Item from './Item.svelte';
import Loading from './Loading.svelte';
import Portal from './Portal.svelte';
import Root from './Root.svelte';
import Trigger from './Trigger.svelte';
import Viewport from './Viewport.svelte';

export type {
  ComboboxItemData,
  ComboboxLoadStatus,
  ComboboxSelection,
} from './context.ts';
export { getComboboxContext } from './context.ts';
export {
  type ComboboxFilter,
  createFoldedFilter,
  defaultComboboxFilter,
  type FoldedFilterOptions,
  foldSearchText,
} from './filter.ts';
export type { ComboboxRootProps } from './props.ts';
export {
  Chip,
  ChipRemove,
  Chips,
  Content,
  Empty,
  ErrorPart as Error,
  Input,
  Item,
  Loading,
  Portal,
  Root,
  Trigger,
  Viewport,
};

export const Combobox = {
  Root,
  Input,
  Trigger,
  Portal,
  Content,
  Viewport,
  Item,
  Chips,
  Chip,
  ChipRemove,
  Empty,
  Error: ErrorPart,
  Loading,
} as const;
