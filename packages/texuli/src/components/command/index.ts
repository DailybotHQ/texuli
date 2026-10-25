/**
 * Styled Command palette on `@texuli/primitives/command` (+ dialog for CommandPalette).
 */
import CommandEmpty from './CommandEmpty.svelte';
import CommandGroup from './CommandGroup.svelte';
import CommandGroupHeading from './CommandGroupHeading.svelte';
import CommandGroupItems from './CommandGroupItems.svelte';
import CommandInput from './CommandInput.svelte';
import CommandItem from './CommandItem.svelte';
import CommandList from './CommandList.svelte';
import CommandLoading from './CommandLoading.svelte';
import CommandPalette from './CommandPalette.svelte';
import CommandRoot from './CommandRoot.svelte';
import CommandTrigger from './CommandTrigger.svelte';

export const Command = {
  Root: CommandRoot,
  Input: CommandInput,
  List: CommandList,
  Group: CommandGroup,
  GroupHeading: CommandGroupHeading,
  GroupItems: CommandGroupItems,
  Item: CommandItem,
  Empty: CommandEmpty,
  Loading: CommandLoading,
  Trigger: CommandTrigger,
  Palette: CommandPalette,
} as const;

export { default as CommandEmpty } from './CommandEmpty.svelte';
export { default as CommandGroup } from './CommandGroup.svelte';
export { default as CommandGroupHeading } from './CommandGroupHeading.svelte';
export { default as CommandGroupItems } from './CommandGroupItems.svelte';
export { default as CommandInput } from './CommandInput.svelte';
export { default as CommandItem } from './CommandItem.svelte';
export { default as CommandList } from './CommandList.svelte';
export { default as CommandLoading } from './CommandLoading.svelte';
export { default as CommandPalette } from './CommandPalette.svelte';
export { default as CommandRoot } from './CommandRoot.svelte';
export { default as CommandTrigger } from './CommandTrigger.svelte';

export type {
  CommandItemData,
  CommandPaletteSearch,
  CommandPaletteSelect,
} from './types.ts';

export {
  COMMAND_SIZES,
  COMMAND_VARIANTS,
  type CommandSize,
  type CommandVariant,
  commandEmptyClass,
  commandGroupClass,
  commandGroupHeadingClass,
  commandInputClass,
  commandInputRowClass,
  commandItemClass,
  commandListClass,
  commandLoadingClass,
  commandPaletteClass,
  commandRootClass,
  commandTriggerClass,
} from './variants.ts';
