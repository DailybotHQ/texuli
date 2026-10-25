import { getContext } from 'svelte';

export const SELECT_CONTEXT = Symbol('texuli.select');

export type SelectItemRecord = {
  value: string;
  label: string;
  disabled: boolean;
  element?: HTMLElement;
};

export type SelectContext = {
  readonly open: boolean;
  readonly value: string;
  readonly name: string | undefined;
  readonly disabled: boolean;
  readonly required: boolean;
  readonly triggerId: string;
  readonly contentId: string;
  readonly labelId: string | undefined;
  readonly highlighted: string | null;
  readonly sideOffset: number;
  readonly positioning: boolean;
  readonly items: readonly SelectItemRecord[];
  setOpen(next: boolean, event?: Event): void;
  toggle(event?: Event): void;
  selectValue(value: string): void;
  setHighlighted(value: string | null): void;
  /** A part records its consumer `id` (or clears it), so references use the effective id. */
  claimId(part: 'trigger' | 'content', id: string | null | undefined): void;
  registerTrigger(element: HTMLElement | undefined): void;
  registerContent(element: HTMLElement | undefined): void;
  registerItem(item: SelectItemRecord): () => void;
  getItemLabel(value: string): string | undefined;
  onOverlayOpenChange(next: boolean): void;
  focusTrigger(): void;
  handleTypeahead(event: KeyboardEvent): void;
  handleListKeydown(event: KeyboardEvent): void;
};

export function getSelectContext(): SelectContext {
  const context = getContext<SelectContext | undefined>(SELECT_CONTEXT);
  if (!context) throw new Error('Select parts must be rendered inside Select.Root');
  return context;
}
