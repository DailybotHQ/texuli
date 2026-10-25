import { createPrimitiveContext } from '../internal/context.ts';

export interface ListboxItemData {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface ListboxContextValue {
  readonly id: () => string;
  readonly multiple: () => boolean;
  readonly disabled: () => boolean;
  readonly selectedValues: () => readonly string[];
  readonly activeValue: () => string | undefined;
  readonly options: () => readonly ListboxItemData[];
  readonly isSelected: (value: string) => boolean;
  readonly optionId: (value: string) => string;
  /** An option records its consumer `id` (or clears it), so aria-activedescendant follows it. */
  readonly claimOptionId: (value: string, id: string | null | undefined) => void;
  readonly setActive: (value: string) => void;
  readonly select: (value: string) => void;
}

export const listboxContext = createPrimitiveContext<ListboxContextValue>('Listbox');
