import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { ChildSnippet } from '../internal/index.ts';

/** Props for {@link Progress.Root} (Bits-compatible public surface). */
export type ProgressRootProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /**
   * Current value. `null` is indeterminate (no `aria-valuenow`).
   * @default 0
   */
  value?: number | null;
  /**
   * Maximum of the range.
   * @default 100
   */
  max?: number;
  /**
   * Minimum of the range.
   * @default 0
   */
  min?: number;
  /** Composition snippet; receives merged root props. */
  child?: ChildSnippet<Record<string, unknown>>;
  children?: Snippet;
  /** Bindable element ref. */
  ref?: HTMLDivElement | null;
};
