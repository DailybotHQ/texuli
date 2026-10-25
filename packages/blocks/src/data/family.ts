import type { Component } from 'svelte';
import type { DataBlockViewProps } from './engine.ts';

export {
  DATA_BLOCK_TYPES,
  type DataBlockViewProps,
  type DataFamilyBlock,
  type DataFamilyBlockType,
  isDataFamilyBlock,
} from './engine.ts';

export function loadDataFamily(): Promise<{ default: Component<DataBlockViewProps> }> {
  return import('./DataBlockView.svelte');
}
