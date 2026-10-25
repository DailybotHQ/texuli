import { MEDIA_DATA_URI_MAX_BYTES } from './safety.ts';
import { BLOCK_CONTENT_LIMITS } from './schema/primitives.ts';

/**
 * Hard upper bounds for block documents accepted from files, links or paste.
 * Individual schemas impose smaller field caps; these are the outer guards.
 */
export const BLOCK_LIMITS = Object.freeze({
  /** Serialized UTF-8 JSON bytes, including embedded media data URIs. */
  maxBytes: 1024 * 1024,
  /** JSON object/array nesting in one block document. */
  maxDepth: 12,
  maxBlocks: 2_000,
  maxContainerDepth: BLOCK_CONTENT_LIMITS.containerDepth,
  maxDataUriBytes: MEDIA_DATA_URI_MAX_BYTES,
  maxDocumentDataUriBytes: 512 * 1024,
  /** General guard ceiling; field schemas are tighter. */
  maxTextLength: BLOCK_CONTENT_LIMITS.code,
  maxTableCells: BLOCK_CONTENT_LIMITS.tableColumns * BLOCK_CONTENT_LIMITS.tableRows,
  /** Diagram model caps (flow / tree / board / terminal). */
  flowNodes: 12,
  treeNodes: 64,
  treeDepth: 6,
  boardColumns: 6,
  boardCardsPerColumn: 8,
  terminalLines: 40,
});

export type BlockLimits = { [Key in keyof typeof BLOCK_LIMITS]: number };
