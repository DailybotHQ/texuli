export {
  type TabsActivationMode,
  type TabsContext,
  type TabsOrientation,
  tabsContext,
} from './context.ts';
export { default as Content } from './TabsContent.svelte';
export { default as List } from './TabsList.svelte';
export { default as Root } from './TabsRoot.svelte';
export { default as Trigger } from './TabsTrigger.svelte';

import Content from './TabsContent.svelte';
import List from './TabsList.svelte';
import Root from './TabsRoot.svelte';
import Trigger from './TabsTrigger.svelte';

/** The tabs parts, composed as `Tabs.Root`, `List`, `Trigger` and `Content` (APG tabs). */
export const Tabs = {
  Root,
  List,
  Trigger,
  Content,
};
