import type { ScrollAreaDir, ScrollAreaType } from '@texuli/primitives/scroll-area';
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { ScrollAreaSize } from './variants.ts';

export type ScrollAreaProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  'aria-label' | 'aria-labelledby' | 'children' | 'dir' | 'role'
> & {
  /** Accessible name for the scroll region. */
  label: string;
  /** Controls when the decorative scrollbar appears. Native scrolling is always available. */
  type?: ScrollAreaType;
  /** Text direction used for horizontal scroll behavior. */
  dir?: ScrollAreaDir;
  /** Maximum block size preset. */
  size?: ScrollAreaSize;
  children?: Snippet;
};
