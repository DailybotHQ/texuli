/**
 * @texuli/pages/editor: the block document editor (ADR-011) on
 * `@texuli/document` operations, `@texuli/editor` text, the slash menu,
 * block drag on `@texuli/drag` and live embeds painted by `@texuli/player`.
 */

export {
  type BlueprintNode,
  componentBlueprint,
  deckBlueprint,
  type EmbedPlan,
  type EmbedResolver,
  planEmbed,
  wrappedBlockInput,
} from '../shared/embeds.ts';
export { DEFAULT_PAGES_LABELS, type PagesLabels, resolvePagesLabels } from '../shared/labels.ts';
export { type MediaResolver, mediaSource, pageLinkHref } from '../shared/media.ts';
export {
  COLUMN_UNITS,
  columnWidths,
  MIN_COLUMN_WIDTH,
  pointerSteps,
  resizeColumns,
} from './columns.ts';
export {
  adjacentRow,
  BLOCK_GROUP,
  blockContainers,
  childList,
  listOfParent,
  moveTarget,
  parentOfList,
  ROOT_LIST,
  rowOrder,
} from './moves.ts';
export { default as PageEditor } from './PageEditor.svelte';
export { RowController, type RowControllerHooks } from './row-controller.ts';
export {
  type BlockCatalogLike,
  blockSlashItems,
  type ComponentEmbedOption,
  coreSlashItems,
  DEFAULT_COMPONENT_EMBEDS,
  EXTRA_BLOCK_SAMPLES,
  filterSlashItems,
  foldText,
  loadBlockItems,
  type PageRef,
  SAMPLE_DECK,
  type SlashGroup,
  type SlashItem,
} from './slash.ts';
export {
  type Located,
  PagesEditor,
  type PagesEditorOptions,
  type PagesEditorSync,
  type PagesFocusRequest,
  type PagesSlashRequest,
} from './state.svelte.ts';
export {
  blockExcerpt,
  containsId,
  inlineLength,
  isEditorBlock,
  isTextRow,
  leafLength,
  rowEditorDocument,
  TEXT_ROW_TYPES,
  textLeaves,
  textRowOperations,
  updateOperations,
} from './text.ts';
