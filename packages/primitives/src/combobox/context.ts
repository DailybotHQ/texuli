import { getContext, setContext } from 'svelte';

export interface ComboboxItemData {
  value: string;
  label: string;
  disabled?: boolean;
}

export type ComboboxSelection = string | readonly string[];

/** Async / filter status for empty, loading and error chrome. */
export type ComboboxLoadStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

export interface ComboboxContext {
  readonly id: string;
  readonly inputId: string;
  /** A part records its consumer `id` (or clears it), so references use the effective id. */
  claimId(part: 'input' | 'list', id: string | null | undefined): void;
  readonly listId: string;
  readonly open: boolean;
  readonly disabled: boolean;
  readonly multiple: boolean;
  readonly loading: boolean;
  /** True after `loadOptions` rejected (cleared on the next successful load or retry). */
  readonly failed: boolean;
  /** Human-readable load failure message when `failed` is true. */
  readonly errorMessage: string | undefined;
  /** Derived status for empty / loading / error parts. */
  readonly status: ComboboxLoadStatus;
  readonly query: string;
  readonly value: ComboboxSelection;
  readonly items: readonly ComboboxItemData[];
  readonly activeValue: string | undefined;
  readonly selected: readonly string[];
  setOpen(next: boolean, event?: Event): void;
  setQuery(next: string): void;
  setActive(value: string | undefined): void;
  select(value: string): void;
  remove(value: string): void;
  /** Re-run `loadOptions` for the current query (no-op without `loadOptions`). */
  retry(): void;
  itemId(value: string): string;
  labelFor(value: string): string;
  registerInput(element: HTMLInputElement | undefined): void;
  registerOverlay(controller: import('@texuli/core/overlay').OverlayController | undefined): void;
}

const COMBOBOX_CONTEXT = Symbol('texuli.combobox');

export function setComboboxContext(context: ComboboxContext): void {
  setContext(COMBOBOX_CONTEXT, context);
}

export function getComboboxContext(): ComboboxContext {
  const context = getContext<ComboboxContext | undefined>(COMBOBOX_CONTEXT);
  if (!context) throw new Error('Combobox parts must be rendered inside Combobox.Root');
  return context;
}
