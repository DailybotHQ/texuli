/**
 * Eager entry for hosts that render text blocks on first paint. Most hosts
 * should prefer `loadTextFamily()` from `@texuli/blocks` (lazy chunk).
 */

export { default as RichText } from './RichText.svelte';
export { default as TextBlockView } from './TextBlockView.svelte';
