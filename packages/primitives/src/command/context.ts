import { createPrimitiveContext } from '../internal/context.ts';

export interface CommandItemRecord {
  value: string;
  label: string;
  keywords: readonly string[];
  disabled: boolean;
  group?: string;
  groupDisabled: boolean;
  onSelect?: () => void;
  token: object;
}

export interface CommandContextValue {
  readonly id: string;
  readonly label: string;
  readonly query: string;
  readonly loading: boolean;
  readonly error: string | undefined;
  readonly items: readonly CommandItemRecord[];
  readonly activeValue: string | undefined;
  readonly visibleItems: readonly CommandItemRecord[];
  readonly shouldFilter: boolean;
  readonly listId: string;
  itemId(value: string): string;
  /** The list or an item records its consumer `id` (or clears it), so aria-controls and aria-activedescendant follow it. */
  claimId(part: 'list' | `item:${string}`, id: string | null | undefined): void;
  register(token: object, item: Omit<CommandItemRecord, 'token'>): () => void;
  updateQuery(value: string): void;
  isVisible(token: object): boolean;
  isGroupVisible(group: string): boolean;
  isActive(value: string): boolean;
  setActive(value: string): void;
  moveActive(step: 1 | -1 | 'first' | 'last'): void;
  select(value: string): void;
  handleInputKeydown(event: KeyboardEvent): void;
}

export interface CommandGroupContextValue {
  readonly value: string;
  readonly disabled: boolean;
  readonly headingId: string;
}

export const commandContext = createPrimitiveContext<CommandContextValue>('Command');
export const commandGroupContext =
  createPrimitiveContext<CommandGroupContextValue>('Command.Group');

export function getOptionalCommandGroupContext(): CommandGroupContextValue | undefined {
  try {
    return commandGroupContext.get();
  } catch {
    return undefined;
  }
}
