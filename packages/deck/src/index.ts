/**
 * @texuli/deck: the framework-free, dependency-free deck engine (ADR-009).
 * In development (PLAN_008). This root re-exports the deck model v2
 * (`./model`) and the owned schema kit (`./schema`); import the engine,
 * Markdown, math, authoring and templates from their own subpaths so a host
 * loads only what it uses.
 */
export * from './model/index.ts';
export * from './schema/index.ts';
