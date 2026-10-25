import Content from './Content.svelte';
import Indicator from './Indicator.svelte';
import Item from './Item.svelte';
import Link from './Link.svelte';
import List from './List.svelte';
import Root from './Root.svelte';
import Trigger from './Trigger.svelte';
import Viewport from './Viewport.svelte';

/** Headless site navigation with flyout panels (APG disclosure navigation pattern). */
export const NavigationMenu: {
  readonly Root: typeof Root;
  readonly List: typeof List;
  readonly Item: typeof Item;
  readonly Trigger: typeof Trigger;
  readonly Content: typeof Content;
  readonly Link: typeof Link;
  readonly Viewport: typeof Viewport;
  readonly Indicator: typeof Indicator;
} = Object.freeze({
  Root,
  List,
  Item,
  Trigger,
  Content,
  Link,
  Viewport,
  Indicator,
});

export {
  createNavigationMenuController,
  motionBetween,
  type NavigationMenuController,
  type NavigationMenuControllerOptions,
} from './controller.ts';
