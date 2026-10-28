import { cleanup } from '@testing-library/svelte';

/** Drop the URL hash a stage wrote (`#/<slide>/<step>`), so the next stage starts clean. */
export function clearDeckHash(): void {
  if (typeof window === 'undefined' || !window.location.hash) return;
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
}

/**
 * One named scenario of a grouped test. A failure is prefixed with the
 * scenario name, and the rendered DOM and the URL hash (plus any extra reset
 * the file needs) are cleaned up before the next scenario, as an `afterEach`
 * would.
 */
export async function scenario(
  name: string,
  run: () => unknown,
  reset?: () => unknown
): Promise<void> {
  clearDeckHash();
  try {
    await run();
  } catch (error) {
    if (error instanceof Error) error.message = `[${name}] ${error.message}`;
    throw error;
  } finally {
    cleanup();
    clearDeckHash();
    await reset?.();
  }
}
