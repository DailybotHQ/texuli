<script lang="ts">
/**
 * Registers icons by name for every `Icon` below it (D-G-021). Renders no
 * element. Context only, so it is SSR-safe; changing `icons` updates the
 * icons below in place. Nested providers layer: inner names win.
 */
import type { Snippet } from 'svelte';
import { setIconsContext } from './registry.ts';
import type { IconRegistry, IconRegistryOptions } from './types.ts';

let {
  icons = {},
  fallback,
  children,
}: {
  /**
   * Names to glyphs: a Svelte SVG component, one 24×24 path `d` string, or a
   * lazy loader (`() => import('@lucide/svelte/icons/rocket')`).
   */
  icons?: IconRegistry;
  /**
   * Drawn for unknown names and for lazy icons until they load (a built-in
   * name or a glyph; new in `0.14.0`).
   */
  fallback?: IconRegistryOptions['fallback'];
  children?: Snippet;
} = $props();

setIconsContext(
  () => icons,
  () => fallback
);
</script>

{@render children?.()}
