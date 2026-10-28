/**
 * @texuli/drag — Texuli's framework-free, general-purpose drag engine
 * (PLAN_007, ADR-007). The root holds the session state machine and the
 * shared geometry; every capability lives in its own subpath:
 * `sortable`, `collision`, `modifiers`, `auto-scroll`, `gesture`, `spatial`,
 * `graph`, `messages` and `testing`. No DOM access at module load.
 */
export * from './geometry.ts';
export * from './session.ts';
