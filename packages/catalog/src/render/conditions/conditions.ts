/**
 * `@texuli/catalog/render/conditions` — the condition runtime for `when`
 * (audit G07): the closed `Condition` AST of `@texuli/blocks/formula`,
 * injected into the renderer (and `validateDraft`, the player and frames) as
 * `conditions`. Kept out of the renderer core so the renderer, validate and
 * player entries do not bundle the formula parser; without it, every `when`
 * fails closed.
 */
import { evaluateCondition, type FormulaInputs, parseFormula } from '@texuli/blocks/formula';
import type { RenderConditions, WhenParse } from '../renderer/types.ts';

/**
 * Validate an untrusted `when` value. The blocks parser validates number
 * formulas, so the condition is parsed as the test of an `if` node, under the
 * same size and depth limits. Never throws and never evaluates anything.
 */
export function parseWhen(value: unknown): WhenParse {
  const parsed = parseFormula({
    op: 'if',
    test: value,
    ifTrue: { op: 'num', value: 1 },
    ifFalse: { op: 'num', value: 0 },
  });
  if (parsed.success && parsed.formula.op === 'if') {
    return { ok: true, condition: parsed.formula.test };
  }
  const first = parsed.diagnostics[0];
  const where = first?.path[0] === 'test' ? first.path.slice(1) : (first?.path ?? []);
  const at = where.length > 0 ? ` at ${where.join('.')}` : '';
  return {
    ok: false,
    message: `"when" is not a valid condition${at}: ${first?.message ?? 'unreadable'}.`,
  };
}

/** The blocks formula conditions, ready for `RenderOptions.conditions`. */
export const formulaConditions: RenderConditions = Object.freeze({
  parse: parseWhen,
  evaluate: (condition: unknown, inputs: FormulaInputs) =>
    // `condition` is only ever a value `parseWhen` accepted.
    evaluateCondition(condition as Parameters<typeof evaluateCondition>[0], inputs),
});
