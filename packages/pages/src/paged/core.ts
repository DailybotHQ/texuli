/**
 * `@texuli/pages/paged-core` (G123): `@texuli/pages/paged` without the default player
 * loader. `PagedViewCore` is `PagedView` with no `loadPlayer` default: live
 * embeds paint only with the host's loader (`() => import('@texuli/player')`),
 * so a host on this entry has no `@texuli/player` reference in its build,
 * static or dynamic. Every other export is the same as `@texuli/pages/paged`.
 */
export type {
  PagesBlockClaim,
  PagesBlockHost,
  PagesBlockHostProps,
  PagesBlockHostRequest,
  PagesBlockSnippet,
  PagesHostNode,
} from '../shared/block-host.ts';
export type { PagesPlayerLoader, PagesPlayerModule } from '../shared/player-loader.ts';
export { DEFAULT_PAGED_LABELS, type PagedLabels, resolvePagedLabels } from './labels.ts';
export { ATOMIC_SELECTOR, lineBottoms, measureUnit, splitPoints } from './measure.ts';
export { default as PagedViewCore } from './PagedViewCore.svelte';
export { adoptCustomPage, customPageRule, pageName } from './page-style.ts';
