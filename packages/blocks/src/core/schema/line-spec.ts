/**
 * Line specs for code highlights: `"1-2,4"` names lines 1, 2 and 4 (1-based).
 * Shared by the code block schema and the code renderer, so data that
 * validates always highlights the same lines.
 */

const LINE_SPEC = /^\d{1,4}(?:-\d{1,4})?(?:,\d{1,4}(?:-\d{1,4})?)*$/;

/** Parses `"1-2,4"` into `[[1, 2], [4, 4]]`, or `null` when malformed or reversed. */
export function parseLineSpec(spec: string): [number, number][] | null {
  if (!LINE_SPEC.test(spec)) return null;
  const ranges: [number, number][] = [];
  for (const part of spec.split(',')) {
    const [a, b = a] = part.split('-').map(Number) as [number, number?];
    if (a < 1 || (b as number) < a) return null;
    ranges.push([a, b as number]);
  }
  return ranges;
}
