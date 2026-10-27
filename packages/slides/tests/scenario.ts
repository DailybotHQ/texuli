import { cleanup } from '@testing-library/svelte';

/**
 * One named scenario of a grouped test. A failure is prefixed with the
 * scenario name, and the rendered DOM (plus any extra reset the file needs)
 * is cleaned up before the next scenario, as an `afterEach` would.
 */
export async function scenario(
  name: string,
  run: () => unknown,
  reset?: () => unknown
): Promise<void> {
  try {
    await run();
  } catch (error) {
    if (error instanceof Error) error.message = `[${name}] ${error.message}`;
    throw error;
  } finally {
    cleanup();
    await reset?.();
  }
}
