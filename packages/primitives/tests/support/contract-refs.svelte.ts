/**
 * A reactive ref record for contract harnesses (`bind:ref={refs[key]}`),
 * every key starting at `null` (a bound `ref` has a `null` fallback).
 */
export function createContractRefs(keys: readonly string[]): Record<string, Element | null> {
  const refs: Record<string, Element | null> = $state(
    Object.fromEntries(keys.map((key) => [key, null]))
  );
  return refs;
}
