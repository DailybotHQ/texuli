/**
 * The light half of `prepareDeck`: migrate and validate a deck with a block
 * check the caller supplies. The stage imports this module (never the
 * `@texuli/blocks` schema, never `migrateDeck`), so a host that brings its
 * own `validateBlock` keeps the default block check out of its initial
 * JavaScript, and a v2 deck never loads the migration code.
 */
import {
  type Deck,
  type DeckMigration,
  type DeckSource,
  type ParseDeckOptions,
  parseDeck,
} from '@texuli/deck/model';
import { createDiagnostic, type DeckDiagnostic } from '@texuli/deck/schema';

/**
 * The host hooks `parseDeck` runs in its second phase (the component registry
 * fills `knownComponents` and `validateComponent`). `validateBlock` replaces
 * the stage's free-slide block check (`validateDeckBlock`, the
 * `@texuli/blocks` schema): a host whose free-slide renderer paints its own
 * blocks validates them itself, or returns `undefined` to accept every
 * block. The built-in free-slide renderer still checks each block when it
 * paints one, so a block it cannot read shows as a placeholder, never as
 * raw data.
 */
export type DeckValidationHooks = Pick<
  ParseDeckOptions,
  'validateComponent' | 'knownComponents' | 'maxIssues' | 'validateBlock'
>;

export type PreparedDeck =
  | {
      ok: true;
      deck: Deck;
      from: DeckSource;
      /** Warnings only (migration notes, recovered fields). */
      issues: DeckDiagnostic[];
    }
  | {
      ok: false;
      from: DeckSource;
      /** At least one error. */
      issues: DeckDiagnostic[];
      truncated: boolean;
    };

/** One free-slide block check: the diagnostics of one block, if any. */
export type DeckBlockCheck = NonNullable<DeckValidationHooks['validateBlock']>;

/** `migrateDeck`, passed in so the stage can import it only for earlier deck shapes. */
export type DeckMigrate = (input: unknown) => DeckMigration;

/**
 * True for a v2 deck input (`formatVersion` present, the same test as
 * `detectDeckShape`): `migrateDeck` returns it unchanged, so it needs no
 * migration code. Never throws.
 */
export function isDeckV2Input(input: unknown): boolean {
  try {
    return (
      input !== null &&
      typeof input === 'object' &&
      !Array.isArray(input) &&
      Object.hasOwn(input, 'formatVersion')
    );
  } catch {
    return false;
  }
}

/**
 * Migrate and validate a deck input with an explicit free-slide block check
 * (`hooks.validateBlock` is ignored: the caller picks the check). A v2 input
 * skips `migrate` (exactly what `migrateDeck` does with it); any other input
 * needs it, and without it the deck is refused. Never throws: a hostile
 * getter or a failing host hook becomes a diagnostic.
 */
export function prepareDeckWith(
  input: unknown,
  hooks: DeckValidationHooks,
  validateBlock: DeckBlockCheck,
  migrate?: DeckMigrate
): PreparedDeck {
  let from: DeckSource = 'unknown';
  try {
    const v2 = isDeckV2Input(input);
    if (!v2 && !migrate) {
      return {
        ok: false,
        from,
        issues: [
          createDiagnostic('invalid-deck', 'The deck could not be migrated.', [], {
            fix: 'Reload the page: the stage could not load its deck migration.',
          }),
        ],
        truncated: false,
      };
    }
    const migration: DeckMigration =
      v2 || !migrate ? { deck: input, from: 'v2', issues: [] } : migrate(input);
    from = migration.from;
    const parsed = parseDeck(migration.deck, {
      ...hooks,
      validateBlock: (block, path) => validateBlock(block, path),
    });
    const notes = migration.issues.filter((issue) => issue.severity !== 'error');
    if (parsed.ok && parsed.deck) {
      return { ok: true, deck: parsed.deck, from, issues: [...notes, ...parsed.issues] };
    }
    const issues = [...migration.issues, ...parsed.issues];
    return {
      ok: false,
      from,
      issues: issues.some((issue) => issue.severity === 'error')
        ? issues
        : [createDiagnostic('invalid-deck', 'The deck is not valid.', []), ...issues],
      truncated: parsed.truncated,
    };
  } catch {
    return {
      ok: false,
      from,
      issues: [createDiagnostic('invalid-deck', 'The deck could not be read.', [])],
      truncated: false,
    };
  }
}
