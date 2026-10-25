/**
 * Styled DropdownMenu, ContextMenu and Menubar on the token contract.
 * Built on `@texuli/primitives/menu`, `context-menu` and `menubar`.
 */
import ContextMenuContent from './ContextMenuContent.svelte';
import ContextMenuRoot from './ContextMenuRoot.svelte';
import ContextMenuTrigger from './ContextMenuTrigger.svelte';
import DropdownMenuPortal from './DropdownMenuPortal.svelte';
import DropdownMenuRoot from './DropdownMenuRoot.svelte';
import DropdownMenuTrigger from './DropdownMenuTrigger.svelte';
import MenubarContent from './MenubarContent.svelte';
import MenubarMenu from './MenubarMenu.svelte';
import MenubarRoot from './MenubarRoot.svelte';
import MenubarTrigger from './MenubarTrigger.svelte';
import MenuCheckboxItem from './MenuCheckboxItem.svelte';
import MenuContent from './MenuContent.svelte';
import MenuGroup from './MenuGroup.svelte';
import MenuItem from './MenuItem.svelte';
import MenuLabel from './MenuLabel.svelte';
import MenuRadioGroup from './MenuRadioGroup.svelte';
import MenuRadioItem from './MenuRadioItem.svelte';
import MenuSeparator from './MenuSeparator.svelte';
import MenuSub from './MenuSub.svelte';
import MenuSubContent from './MenuSubContent.svelte';
import MenuSubTrigger from './MenuSubTrigger.svelte';

export const DropdownMenu: {
  readonly Root: typeof DropdownMenuRoot;
  readonly Trigger: typeof DropdownMenuTrigger;
  readonly Portal: typeof DropdownMenuPortal;
  readonly Content: typeof MenuContent;
  readonly Item: typeof MenuItem;
  readonly CheckboxItem: typeof MenuCheckboxItem;
  readonly RadioGroup: typeof MenuRadioGroup;
  readonly RadioItem: typeof MenuRadioItem;
  readonly Group: typeof MenuGroup;
  readonly Label: typeof MenuLabel;
  readonly Separator: typeof MenuSeparator;
  readonly Sub: typeof MenuSub;
  readonly SubTrigger: typeof MenuSubTrigger;
  readonly SubContent: typeof MenuSubContent;
} = {
  Root: DropdownMenuRoot,
  Trigger: DropdownMenuTrigger,
  Portal: DropdownMenuPortal,
  Content: MenuContent,
  Item: MenuItem,
  CheckboxItem: MenuCheckboxItem,
  RadioGroup: MenuRadioGroup,
  RadioItem: MenuRadioItem,
  Group: MenuGroup,
  Label: MenuLabel,
  Separator: MenuSeparator,
  Sub: MenuSub,
  SubTrigger: MenuSubTrigger,
  SubContent: MenuSubContent,
} as const;

export const ContextMenu: {
  readonly Root: typeof ContextMenuRoot;
  readonly Trigger: typeof ContextMenuTrigger;
  readonly Content: typeof ContextMenuContent;
  readonly Item: typeof MenuItem;
  readonly CheckboxItem: typeof MenuCheckboxItem;
  readonly RadioGroup: typeof MenuRadioGroup;
  readonly RadioItem: typeof MenuRadioItem;
  readonly Group: typeof MenuGroup;
  readonly Label: typeof MenuLabel;
  readonly Separator: typeof MenuSeparator;
  readonly Sub: typeof MenuSub;
  readonly SubTrigger: typeof MenuSubTrigger;
  readonly SubContent: typeof MenuSubContent;
  readonly Portal: typeof DropdownMenuPortal;
} = {
  Root: ContextMenuRoot,
  Trigger: ContextMenuTrigger,
  Content: ContextMenuContent,
  Item: MenuItem,
  CheckboxItem: MenuCheckboxItem,
  RadioGroup: MenuRadioGroup,
  RadioItem: MenuRadioItem,
  Group: MenuGroup,
  Label: MenuLabel,
  Separator: MenuSeparator,
  Sub: MenuSub,
  SubTrigger: MenuSubTrigger,
  SubContent: MenuSubContent,
  Portal: DropdownMenuPortal,
} as const;

export const Menubar: {
  readonly Root: typeof MenubarRoot;
  readonly Menu: typeof MenubarMenu;
  readonly Trigger: typeof MenubarTrigger;
  readonly Content: typeof MenubarContent;
  readonly Item: typeof MenuItem;
  readonly CheckboxItem: typeof MenuCheckboxItem;
  readonly RadioGroup: typeof MenuRadioGroup;
  readonly RadioItem: typeof MenuRadioItem;
  readonly Group: typeof MenuGroup;
  readonly Label: typeof MenuLabel;
  readonly Separator: typeof MenuSeparator;
  readonly Sub: typeof MenuSub;
  readonly SubTrigger: typeof MenuSubTrigger;
  readonly SubContent: typeof MenuSubContent;
  readonly Portal: typeof DropdownMenuPortal;
} = {
  Root: MenubarRoot,
  Menu: MenubarMenu,
  Trigger: MenubarTrigger,
  Content: MenubarContent,
  Item: MenuItem,
  CheckboxItem: MenuCheckboxItem,
  RadioGroup: MenuRadioGroup,
  RadioItem: MenuRadioItem,
  Group: MenuGroup,
  Label: MenuLabel,
  Separator: MenuSeparator,
  Sub: MenuSub,
  SubTrigger: MenuSubTrigger,
  SubContent: MenuSubContent,
  Portal: DropdownMenuPortal,
} as const;

export { default as ContextMenuContent } from './ContextMenuContent.svelte';
export { default as ContextMenuRoot } from './ContextMenuRoot.svelte';
export { default as ContextMenuTrigger } from './ContextMenuTrigger.svelte';
export { default as DropdownMenuPortal } from './DropdownMenuPortal.svelte';
export { default as DropdownMenuRoot } from './DropdownMenuRoot.svelte';
export { default as DropdownMenuTrigger } from './DropdownMenuTrigger.svelte';
export { default as MenubarContent } from './MenubarContent.svelte';
export { default as MenubarMenu } from './MenubarMenu.svelte';
export { default as MenubarRoot } from './MenubarRoot.svelte';
export { default as MenubarTrigger } from './MenubarTrigger.svelte';
export { default as MenuCheckboxItem } from './MenuCheckboxItem.svelte';
export { default as MenuContent } from './MenuContent.svelte';
export { default as MenuGroup } from './MenuGroup.svelte';
export { default as MenuItem } from './MenuItem.svelte';
export { default as MenuLabel } from './MenuLabel.svelte';
export { default as MenuRadioGroup } from './MenuRadioGroup.svelte';
export { default as MenuRadioItem } from './MenuRadioItem.svelte';
export { default as MenuSeparator } from './MenuSeparator.svelte';
export { default as MenuSub } from './MenuSub.svelte';
export { default as MenuSubContent } from './MenuSubContent.svelte';
export { default as MenuSubTrigger } from './MenuSubTrigger.svelte';

export {
  contextTriggerClass,
  MENU_SIZES,
  MENU_VARIANTS,
  type MenuSize,
  type MenuVariant,
  menubarRootClass,
  menuContentClass,
  menuIconClass,
  menuIndicatorClass,
  menuItemClass,
  menuLabelClass,
  menuSeparatorClass,
  menuShortcutClass,
  menuTriggerClass,
} from './variants.ts';
