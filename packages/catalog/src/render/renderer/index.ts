/**
 * `@texuli/catalog/render/renderer` — sink-free catalog tree renderer core.
 *
 * Unknown ids → labelled placeholder. Schema failures → node dropped.
 * Never passes `class` / `style` or HTML strings. No Svelte / DOM here:
 * the host maps {@link RenderNode} to real components.
 */

export {
  BLOCK_FAMILY_TYPES,
  blockFamilyIdFor,
  blockFamilyMismatch,
} from './block-families.ts';
export {
  type RenderCatalogFromBuildOptions,
  renderCatalogFromBuild,
  renderCatalogFromSpecs,
} from './catalog-view.ts';
export {
  FORBIDDEN_PROP_NAMES,
  looksLikeHtmlString,
  type PropSanitizeResult,
  sanitizeProps,
} from './props.ts';
export { renderCatalogTree } from './render.ts';
export { resolveTier } from './tier.ts';
export type {
  CatalogTreeInput,
  RenderCatalog,
  RenderComponentSpec,
  RenderConditions,
  RenderDiagnostic,
  RenderIssueCode,
  RenderNode,
  RenderOptions,
  RenderResult,
  RenderTier,
  WhenParse,
} from './types.ts';
