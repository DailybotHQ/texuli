import type { DragMessages } from '@texuli/drag/messages';
import type { SortableContainer, SortableState } from '@texuli/drag/sortable';
import type { Attachment } from 'svelte/attachments';
import { createPrimitiveContext } from '../internal/context.ts';

/** Where the drop will land relative to an item (for drop indicators). */
export type DropIndicator = 'before' | 'after';

export interface SortableContextValue {
  /** The engine state (reactive). */
  readonly state: () => SortableState;
  readonly messages: () => DragMessages;
  readonly instructionsId: string;
  /** Item order to render: the live preview while an in-place drag runs. */
  readonly order: (containerId: string) => readonly string[];
  readonly container: (containerId: string) => SortableContainer | undefined;
  readonly isDragging: (itemId: string) => boolean;
  readonly isSelected: (itemId: string) => boolean;
  readonly isLocked: (itemId: string) => boolean;
  readonly indicator: (itemId: string) => DropIndicator | null;
  readonly translate: (itemId: string) => string | undefined;
  readonly registerList: (
    id: string,
    element: HTMLElement,
    label: string | undefined
  ) => () => void;
  readonly registerItem: (
    id: string,
    element: HTMLElement,
    label: string | undefined
  ) => () => void;
  readonly registerHandle: (id: string, element: HTMLElement) => () => void;
  readonly keydown: (itemId: string, event: KeyboardEvent, handle: HTMLElement) => void;
  /** Pointer drag (capture, threshold, long-press, auto-scroll) for one handle. */
  readonly pointer: (itemId: string) => Attachment<HTMLElement>;
}

export const sortableContext = createPrimitiveContext<SortableContextValue>('Sortable');

export interface SortableItemContextValue {
  readonly id: () => string;
  readonly label: () => string | undefined;
}

export const sortableItemContext = createPrimitiveContext<SortableItemContextValue>('SortableItem');
