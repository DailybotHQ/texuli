import type { Snippet } from 'svelte';
import { createPrimitiveContext } from '../internal/context.ts';

/** A content panel registered for the viewport to render. */
export interface NavigationMenuContentEntry {
  id: string;
  class?: string | undefined;
  children?: Snippet | undefined;
}

export interface NavigationMenuContextValue {
  readonly value: string;
  readonly orientation: 'horizontal' | 'vertical';
  /** Which way the newly opened content enters (`data-motion`). */
  readonly motion: 'from-start' | 'from-end' | undefined;
  /** Item values in document order (for motion and the indicator). */
  readonly order: string[];
  /** Whether a Viewport renders the open content (instead of each Item). */
  viewport: boolean;
  /** Content registered per item value when a Viewport is used. */
  readonly contents: Map<string, NavigationMenuContentEntry>;
  /** The nav element (dismissal, focus and measurements). */
  root: HTMLElement | null;
  toggle(value: string): void;
  close(options?: { focusTrigger?: boolean }): void;
  pointerEnterTrigger(value: string): void;
  pointerLeave(): void;
  pointerEnterContent(): void;
  register(value: string): () => void;
  triggerId(value: string): string;
  contentId(value: string): string;
  /** An item's part records its consumer `id` (or clears it), so references use the effective id. */
  claimId(part: 'trigger' | 'content', value: string, id: string | null | undefined): void;
}

export const navigationMenuContext =
  createPrimitiveContext<NavigationMenuContextValue>('NavigationMenu');

export interface NavigationMenuItemContextValue {
  readonly value: string;
}

export const navigationMenuItemContext =
  createPrimitiveContext<NavigationMenuItemContextValue>('NavigationMenu.Item');
