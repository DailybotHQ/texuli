import type { ChildSnippet } from '../internal/child.ts';

/** When custom scrollbars are shown. Native scrolling always works. */
export type ScrollAreaType = 'hover' | 'scroll' | 'auto' | 'always';

export type ScrollAreaOrientation = 'horizontal' | 'vertical';

export type ScrollAreaDir = 'ltr' | 'rtl';

export type ScrollMetrics = {
  scrollTop: number;
  scrollLeft: number;
  scrollWidth: number;
  scrollHeight: number;
  clientWidth: number;
  clientHeight: number;
};

export type ScrollAreaRootProps = {
  type?: ScrollAreaType;
  dir?: ScrollAreaDir;
  /** ms to keep scrollbars visible after scroll/hover ends (type scroll/hover). */
  scrollHideDelay?: number;
  class?: string;
  children?: import('svelte').Snippet;
  child?: ChildSnippet<Record<string, unknown>>;
  'aria-label'?: string;
  'aria-labelledby'?: string;
};

export type ScrollAreaViewportProps = {
  class?: string;
  children?: import('svelte').Snippet;
  child?: ChildSnippet<Record<string, unknown>>;
  id?: string;
  tabindex?: number;
};

export type ScrollAreaScrollbarProps = {
  orientation: ScrollAreaOrientation;
  forceMount?: boolean;
  class?: string;
  children?: import('svelte').Snippet;
  child?: ChildSnippet<Record<string, unknown>>;
};

export type ScrollAreaThumbProps = {
  forceMount?: boolean;
  class?: string;
  children?: import('svelte').Snippet;
  child?: ChildSnippet<Record<string, unknown>>;
};

export type ScrollAreaCornerProps = {
  /** Render even when only one axis (or none) overflows. */
  forceMount?: boolean;
  class?: string;
  children?: import('svelte').Snippet;
  child?: ChildSnippet<Record<string, unknown>>;
};
