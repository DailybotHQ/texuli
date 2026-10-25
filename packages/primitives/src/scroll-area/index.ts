/**
 * Headless ScrollArea — native scrolling with optional custom scrollbar chrome.
 * Keyboard and screen readers use the native scrolling viewport.
 */
import Corner from './Corner.svelte';
import Root from './Root.svelte';
import Scrollbar from './Scrollbar.svelte';
import Thumb from './Thumb.svelte';
import Viewport from './Viewport.svelte';

export const ScrollArea = {
  Root,
  Viewport,
  Scrollbar,
  Thumb,
  Corner,
};

export { default as ScrollAreaCorner } from './Corner.svelte';
export { default as ScrollAreaRoot } from './Root.svelte';
export { default as ScrollAreaScrollbar } from './Scrollbar.svelte';
export { default as ScrollAreaThumb } from './Thumb.svelte';
export type {
  ScrollAreaCornerProps,
  ScrollAreaDir,
  ScrollAreaOrientation,
  ScrollAreaRootProps,
  ScrollAreaScrollbarProps,
  ScrollAreaThumbProps,
  ScrollAreaType,
  ScrollAreaViewportProps,
  ScrollMetrics,
} from './types.ts';
export { default as ScrollAreaViewport } from './Viewport.svelte';
