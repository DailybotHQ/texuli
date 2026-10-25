/**
 * Eager entry for hosts that render code blocks on first paint. Most hosts
 * should prefer `loadCodeFamily()` from `@texuli/blocks` (lazy chunk).
 */

export { default as CodeBlockView } from './CodeBlockView.svelte';
