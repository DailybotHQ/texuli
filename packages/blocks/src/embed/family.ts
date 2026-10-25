import type { Component } from 'svelte';
import type { EmbedBlockViewProps } from './engine.ts';

export {
  DEFAULT_EMBED_BLOCK_LABELS,
  EMBED_BLOCK_TYPES,
  type EmbedBlockLabels,
  type EmbedBlockViewProps,
  type EmbedFamilyBlock,
  type EmbedFamilyBlockType,
  type EmbedMountCleanup,
  type EmbedMountResult,
} from './engine.ts';

/** Loads the embed family as a separate Svelte chunk. */
export function loadEmbedFamily(): Promise<{ default: Component<EmbedBlockViewProps> }> {
  return import('./EmbedBlockView.svelte');
}
