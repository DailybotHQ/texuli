/**
 * @texuli/document: the framework-free, DOM-free document engine (ADR-011).
 * The root re-exports `model`, `schema`, `ops` and `markdown`. The CRDT sync
 * core loads on its own from `@texuli/document/sync` (ADR-010), so only a
 * collaborative session pays for it.
 */
export * from './markdown/index.ts';
export * from './model/index.ts';
export * from './ops/index.ts';
export * from './schema/index.ts';
