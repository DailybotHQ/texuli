/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { MCP_SERVER_DATA } from '../../apps/website/src/components/mcp-server/mcp-server-data.ts';
import {
  axeViolations,
  DIST,
  expectMode,
  polishProblems,
  serveDist,
  settle,
} from './support/site.ts';

/*
 * texuli.com /mcp-server/ (PLAN_011 T-site-090) on the built site (`pnpm
 * build` first): the page renders the registry's generated data (tool,
 * resource, template and prompt counts equal `mcp-server-data.ts` and the
 * built server card), offers both doors for every host, is axe-clean in
 * light and dark, every link resolves, ships no script of its own, and its
 * Markdown twin carries every tool. The page model is unit-tested in
 * apps/website/tests/site-mcp-tokens.test.ts.
 */

const origin = serveDist();
const ROUTE = '/mcp-server/';

/** Every link in main resolves: anchors to an id, site paths to 200, outside links to the repo or npm. */
async function expectLinksResolve(page: Page, minimum: number): Promise<void> {
  const hrefs = await page
    .locator('main a[href]')
    .evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute('href') ?? ''))]);
  expect(hrefs.length).toBeGreaterThanOrEqual(minimum);
  for (const href of hrefs) {
    if (href.startsWith('#')) {
      await expect(page.locator(`[id="${href.slice(1)}"]`), href).toHaveCount(1);
      continue;
    }
    if (/^https?:/.test(href)) {
      expect(href, href).toMatch(
        /^https:\/\/(github\.com\/DailybotHQ\/texuli\/|www\.npmjs\.com\/)/
      );
      continue;
    }
    expect(href, href).toMatch(/^\/(?!\/)/);
    const response = await page.request.get(`${origin()}${href.replace(/#.*$/, '')}`);
    expect(response.status(), href).toBe(200);
  }
}

test('the tables match the registry and the server card', async ({ page }) => {
  const scripts: string[] = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'script') scripts.push(new URL(request.url()).pathname);
  });
  await page.goto(`${origin()}${ROUTE}`);
  await settle(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Texuli MCP');
  await expect(page.locator('[data-mcp-remote]')).toHaveText(MCP_SERVER_DATA.remote.url);
  await expect(page.locator('[data-mcp-local]')).toHaveText(MCP_SERVER_DATA.local.launch);
  await expect(page.locator('[data-mcp-version]')).toHaveText(MCP_SERVER_DATA.version);
  // Released with 0.9.0: the in-development status line is gone.
  await expect(page.locator('[data-mcp-status]')).toHaveCount(0);

  // Tools: the count equals the registry, and each runtime group its own share.
  const tools = MCP_SERVER_DATA.tools;
  await expect(page.locator('[data-mcp-tools] tbody tr')).toHaveCount(tools.length);
  await expect(page.locator('[data-mcp-tools-total]')).toHaveText(String(tools.length));
  for (const runtime of ['edge', 'node', 'site'])
    await expect(page.locator(`[data-mcp-tools="${runtime}"] tbody tr`), runtime).toHaveCount(
      tools.filter((tool) => tool.runtime === runtime).length
    );
  for (const tool of tools)
    await expect(
      page.locator(`[data-mcp-tools="${tool.runtime}"] [data-mcp-tool="${tool.name}"]`),
      tool.name
    ).toContainText(
      tool.remote && tool.local ? 'Remote and local' : tool.remote ? 'Remote only' : 'Local only'
    );

  // The built server card lists the same tools.
  const card = JSON.parse(
    readFileSync(join(DIST, '.well-known', 'mcp', 'server-card.json'), 'utf8')
  ) as { tools: { name: string }[] };
  expect(card.tools.map((tool) => tool.name).sort()).toEqual(tools.map((tool) => tool.name).sort());

  await expect(page.locator('[data-mcp-resources] tbody tr')).toHaveCount(
    MCP_SERVER_DATA.resources.length + MCP_SERVER_DATA.resourceTemplates.length
  );
  await expect(page.locator('[data-mcp-prompts] tbody tr')).toHaveCount(
    MCP_SERVER_DATA.prompts.length
  );
  await expect(page.locator('[data-mcp-deprecated] tbody tr')).toHaveCount(
    MCP_SERVER_DATA.deprecatedTools.length
  );

  // Setup for every host, both doors each.
  for (const host of ['claude-code', 'cursor', 'vscode', 'windsurf', 'codex', 'generic']) {
    const section = page.locator(`[data-mcp-host="${host}"]`);
    await expect(section.locator('pre'), host).toHaveCount(2);
    await expect(section.locator('pre').nth(0), host).toContainText('@texuli/mcp');
    await expect(section.locator('pre').nth(1), host).toContainText(MCP_SERVER_DATA.remote.url);
  }
  await expect(page.locator('[data-mcp-curl]')).toContainText('"method":"tools/list"');
  await expect(page.locator('[data-mcp-webmcp] tbody tr').first()).toBeVisible();

  // Static: the page loads only the shared shell scripts, no island.
  await expect(page.locator('main astro-island')).toHaveCount(0);
  expect(scripts.every((path) => !path.includes('mcp-server'))).toBe(true);

  // The Markdown twin carries every tool.
  const twin = readFileSync(join(DIST, 'mcp-server.md'), 'utf8');
  for (const tool of tools) expect(twin, tool.name).toContain(`\`${tool.name}\``);
});

test('axe-clean in light and dark; every link resolves', async ({ page }) => {
  for (const mode of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: mode, reducedMotion: 'reduce' });
    await page.goto(`${origin()}${ROUTE}`);
    await settle(page);
    await expectMode(page, mode);
    expect(await axeViolations(page), mode).toEqual([]);
    expect(await polishProblems(page), mode).toEqual([]);
  }
  await expectLinksResolve(page, 8);
});
