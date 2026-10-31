<script lang="ts">
import {
  type ApplicableDesignSystem,
  applyDesignSystem,
  isSafeDesignSystemValue,
} from '@texuli/tokens/design-system/apply';
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { setDesignDefaults } from '../defaults/index.ts';
import type { DesignDefaults } from '../defaults/vocabulary.ts';
import { PROVIDER_ATTRIBUTES } from './index.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** A compiled design system (`compileDesignSystem`, or a cached JSON copy of one). */
  compiled: ApplicableDesignSystem;
  /** The compiled mode to apply. Default `light`. */
  mode?: 'light' | 'dark';
  /** The variant `compiled` was compiled for (checked against it). */
  variant?: string;
  /** The `data-tx-scope` name. Default: the design system's id. */
  scope?: string;
  /** Register the design system's font faces on first use. Default `true`. */
  fonts?: boolean;
  /** The base URL relative font paths resolve against. Default: the document's base URI. */
  base?: string;
  /** The rendered scope element (bindable). */
  ref?: HTMLDivElement | null;
  children?: Snippet;
};

let {
  compiled,
  mode = 'light',
  variant,
  scope,
  fonts = true,
  base,
  ref = $bindable(null),
  children,
  ...rest
}: Props = $props();

// Defaults for every Texuli component inside; filtered by the closed vocabulary.
setDesignDefaults(() => (compiled.defaults ?? {}) as DesignDefaults);

// Rendered in markup (escaped attribute values, never a style string), so the
// server HTML already matches `designSystemStyle(compiled)` before hydration.
const markup = $derived.by(() => {
  const out: Record<string, string> = {};
  const attrs = compiled.attrs as Record<string, unknown>;
  for (const name of PROVIDER_ATTRIBUTES) {
    const value = name === 'data-tx-ds-variant' ? (variant ?? compiled.variant) : attrs[name];
    if (isSafeDesignSystemValue(value) && value.length <= 128) out[name] = value;
  }
  return out;
});

let dispose: (() => void) | undefined;

// A later apply replaces the earlier one in one style write; no dispose in between.
$effect(() => {
  if (ref) dispose = applyDesignSystem(ref, compiled, { mode, variant, fonts, base });
});

// Restore the element only when the provider goes away.
$effect(() => () => dispose?.());
</script>

<div
  {...rest}
  {...markup}
  bind:this={ref}
  data-tx-scope={scope ?? compiled.id}
  data-tx-mode={mode}
>
  {@render children?.()}
</div>
