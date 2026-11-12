/**
 * The operations the remote MCP Function (`functions/mcp.ts`) may import:
 * every `edge` and `site` operation, and nothing with runtime `node`.
 * Node-only modules (`emoji-catalog.ts`, `emoji-convert-node.ts`,
 * `document-export.ts`, `design-system-save.ts`) and `@texuli/emojis/catalog`
 * are never imported here.
 */
import { TEXULI_ALIASES, TEXULI_REMOVED_NAMES } from './aliases.ts';
import { blockList, blockSchema } from './blocks.ts';
import { blueprintTheme, blueprintValidate } from './blueprint.ts';
import { catalogSearch, catalogValidate, componentGet, exampleSearch } from './catalog.ts';
import { deckRun } from './deck.ts';
import {
  dsCompile,
  dsContrast,
  dsDiff,
  dsImport,
  dsPreview,
  dsSuggest,
  dsValidate,
} from './design-system.ts';
import { dsAllow } from './design-system-allow.ts';
import { dsBundle } from './design-system-bundle.ts';
import { designSystemGenerate } from './design-system-generate.ts';
import { documentRun } from './document.ts';
import { emojiConvert } from './emoji.ts';
import { mdConvert, mdRender } from './markdown.ts';
import { createOperationRegistry } from './registry.ts';
import { sitePages, siteRead, siteSearch } from './site.ts';
import { themeGet, themePreview, themeSearch } from './themes.ts';
import type { Operation } from './types.ts';

/** Edge and site operations, in the same order as the full registry minus node ops. */
export const TEXULI_EDGE_OPERATIONS: readonly Operation[] = Object.freeze([
  catalogSearch,
  catalogValidate,
  componentGet,
  exampleSearch,
  blueprintValidate,
  blueprintTheme,
  blockList,
  blockSchema,
  themeSearch,
  themeGet,
  themePreview,
  dsValidate,
  dsCompile,
  dsContrast,
  dsSuggest,
  dsImport,
  designSystemGenerate,
  dsAllow,
  dsBundle,
  dsDiff,
  dsPreview,
  deckRun,
  documentRun,
  mdConvert,
  mdRender,
  emojiConvert,
  sitePages,
  siteRead,
  siteSearch,
]);

const EDGE_NAMES = new Set(TEXULI_EDGE_OPERATIONS.map((operation) => operation.name));
const EDGE_REMOVED = TEXULI_REMOVED_NAMES.map((entry) => ({
  ...entry,
  replacedBy: entry.replacedBy.filter((name) => EDGE_NAMES.has(name)),
})).filter((entry) => entry.replacedBy.length > 0);

/** Registry the remote MCP Function serves. */
export const texuliEdgeOps = createOperationRegistry(
  TEXULI_EDGE_OPERATIONS,
  TEXULI_ALIASES,
  EDGE_REMOVED
);
