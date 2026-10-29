/**
 * `@texuli/pages`: the block document editor and reader (ADR-011). The
 * `editor` and `reader` subpaths together; `paged`, `collab` and `export`
 * are planned.
 */
export * from './editor/index.ts';
export { documentOutline, type OutlineEntry, PageReader, slugify } from './reader/index.ts';

/** The package version (the `0.0.0` placeholder until the first release). */
export const PAGES_PACKAGE_VERSION = '0.0.0';
