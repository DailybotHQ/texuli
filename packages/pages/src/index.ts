/**
 * `@texuli/pages`: the block document editor and reader (ADR-011). The
 * `editor` and `reader` subpaths together; the paged view (`paged`), the
 * exports (`export`) and collaboration (`collab`) load from their own
 * subpaths.
 */
export * from './editor/index.ts';
export {
  type DocumentOutlineOptions,
  documentOutline,
  type HeadingAnchorFor,
  type OutlineEntry,
  PageReader,
  PageReaderCore,
  slugify,
} from './reader/index.ts';

/** The package version (first published as `0.7.0`). */
export const PAGES_PACKAGE_VERSION = '0.11.2';
