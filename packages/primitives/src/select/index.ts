import Content from './Content.svelte';
import Group from './Group.svelte';
import GroupLabel from './GroupLabel.svelte';
import Item from './Item.svelte';
import Portal from './Portal.svelte';
import Root from './Root.svelte';
import Trigger from './Trigger.svelte';
import Value from './Value.svelte';
import Viewport from './Viewport.svelte';

export type { SelectContext, SelectItemRecord } from './context.ts';
export { getSelectContext, SELECT_CONTEXT } from './context.ts';
export type { SelectGroupContext } from './group-context.ts';
export { getSelectGroupContext, SELECT_GROUP_CONTEXT } from './group-context.ts';

/**
 * Namespace matching the public Bits-style Select composition surface.
 * `GroupHeading` is an alias of `GroupLabel` (Bits uses GroupHeading).
 */
export const Select: {
  Root: typeof Root;
  Trigger: typeof Trigger;
  Content: typeof Content;
  Portal: typeof Portal;
  Viewport: typeof Viewport;
  Item: typeof Item;
  Value: typeof Value;
  Group: typeof Group;
  GroupLabel: typeof GroupLabel;
  GroupHeading: typeof GroupLabel;
} = {
  Root,
  Trigger,
  Content,
  Portal,
  Viewport,
  Item,
  Value,
  Group,
  GroupLabel,
  GroupHeading: GroupLabel,
};

export {
  Content,
  Group,
  GroupLabel,
  GroupLabel as GroupHeading,
  Item,
  Portal,
  Root,
  Trigger,
  Value,
  Viewport,
};
