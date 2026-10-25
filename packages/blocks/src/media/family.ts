import type { Component } from 'svelte';
import type { MediaBlockViewProps } from './engine.ts';

export {
  isMediaFamilyBlock,
  MEDIA_BLOCK_TYPES,
  type MediaBlockViewProps,
  type MediaFamilyBlock,
  type MediaFamilyBlockType,
} from './engine.ts';

/** Lazily loads the media family renderer (its own chunk). */
export function loadMediaFamily(): Promise<{ default: Component<MediaBlockViewProps> }> {
  return import('./MediaBlockView.svelte');
}
