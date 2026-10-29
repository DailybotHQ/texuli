/**
 * @texuli/pages/host: the document host for `@texuli/player` (spec 0.7.0,
 * ADR-011). The player (L7) cannot import this package (L8), so it takes a
 * `documentHost`: this module's `createDocumentPlayerHost()` validates a
 * `document` node inside the player's validation at the player's tier, and
 * paints a valid one with the read-only `PageReader`, loaded on first use.
 */
export {
  checkDocumentDraft,
  createDocumentPlayerHost,
  type DocumentPlayerHostOptions,
} from './document-host.ts';
