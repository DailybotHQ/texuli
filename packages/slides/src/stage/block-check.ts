/**
 * The stage's default free-slide block check (`validateDeckBlock`), in its
 * own module: it pulls the `@texuli/blocks` schema chain, so the stage
 * imports it on first use (`loadBuiltinDeckBlocks`) and only when no
 * renderer table brings its own `validateBlock` or `loadValidateBlock`.
 * `prepareDeck` (`./prepare.ts`) still uses it synchronously.
 */
import { safeParseBlock } from '@texuli/blocks/core';
import { createDiagnostic, type DeckDiagnostic, type PathSegment } from '@texuli/deck/schema';
import { isUnsizedImage, playerFamilyOf, withStandInSize } from '../registry/extended.ts';

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
