import type { Component } from 'svelte';

/**
 * Turns an icon name from block data (`circle-check`) into an icon the
 * renderer draws: a Svelte SVG component (a Lucide icon, for example; it
 * receives `size={16}`) or a Texuli built-in icon name. Return `undefined` to
 * fall back to the built-in icon of that name, or to nothing. Block data
 * never supplies components, markup or URLs: only the name.
 */
export type BlockIconResolver = (
  name: string
) => string | Component<{ size?: number | string }> | undefined;
