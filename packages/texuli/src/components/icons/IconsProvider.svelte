<script lang="ts">
/**
 * Registers icons by name for every `Icon` below it (D-G-021). Renders no
 * element. Context only, so it is SSR-safe; changing `icons` updates the
 * icons below in place. Nested providers layer: inner names win.
 */
import type { Snippet } from 'svelte';
import { setIconsContext } from './registry.ts';
import type { IconRegistry } from './types.ts';

let {
  icons = {},
  children,
}: {
  /** Names to glyphs: a Svelte SVG component or one 24×24 path `d` string. */
  icons?: IconRegistry;
  children?: Snippet;
} = $props();

setIconsContext(() => icons);
</script>

{@render children?.()}
