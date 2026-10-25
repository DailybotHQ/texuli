import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { createServer, type ViteDevServer } from 'vite';

const root = process.cwd();
const buttonCssFile = resolve(root, 'packages/texuli/src/components/button/button.css');
const buttonClientUrl = '/@id/texuli/button';
const props = { 'aria-label': 'SSR hydration probe', class: 'ssr-hydration-probe' };

let vite: ViteDevServer;
let serverMarkup: string;
let buttonCss: string;

test.beforeAll(async () => {
  vite = await createServer({
    configFile: false,
    root,
    plugins: [svelte()],
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
  });

  const [{ Button }, { render }] = await Promise.all([
    vite.ssrLoadModule('texuli/button'),
    vite.ssrLoadModule('svelte/server'),
  ]);
  serverMarkup = render(Button, { props }).body;
  buttonCss = await readFile(buttonCssFile, 'utf8');
});

test.afterAll(async () => {
  await vite?.close();
});

test('registered examples SSR and public Button hydrates without a shift', async ({ page }) => {
  test.setTimeout(120_000);
  if (test.info().project.name === 'chromium') {
    const [{ listExamples }, { render }] = await Promise.all([
      vite.ssrLoadModule('/packages/examples/src/index.ts'),
      vite.ssrLoadModule('svelte/server'),
    ]);
    const failures: string[] = [];
    for (const example of listExamples()) {
      try {
        const module = await example.load();
        render(module.default);
      } catch (error) {
        failures.push(`${example.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    expect(failures, 'all registered examples should render on the server').toEqual([]);
  }

  const pageDiagnostics: string[] = [];
  page.on('pageerror', (error) => pageDiagnostics.push(error.message));
  page.on('console', (message) => {
    if (message.type() !== 'error' && message.type() !== 'warning') return;
    const text = message.text();
    // Vite's injected HMR client is blocked by browser local-network checks in
    // some Playwright engines; these transport warnings are unrelated to SSR.
    if (
      text.startsWith('[vite] failed to connect to websocket.') ||
      text.startsWith('Failed to send error to Vite server:') ||
      (text.includes('WebSocket connection to') && text.includes('ws://'))
    ) {
      return;
    }
    pageDiagnostics.push(text);
  });

  await page.route('**/__ssr-hydration', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html>
        <html lang="en">
          <head><meta charset="utf-8"><style>${buttonCss}</style></head>
          <body><main id="ssr-root">${serverMarkup}</main></body>
        </html>`,
    })
  );
  await page.goto('/__ssr-hydration');

  const button = page.locator('#ssr-root button[data-tx-button]');
  await expect(button).toHaveAccessibleName(props['aria-label']);
  const before = await button.boundingBox();
  if (!before) throw new Error('server-rendered Button has no box');

  const hydration = await page.evaluate(
    async ({ clientUrl, buttonProps }) => {
      const target = document.querySelector<HTMLElement>('#ssr-root');
      if (!target) throw new Error('missing SSR root');

      const originalButton = target.querySelector('button[data-tx-button]');
      if (!originalButton) throw new Error('missing server-rendered Button');

      const { hydrate } = await import('/node_modules/.vite/deps/svelte.js');
      const { Button } = await import(clientUrl);
      hydrate(Button, { target, props: buttonProps });

      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const hydratedButton = target.querySelector('button[data-tx-button]');
      if (!hydratedButton) throw new Error('missing hydrated Button');

      const { x, y, width, height } = hydratedButton.getBoundingClientRect();
      return {
        sameNode: originalButton === hydratedButton,
        accessibleName: hydratedButton.getAttribute('aria-label'),
        box: { x, y, width, height },
      };
    },
    { clientUrl: buttonClientUrl, buttonProps: props }
  );

  expect(hydration.sameNode).toBe(true);
  expect(hydration.accessibleName).toBe(props['aria-label']);
  expect(Math.abs(hydration.box.x - before.x)).toBeLessThan(0.5);
  expect(Math.abs(hydration.box.y - before.y)).toBeLessThan(0.5);
  expect(Math.abs(hydration.box.width - before.width)).toBeLessThan(0.5);
  expect(Math.abs(hydration.box.height - before.height)).toBeLessThan(0.5);
  expect(pageDiagnostics).toEqual([]);
});
