import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

/**
 * Package-level test config until the root `vitest.config.ts` (owner-held)
 * includes `apps/*\/tests`. Run: `pnpm --filter @texuli/agent exec vitest run`.
 * Node by default; the island test opts into happy-dom to render the
 * website's chat island against this service in-process.
 */
export default defineConfig({
  plugins: [svelte()],
  resolve: {
    conditions: ['browser'],
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
