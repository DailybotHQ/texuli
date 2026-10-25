import type { FormulaInputs } from '@texuli/blocks/formula';
import type { StateSnapshot } from './state/schema.ts';

/**
 * The numeric inputs a blueprint's `when` conditions read (audit G07), from
 * the player's local state (G01). Conditions compare numbers only, so a
 * `number` variable passes as is and a `boolean` becomes `1` or `0`. `enum`
 * and `string` variables are left out: a condition that reads one is
 * unknown, and an unknown condition hides its node (fail closed).
 */
export function stateConditionInputs(values: StateSnapshot): FormulaInputs {
  const inputs: Record<string, number> = {};
  for (const [name, value] of Object.entries(values)) {
    if (typeof value === 'boolean') inputs[name] = value ? 1 : 0;
    else if (typeof value === 'number' && Number.isFinite(value)) inputs[name] = value;
  }
  return Object.freeze(inputs);
}

/** Whether two input sets hold the same numbers (so an update can be skipped). */
export function sameConditionInputs(a: FormulaInputs, b: FormulaInputs): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => Object.hasOwn(b, key) && a[key] === b[key]);
}
