import SortableHandle from './SortableHandle.svelte';
import SortableItem from './SortableItem.svelte';
import SortableList from './SortableList.svelte';
import SortableRoot from './SortableRoot.svelte';

export type { DragMessages, DragMessagesOverrides } from '@texuli/drag/messages';
export type { Modifier } from '@texuli/drag/modifiers';
export type {
  SortableContainer,
  SortableEvent,
  SortableGroup,
  SortableMode,
  SortableMove,
} from '@texuli/drag/sortable';
export type { DropIndicator } from './context.ts';
export { type SortableKeyOptions, sortableIntent } from './keys.ts';
export { SortableHandle, SortableItem, SortableList, SortableRoot };

/** Root (state, rules, announcements), List (a container), Item, Handle (the drag button). */
export const Sortable = {
  Root: SortableRoot,
  List: SortableList,
  Item: SortableItem,
  Handle: SortableHandle,
};
