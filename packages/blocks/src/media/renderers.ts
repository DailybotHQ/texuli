/**
 * Eager entry for hosts that render media blocks on first paint. Most hosts
 * should prefer `loadMediaFamily()` from `@texuli/blocks` (lazy chunk).
 */

export { default as MediaBlockView } from './MediaBlockView.svelte';
