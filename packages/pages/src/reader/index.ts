/**
 * @texuli/pages/reader: the read-only reader of a document, with anchored
 * headings and an outline. It paints blocks and embeds like the editor and
 * loads no editing code.
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
export type { PageRef } from '../shared/types.ts';
export { documentOutline, type OutlineEntry, slugify } from './outline.ts';
export { default as PageReader } from './PageReader.svelte';
