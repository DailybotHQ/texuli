/**
 * Turn whatever a host hands the stage into a validated v2 deck, or a list of
 * diagnostics. Every input goes through `migrateDeck` (a v2 deck passes
 * unchanged; a Texuli v1 deck, a grammar tree or a Protoyard deck is
 * converted) and then `parseDeck`, with `@texuli/blocks` checking each
 * free-slide block body (unless the host hooks bring their own
 * `validateBlock`). The stage paints only an `ok` result: an invalid
 * deck is never rendered.
 */

import { migrateDeck } from '@texuli/deck/model';
import { validateDeckBlock } from './block-check.ts';
import {
  type DeckValidationHooks,
  markPreparedDeck,
  type PreparedDeck,
  prepareDeckWith,
} from './prepare-core.ts';

export { validateDeckBlock } from './block-check.ts';
export {
  type DeckBlockCheck,
  type DeckValidationHooks,
  isPreparedDeck,
  type PreparedDeck,
  type PreparedDeckOk,
  prepareDeckV2,
} from './prepare-core.ts';

/**
 * Migrate and validate a deck input. Never throws: a hostile getter or a
 * failing host hook becomes a diagnostic. Without `hooks.validateBlock`,
 * free-slide blocks go through `validateDeckBlock`. An `ok` result is a
 * prepared deck (`isPreparedDeck`, its wrapper frozen): handed to the stage
 * as `deck` at the `developer` tier, it paints without migrating or
 * validating again (G83).
 */
export function prepareDeck(input: unknown, hooks: DeckValidationHooks = {}): PreparedDeck {
  return markPreparedDeck(
    prepareDeckWith(input, hooks, hooks.validateBlock ?? validateDeckBlock, migrateDeck)
  );
}
