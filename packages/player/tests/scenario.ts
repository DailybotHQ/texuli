import { cleanup } from '@testing-library/svelte';
import { vi } from 'vitest';

/**
 * One named scenario of a grouped test. A failure is prefixed with the
 * scenario name. Before the next scenario it resets what the player test
 * files reset after each test: the rendered DOM, mocks, fake timers and the
 * test-only style tags.
 */
export async function scenario(name: string, run: () => unknown): Promise<void> {
  try {
    await run();
  } catch (error) {
    if (error instanceof Error) error.message = `[${name}] ${error.message}`;
    throw error;
  } finally {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
    for (const style of document.head.querySelectorAll(
      'style[data-motion-test], style[data-skip-test]'
    )) {
      style.remove();
    }
    document.body.innerHTML = '';
  }
}
