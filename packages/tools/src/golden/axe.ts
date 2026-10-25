import type { GoldenAxeRunner, GoldenAxeViolation } from './types.ts';

/**
 * The axe rules the golden set checks: WCAG 2.0 and 2.1 A and AA plus best
 * practice. `color-contrast` is off here because the paint has no theme CSS
 * (an offline DOM computes no colors); contrast is gated by the token AA
 * checks and the browser axe suites instead.
 */
export const GOLDEN_AXE_OPTIONS = Object.freeze({
  runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
  rules: { 'color-contrast': { enabled: false } },
});

/** The part of axe-core's API the runner needs. */
export interface AxeLike {
  run(
    context: Document | Element,
    options: object
  ): Promise<{
    violations: readonly {
      id: string;
      impact?: string | null;
      nodes: readonly { html?: string }[];
    }[];
  }>;
}

/** Wraps an axe-core instance (the caller supplies it) as a golden axe runner. */
export function createAxeRunner(axe: AxeLike): GoldenAxeRunner {
  return async (doc: Document): Promise<readonly GoldenAxeViolation[]> => {
    const result = await axe.run(doc, GOLDEN_AXE_OPTIONS);
    return result.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact ?? null,
      nodes: violation.nodes.length,
      sample: violation.nodes[0]?.html?.slice(0, 160),
    }));
  };
}
