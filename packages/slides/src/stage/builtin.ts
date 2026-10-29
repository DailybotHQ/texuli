/**
 * The stage's built-in block support, one lazy chunk (`loadBuiltinDeckBlocks`):
 * the default free-slide block check (the `@texuli/blocks` schema), the
 * built-in free-slide renderer (the block families' lazy loaders) and the
 * block-family prefetch. A host that brings its own `validateBlock` (or
 * `loadValidateBlock`) and a `free` renderer for every free slide never
 * loads it.
 */
export { validateDeckBlock } from './block-check.ts';
export { default as FreeSlide } from './FreeSlide.svelte';
export { prefetchDeckSlides } from './prefetch.ts';
