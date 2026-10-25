/**
 * Styled Popover and HoverCard on the token contract.
 * Built on `@texuli/primitives/popover` and `@texuli/primitives/hover-card`.
 */

import HoverCardContent from './HoverCardContent.svelte';
import HoverCardRoot from './HoverCardRoot.svelte';
import HoverCardTrigger from './HoverCardTrigger.svelte';
import PopoverClose from './PopoverClose.svelte';
import PopoverContent from './PopoverContent.svelte';
import PopoverRoot from './PopoverRoot.svelte';
import PopoverTrigger from './PopoverTrigger.svelte';

export const Popover: {
  Root: typeof PopoverRoot;
  Trigger: typeof PopoverTrigger;
  Content: typeof PopoverContent;
  Close: typeof PopoverClose;
} = {
  Root: PopoverRoot,
  Trigger: PopoverTrigger,
  Content: PopoverContent,
  Close: PopoverClose,
};

export const HoverCard: {
  Root: typeof HoverCardRoot;
  Trigger: typeof HoverCardTrigger;
  Content: typeof HoverCardContent;
} = {
  Root: HoverCardRoot,
  Trigger: HoverCardTrigger,
  Content: HoverCardContent,
};

export { default as HoverCardContent } from './HoverCardContent.svelte';
export { default as HoverCardRoot } from './HoverCardRoot.svelte';
export { default as HoverCardTrigger } from './HoverCardTrigger.svelte';
export { default as PopoverClose } from './PopoverClose.svelte';
export { default as PopoverContent } from './PopoverContent.svelte';
export { default as PopoverRoot } from './PopoverRoot.svelte';
export { default as PopoverTrigger } from './PopoverTrigger.svelte';

export {
  hoverCardArrowClass,
  hoverCardContentClass,
  hoverCardTriggerClass,
  POPOVER_SIZES,
  POPOVER_VARIANTS,
  type PopoverSize,
  type PopoverVariant,
  popoverArrowClass,
  popoverCloseClass,
  popoverContentClass,
  popoverTriggerClass,
} from './variants.ts';
