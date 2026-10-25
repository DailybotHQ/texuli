import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

// One root config for every unit and component test. Framework-free texels run
// in happy-dom too (it costs little and keeps one environment); a test file
// that must run in plain Node starts with `// @vitest-environment node`.
// Wall-clock budget tests (tests/perf) flake under the full parallel suite, so
// `pnpm test` skips them; `pnpm test:perf` (or naming tests/perf) runs them alone.
const perfRun =
  process.env.TEXULI_PERF === '1' || process.argv.some((arg) => arg.includes('tests/perf'));

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    conditions: ['browser'],
  },
  test: {
    environment: 'happy-dom',
    setupFiles: ['./tests/setup/vitest.setup.ts'],
    include: [
      'packages/*/tests/**/*.test.ts',
      'scripts/tests/**/*.test.ts',
      ...(perfRun ? ['tests/perf/**/*.test.ts'] : []),
    ],
    ...(perfRun ? { fileParallelism: false } : {}),
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});
