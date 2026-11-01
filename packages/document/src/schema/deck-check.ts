/**
 * The inline deck check of the full `@texuli/document/schema` entry: deck
 * model v2 through `parseDeck`. `@texuli/document/schema-core` leaves it out,
 * so a host that never embeds an inline deck never loads the deck model.
 */
import { parseDeck } from '@texuli/deck/model';
import type { DeckPayloadResult } from './schema.ts';

/** Validate an inline deck payload as deck model v2. */
export function checkDeckPayload(payload: unknown): DeckPayloadResult {
  const result = parseDeck(payload);
  return result.ok ? { ok: true } : { ok: false, issues: result.issues };
}
