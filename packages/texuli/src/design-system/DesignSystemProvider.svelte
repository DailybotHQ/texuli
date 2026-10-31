<script lang="ts">
import {
  type ApplicableDesignSystem,
  applyDesignSystem,
  isSafeDesignSystemValue,
  pickDesignSystemMode,
} from '@texuli/tokens/design-system/apply';
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { setDesignDefaults } from '../defaults/index.ts';
import type { DesignDefaults } from '../defaults/vocabulary.ts';
import { PROVIDER_ATTRIBUTES } from './index.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** A compiled design system (`compileDesignSystem`, or a cached JSON copy of one). */
  compiled: ApplicableDesignSystem;
  /** The mode to apply. Default `light`; a mode `compiled` lacks paints its compiled mode (`pickDesignSystemMode`). */
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
  /**
   * Called when `compiled` cannot be applied (no compiled mode, a variant
   * mismatch). The scope is then restored to its own state, without the
   * previous design system; nothing throws.
   */
  onapplyerror?: (error: unknown) => void;
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
  onapplyerror,
  children,
  ...rest
}: Props = $props();

// Defaults for every Texuli component inside; filtered by the closed vocabulary.
setDesignDefaults(() => (compiled.defaults ?? {}) as DesignDefaults);

// Rendered in markup (escaped attribute values, never a style string), so the
// server HTML already matches `designSystemStyle(compiled)` before hydration.
const markup = $derived.by(() => {
  const out: Record<string, string> = {};
  const attrs = (compiled.attrs ?? {}) as Record<string, unknown>;
  for (const name of PROVIDER_ATTRIBUTES) {
    const value = name === 'data-tx-ds-variant' ? (variant ?? compiled.variant) : attrs[name];
    if (isSafeDesignSystemValue(value) && value.length <= 128) out[name] = value;
  }
  return out;
});

// The mode painted (a dark-only design system paints dark under a light host); the
// requested one when `compiled` has no mode at all (the effect below reports that).
const painted = $derived.by(() => {
  try {
    return pickDesignSystemMode(compiled, mode);
  } catch {
    return mode;
  }
});

let dispose: (() => void) | undefined;

// A later apply replaces the earlier one in one style write; no dispose in between. A
// refused apply restores the scope, so the previous design system does not linger.
$effect(() => {
  if (!ref) return;
  try {
    dispose = applyDesignSystem(ref, compiled, { mode, variant, fonts, base });
  } catch (error) {
    dispose?.();
    dispose = undefined;
    onapplyerror?.(error);
  }
});

// Restore the element only when the provider goes away.
$effect(() => () => dispose?.());
</script>

<!-- data-tx-mode is the mode painted (a dark-only design system paints dark under a light
     host), in markup before hydration, as applyDesignSystem writes it after. -->
<div
  {...rest}
  {...markup}
  bind:this={ref}
  data-tx-scope={scope ?? compiled.id}
  data-tx-mode={painted}
>
  {@render children?.()}
</div>
