import type { Snippet } from 'svelte';
import type { ComboboxItemData, ComboboxLoadStatus, ComboboxSelection } from './context.ts';
import type { ComboboxFilter } from './filter.ts';

export interface ComboboxRootProps {
  value?: ComboboxSelection;
  defaultValue?: ComboboxSelection;
  inputValue?: string;
  defaultInputValue?: string;
  items?: readonly ComboboxItemData[];
  loadOptions?: (query: string, signal: AbortSignal) => Promise<readonly ComboboxItemData[]>;
  multiple?: boolean;
  disabled?: boolean;
  filter?: ComboboxFilter;
  name?: string;
  required?: boolean;
  requiredMessage?: string;
  form?: string;
  open?: boolean;
  onValueChange?: (value: ComboboxSelection) => void;
  onInputValueChange?: (value: string) => void;
  onOpenChange?: (open: boolean) => void;
  children?: Snippet;
}

export type { ComboboxLoadStatus };
