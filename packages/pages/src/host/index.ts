/**
 * @texuli/pages/host: the document host for `@texuli/player` (spec 0.7.0,
 * ADR-011). The player (L7) cannot import this package (L8), so it takes a
 * `documentHost`: this module's `createDocumentPlayerHost()` validates a
 * `document` node inside the player's validation at the player's tier, and
 * paints a valid one with the read-only `PageReader`, loaded on first use.
 * `@texuli/pages/host-core` is the same host without the default player
 * loader (G123).
 */
export * from './core.ts';
export { createDocumentPlayerHost } from './document-host.ts';
