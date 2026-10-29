import { cleanup } from '@testing-library/svelte';
import { afterAll, afterEach, vi } from 'vitest';

afterEach(() => cleanup());

// Painters, motion runtimes and default renderer tables load lazily; let every
// pending dynamic import settle before the test environment is torn down, so a
// late import never surfaces as an unhandled teardown error on a loaded host.
afterAll(() => vi.dynamicImportSettled());
