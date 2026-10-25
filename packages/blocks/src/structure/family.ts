import type { Component } from 'svelte';
import type { StructureBlockViewProps } from './engine.ts';

export {
  isStructureFamilyBlock,
  STRUCTURE_BLOCK_TYPES,
  type StructureBlockViewProps,
  type StructureFamilyBlock,
  type StructureFamilyBlockType,
} from './engine.ts';

/** Lazily loads the structure family renderer (its own chunk). */
export function loadStructureFamily(): Promise<{ default: Component<StructureBlockViewProps> }> {
  return import('./StructureFamily.svelte');
}
