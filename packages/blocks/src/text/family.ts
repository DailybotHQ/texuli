import type { Component } from 'svelte';
import type { TextBlockViewProps } from './engine.ts';

export {
  isTextFamilyBlock,
  TEXT_BLOCK_TYPES,
  type TextBlockViewProps,
  type TextFamilyBlock,
  type TextFamilyBlockType,
} from './engine.ts';

/** Lazily loads the text family renderer (its own chunk). */
export function loadTextFamily(): Promise<{ default: Component<TextBlockViewProps> }> {
  return import('./TextBlockView.svelte');
}
