import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const APP_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_DIR = resolve(APP_DIR, '../..');
const PORT = 4876;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  // The app's own specs; the root config (the website server) never collects them.
  testDir: resolve(APP_DIR, 'tests/e2e'),
  testMatch: ['**/*.spec.ts'],
  outputDir: resolve(REPO_DIR, 'test-results/emojiparser-preview-4876'),
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm --filter @texuli/emojiparser preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    env: { ASTRO_PREVIEW_BACKGROUND: '1' },
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
