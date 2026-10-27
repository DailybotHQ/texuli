import { defineConfig, devices } from '@playwright/test';

/**
 * Browser checks run against the fixture app (`tests/fixtures/app`), served by
 * Vite on TEXULI_E2E_PORT (default 4870). Lanes working in parallel each set
 * their own port (tmp/plan001/briefs/COMMON.md). Chromium and WebKit run on
 * desktop; Chromium also runs as a Pixel 7. Firefox is a known gap: Playwright's
 * Firefox does not launch on this macOS.
 *
 * Behavior specs: tests/behavior/README.md.
 */
const PORT = Number(process.env.TEXULI_E2E_PORT ?? 4870);
if (!Number.isInteger(PORT) || PORT < 1024 || PORT > 65535) {
  throw new Error('TEXULI_E2E_PORT must be a port number');
}

export default defineConfig({
  testDir: 'tests',
  // One output folder per port: concurrent runs (lanes, gates, visual sweeps)
  // never wipe each other's traces and screenshots.
  outputDir: `test-results/port-${PORT}`,
  testMatch: [
    'e2e/**/*.spec.ts',
    'behavior/**/*.spec.ts',
    'visual/**/*.spec.ts',
    'consumers/**/*.spec.ts',
  ],
  fullyParallel: true,
  // GitHub's ubuntu-latest runners have 4 vCPUs; Playwright defaults to half.
  workers: process.env.CI ? 4 : undefined,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
  },
  // The behavior suite runs on chromium and webkit only: its phone rows run
  // inside the chromium project in a Pixel 7 context (tests/behavior/README.md),
  // and its harness self test is chromium only. Other suites keep all three.
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testIgnore: 'behavior/harness/self.spec.ts',
    },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testIgnore: 'behavior/**' },
  ],
  webServer: {
    command: `pnpm --dir tests/fixtures/app exec vite --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
