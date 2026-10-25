import type { Component } from 'svelte';
import type { CodeBlockViewProps } from './family-engine.ts';

export {
  CODE_BLOCK_TYPES,
  type CodeBlockViewProps,
  type CodeFamilyBlock,
  type CodeFamilyBlockType,
  isCodeFamilyBlock,
} from './family-engine.ts';

/** Lazily loads the code family renderer (its own chunk). */
export function loadCodeFamily(): Promise<{ default: Component<CodeBlockViewProps> }> {
  return import('./CodeBlockView.svelte');
}
