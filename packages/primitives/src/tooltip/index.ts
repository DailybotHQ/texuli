import TooltipContent from './TooltipContent.svelte';
import TooltipProvider from './TooltipProvider.svelte';
import TooltipRoot from './TooltipRoot.svelte';
import TooltipTrigger from './TooltipTrigger.svelte';

/** Compound headless tooltip primitives. */
export const Tooltip: {
  readonly Provider: typeof TooltipProvider;
  readonly Root: typeof TooltipRoot;
  readonly Trigger: typeof TooltipTrigger;
  readonly Content: typeof TooltipContent;
} = Object.freeze({
  Provider: TooltipProvider,
  Root: TooltipRoot,
  Trigger: TooltipTrigger,
  Content: TooltipContent,
});

export type { TooltipContext } from './context.ts';
export {
  createTooltipDelayGroup,
  type TooltipDelayGroup,
  type TooltipDelayGroupOptions,
} from './delay-group.ts';
export { default as TooltipContent } from './TooltipContent.svelte';
export { default as TooltipProvider } from './TooltipProvider.svelte';
export { default as TooltipRoot } from './TooltipRoot.svelte';
export { default as TooltipTrigger } from './TooltipTrigger.svelte';
