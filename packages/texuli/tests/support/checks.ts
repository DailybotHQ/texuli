import { expect } from 'vitest';

type Check = () => unknown;

/**
 * Runs a table of named checks as one test. Every check runs (with `after`
 * between them), and the test fails with the name and message of each one
 * that threw, so a collapsed table reports as precisely as separate tests.
 */
export async function expectChecks(
  checks: Record<string, Check>,
  after?: () => unknown
): Promise<void> {
  const failures: string[] = [];
  for (const [name, check] of Object.entries(checks)) {
    try {
      await check();
    } catch (error) {
      failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      await after?.();
    }
  }
  expect(failures).toEqual([]);
}
