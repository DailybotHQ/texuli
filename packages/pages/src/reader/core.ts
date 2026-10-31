/**
 * `@texuli/pages/reader-core` (G123): `@texuli/pages/reader` without the default player
 * loader. `PageReaderCore` is `PageReader` with no `loadPlayer` default: live
 * embeds paint only with the host's loader (`() => import('@texuli/player')`),
 * so a host on this entry has no `@texuli/player` reference in its build,
 * static or dynamic. It has no default `loadLibraryBase` either (G127): a
 * design system's `texuli:<theme>` bases load only through the host's loader
 * (`loadPagesLibraryBase`, exported here, is the theme library's). Every
 * other export is the same as `@texuli/pages/reader`.
 */
export type {
  PagesBlockClaim,
  PagesBlockHost,
  PagesBlockHostProps,
  PagesBlockHostRequest,
  PagesBlockSnippet,
  PagesHostNode,
  PagesReadonly,
} from '../shared/block-host.ts';
export type {
  PagesDesignSystemEvent,
  PagesDesignSystems,
  PagesLibraryBaseLoader,
} from '../shared/design-system-types.ts';
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
export { loadPagesLibraryBase } from '../shared/library-base.ts';
export { type MediaResolver, mediaSource, pageLinkHref } from '../shared/media.ts';
export type { PagesPlayerLoader, PagesPlayerModule } from '../shared/player-loader.ts';
export type { PageRef } from '../shared/types.ts';
export { documentOutline, type OutlineEntry, slugify } from './outline.ts';
export { default as PageReaderCore } from './PageReaderCore.svelte';
