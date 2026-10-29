import { type FormulaToken, REF_ERROR, tokenizeFormula } from './parse.ts';
import { type CellReference, formatReference } from './reference.ts';

/*
 * Reference rewriting on the token stream: a structural edit (rows or
 * columns inserted or deleted) or a sheet rename rewrites only the
 * reference tokens of a formula and keeps every other character the author
 * typed (spacing, case, `50%`). Linear in the formula.
 */

/** A reference as the rewriter sees it: one cell, or a range on one sheet. */
export type ReferenceTarget =
  | { readonly kind: 'cell'; readonly ref: CellReference }
  | { readonly kind: 'range'; readonly from: CellReference; readonly to: CellReference };

/**
 * What a visitor returns: a new target, `null` when the reference no
 * longer exists (it becomes `#REF!`), or `undefined` to keep it as written.
 */
export type ReferenceVisitor = (target: ReferenceTarget) => ReferenceTarget | null | undefined;

function write(target: ReferenceTarget): string {
  if (target.kind === 'cell') return formatReference(target.ref);
  return `${formatReference(target.from)}:${formatReference({ ...target.to, sheet: null })}`;
}

/**
 * Rewrite the references of a formula (text with its leading `=`). Returns
 * the new text, or `null` when the text does not tokenize (it is then left
 * as it was by the caller).
 */
export function rewriteFormula(source: string, visit: ReferenceVisitor): string | null {
  if (typeof source !== 'string' || !source.startsWith('=')) return null;
  let tokens: FormulaToken[];
  try {
    tokens = tokenizeFormula(source.slice(1), 1);
  } catch {
    return null;
  }
  let out = '';
  let cursor = 0;
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i] as FormulaToken;
    if ((token.kind !== 'ref' && token.kind !== 'col') || !token.ref) continue;
    const colon = tokens[i + 1];
    const end = tokens[i + 2];
    let target: ReferenceTarget;
    let stop: number;
    if (
      colon?.kind === 'op' &&
      colon.text === ':' &&
      end &&
      end.kind === token.kind &&
      end.ref &&
      (end.ref.sheet === null || end.ref.sheet === token.ref.sheet)
    ) {
      target = { kind: 'range', from: token.ref, to: { ...end.ref, sheet: token.ref.sheet } };
      stop = end.end;
      i += 2;
    } else if (token.kind === 'ref') {
      target = { kind: 'cell', ref: token.ref };
      stop = token.end;
    } else continue;
    const next = visit(target);
    if (next === undefined) continue;
    out += source.slice(cursor, token.start);
    out += next === null ? REF_ERROR : write(next);
    cursor = stop;
  }
  return out + source.slice(cursor);
}
