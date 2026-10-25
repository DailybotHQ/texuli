import type { Component } from 'svelte';
import type { MapBlockViewProps } from './engine.ts';

export {
  MAP_BLOCK_TYPES,
  type MapBlockViewProps,
  type MapFamilyBlockType,
} from './engine.ts';

/** Lazily loads the map block renderer (its own chunk). */
export function loadMapFamily(): Promise<{ default: Component<MapBlockViewProps> }> {
  return import('./MapBlockView.svelte');
}
