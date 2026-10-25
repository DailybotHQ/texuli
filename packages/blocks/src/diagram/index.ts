/**
 * `@texuli/blocks/diagram` — flow, sequence/org tree, board and terminal
 * diagrams from validated data. Layout math is framework-free; Svelte
 * renderers load through `loadDiagramFamily()`.
 */

export {
  DIAGRAM_BLOCK_TYPES,
  type DiagramBlockViewProps,
  type DiagramFamilyBlock,
  isDiagramFamilyBlock,
  isDiagramFamilyType,
  loadDiagramFamily,
} from './family.ts';
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
