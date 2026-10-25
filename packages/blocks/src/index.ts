/**
 * `@texuli/blocks` — content blocks for pages, documents and slides.
 * Core engine (schemas, limits, untrusted guard, formula, catalog) lives in
 * `./core`. UI families land in later PLAN_001 tasks.
 */

export {
  CODE_BLOCK_TYPES,
  type CodeBlockCheck,
  type CodeBlockLabelOverrides,
  type CodeBlockLabels,
  type CodeBlockViewProps,
  type CodeFamilyBlock,
  type CodeFamilyBlockType,
  checkCodeBlock,
  isCodeFamilyBlock,
  loadCodeFamily,
} from './code/index.ts';
export * from './core/index.ts';
export {
  checkDataBlock,
  DATA_BLOCK_TYPES,
  type DataBlockCheck,
  type DataBlockLabelOverrides,
  type DataBlockLabels,
  type DataBlockViewProps,
  type DataFamilyBlock,
  type DataFamilyBlockType,
  isDataFamilyBlock,
  loadDataFamily,
} from './data/index.ts';
export {
  DIAGRAM_BLOCK_TYPES,
  type Diagram,
  type DiagramBlockViewProps,
  type DiagramFamilyBlock,
  type DiagramType,
  isDiagramFamilyBlock,
  isDiagramFamilyType,
  loadDiagramFamily,
  parseDiagram,
} from './diagram/index.ts';
export {
  checkEmbedBlock,
  EMBED_APP_MAX_BYTES,
  EMBED_BLOCK_TYPES,
  type EmbedAppBlock,
  type EmbedBlock,
  type EmbedBlockCheck,
  type EmbedBlockLabels,
  type EmbedBlockViewProps,
  type EmbedFamilyBlock,
  type EmbedFamilyBlockType,
  type EmbedMountCleanup,
  type EmbedMountResult,
  type EmbedParseResult,
  type LinkPreviewBlock,
  loadEmbedFamily,
  safeParseEmbedBlock,
} from './embed/index.ts';
export {
  type CalculatorBlock,
  type ChecklistBlock,
  checkInteractiveBlock,
  evaluateCalculator,
  INTERACTIVE_BLOCK_TYPES,
  type InteractiveBlock,
  type InteractiveBlockCheck,
  type InteractiveBlockLabelOverrides,
  type InteractiveBlockLabels,
  type InteractiveBlockViewProps,
  type InteractiveFamilyBlock,
  type InteractiveFamilyBlockType,
  isInteractiveFamilyBlock,
  loadInteractiveFamily,
  type PollBlock,
  parseInteractiveBlock,
  type QuizBlock,
} from './interactive/index.ts';

export {
  checkMapBlock,
  isMapBlock,
  loadMapFamily,
  MAP_BASEMAPS,
  MAP_BLOCK_TYPES,
  MAP_LIMITS,
  type MapBasemapId,
  type MapBlock,
  type MapBlockCheck,
  type MapBlockLabelOverrides,
  type MapBlockLabels,
  type MapBlockViewProps,
  type MapPoint,
  parseMapBlock,
} from './map/index.ts';
export {
  checkMediaBlock,
  isMediaFamilyBlock,
  loadMediaFamily,
  MEDIA_BLOCK_TYPES,
  type MediaBlockCheck,
  type MediaBlockLabelOverrides,
  type MediaBlockLabels,
  type MediaBlockViewProps,
  type MediaFamilyBlock,
  type MediaFamilyBlockType,
} from './media/index.ts';
export {
  checkStructureBlock,
  isStructureFamilyBlock,
  loadStructureFamily,
  STRUCTURE_BLOCK_TYPES,
  type StructureBlockCheck,
  type StructureBlockLabelOverrides,
  type StructureBlockLabels,
  type StructureBlockViewProps,
  type StructureFamilyBlock,
  type StructureFamilyBlockType,
} from './structure/index.ts';
export {
  checkTextBlock,
  isTextFamilyBlock,
  loadTextFamily,
  TEXT_BLOCK_TYPES,
  type TextBlockCheck,
  type TextBlockLabelOverrides,
  type TextBlockLabels,
  type TextBlockViewProps,
  type TextFamilyBlock,
  type TextFamilyBlockType,
} from './text/index.ts';
