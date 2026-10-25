import type { Component } from 'svelte';
import type { DiagramBlockViewProps } from './engine.ts';

export {
  DIAGRAM_BLOCK_TYPES,
  type Diagram,
  type DiagramBlockViewProps,
  type DiagramFamilyBlock,
  type DiagramType,
  isDiagramFamilyBlock,
  isDiagramFamilyType,
} from './engine.ts';

/** Lazily loads the diagram family renderer (its own chunk). */
export function loadDiagramFamily(): Promise<{ default: Component<DiagramBlockViewProps> }> {
  return import('./DiagramFamily.svelte');
}
