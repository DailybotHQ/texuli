/**
 * `@texuli/blocks/diagram/engine` — Svelte-free diagram models, limits and layout math.
 * No `.svelte` and no `svelte` imports. Use `@texuli/blocks/diagram` for loaders.
 */

import type { FieldIssue } from '../core/schema/primitives.ts';
import type { Diagram, DiagramType } from './schema.ts';
import { DIAGRAM_BLOCK_TYPES, parseDiagram } from './schema.ts';

export {
  type DiagramEdge,
  type DiagramLayout,
  type DiagramPosition,
  layoutBoard,
  layoutFlow,
  layoutTerminal,
  layoutTree,
} from './layout.ts';
export {
  type BoardCard,
  type BoardColumn,
  type BoardDiagram,
  DIAGRAM_BLOCK_TYPES,
  DIAGRAM_LIMITS,
  type Diagram,
  type DiagramParseResult,
  type DiagramType,
  diagramJsonPath,
  type FlowDiagram,
  type FlowNode,
  parseDiagram,
  type TerminalDiagram,
  type TerminalLine,
  type TreeDiagram,
  type TreeNode,
} from './schema.ts';
export { DIAGRAM_PAD, TONE_BORDER, toneBorder } from './tones.ts';

export type DiagramFamilyBlock = Diagram;

export function isDiagramFamilyBlock(value: unknown): value is Diagram {
  return parseDiagram(value).success;
}

export function isDiagramFamilyType(type: string): type is DiagramType {
  return (DIAGRAM_BLOCK_TYPES as readonly string[]).includes(type);
}

export interface DiagramBlockViewProps {
  block: unknown;
  oninvalid?: (issues: FieldIssue[]) => void;
}
