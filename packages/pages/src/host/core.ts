/**
 * `@texuli/pages/host-core` (G123): `@texuli/pages/host` without the
 * default player loader. `createDocumentPlayerHostCore` mounts the core
 * reader and paints live embeds only with the host's `loadPlayer`, so a
 * host on this entry has no `@texuli/player` reference in its build, static
 * or dynamic (the player itself still calls the host at runtime). It has
 * no default `loadLibraryBase` either (G127): pass `loadPagesLibraryBase`
 * (exported here) to resolve a design system's `texuli:<theme>` bases from
 * the token theme library.
 */

export type { PagesLibraryBaseLoader } from '../shared/design-system-types.ts';
export { loadPagesLibraryBase } from '../shared/library-base.ts';

export type { PagesPlayerLoader, PagesPlayerModule } from '../shared/player-loader.ts';
export {
  checkDocumentDraft,
  createDocumentPlayerHostCore,
  type DocumentPlayerHostOptions,
} from './document-host-core.ts';
