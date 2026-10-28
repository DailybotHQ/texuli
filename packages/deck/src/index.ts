/**
 * @texuli/deck: the framework-free, dependency-free deck engine (ADR-009).
 * In development (PLAN_008): this root aggregates the subpaths that exist
 * today, the deck model v2 (`./model`) and the owned schema kit (`./schema`);
 * the other subpaths fill in as their tasks land.
 */
export * from './model/index.ts';
export * from './schema/index.ts';
