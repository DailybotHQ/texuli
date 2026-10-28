/**
 * Turn whatever a host hands the stage into a validated v2 deck, or a list of
 * diagnostics. Every input goes through `migrateDeck` (a v2 deck passes
 * unchanged; a Texuli v1 deck, a grammar tree or a Protoyard deck is
 * converted) and then `parseDeck`, with `@texuli/blocks` checking each
 * free-slide block body. The stage paints only an `ok` result: an invalid
 * deck is never rendered.
 */

import { safeParseBlock } from '@texuli/blocks/core';
import {
  type Deck,
  type DeckSource,
  migrateDeck,
  type ParseDeckOptions,
  parseDeck,
} from '@texuli/deck/model';
import { createDiagnostic, type DeckDiagnostic, type PathSegment } from '@texuli/deck/schema';
import { isUnsizedImage, playerFamilyOf, withStandInSize } from '../registry/extended.ts';

/** The host hooks `parseDeck` runs in its second phase (the component registry fills these). */
export type DeckValidationHooks = Pick<
  ParseDeckOptions,
  'validateComponent' | 'knownComponents' | 'maxIssues'
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

const MATH_KEYS = new Set(['type', 'id', 'tex', 'display']);
const MATH_SOURCE_LIMIT = 2000;

function blockIssue(message: string, path: PathSegment[]): DeckDiagnostic {
  return createDiagnostic('block-props', message, path, {
    fix: 'Check the block against the @texuli/blocks schema for its type.',
  });
}

/**
 * Check one free-slide block body (step fields already removed), kept light
 * for the stage entry: the blocks schema for the core families, a shape check
 * for `$$` math (its TeX is checked when it paints), stand-in sizes for images
 * measured at paint, and nothing here for the diagram, map and embed families,
 * which the player validates at the stage tier before it paints them.
 */
export function validateDeckBlock(block: unknown, path: PathSegment[]): DeckDiagnostic[] {
  if (block !== null && typeof block === 'object' && !Array.isArray(block)) {
    const bag = block as Record<string, unknown>;
    if (bag.type === 'math') {
      const extra = Object.keys(bag).find((key) => !MATH_KEYS.has(key));
      if (extra !== undefined)
        return [blockIssue(`A math block has no "${extra.slice(0, 40)}".`, [...path, extra])];
      if (typeof bag.tex !== 'string' || bag.tex.trim() === '') {
        return [blockIssue('A math block needs its TeX source in `tex`.', [...path, 'tex'])];
      }
      if (bag.tex.length > MATH_SOURCE_LIMIT) {
        return [
          blockIssue(`A formula is at most ${MATH_SOURCE_LIMIT} characters.`, [...path, 'tex']),
        ];
      }
      return [];
    }
    if (playerFamilyOf(bag.type)) return [];
  }
  const body = isUnsizedImage(block) ? withStandInSize(block as Record<string, unknown>) : block;
  const parsed = safeParseBlock(body);
  if (parsed.success) return [];
  return parsed.issues
    .slice(0, 20)
    .map((issue) => blockIssue(issue.message, [...path, ...issue.path]));
}

/**
 * Migrate and validate a deck input. Never throws: a hostile getter or a
 * failing host hook becomes a diagnostic.
 */
export function prepareDeck(input: unknown, hooks: DeckValidationHooks = {}): PreparedDeck {
  let from: DeckSource = 'unknown';
  try {
    const migration = migrateDeck(input);
    from = migration.from;
    const parsed = parseDeck(migration.deck, {
      ...hooks,
      validateBlock: (block, path) => validateDeckBlock(block, path),
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
