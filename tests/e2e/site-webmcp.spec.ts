/// <reference types="node" />
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { onRequest as middleware } from '../../functions/_middleware.ts';
import { onRequest as mcp } from '../../functions/mcp.ts';
import { DIST } from './support/site.ts';

/*
 * The WebMCP bridge on the built site (`pnpm build` first; PLAN_011
 * T-ar-site-mcp). A local static server cannot run Pages Functions, so this
 * spec serves `dist` through the real middleware, routes `/mcp` to the real
 * Function with an `env.ASSETS` that reads `dist`, and applies each page's
 * exact-path `_headers` rules: the page runs under its enforcing CSP and
 * Trusted Types policy. A stub `navigator.modelContext` is installed before
 * any page script runs (as a WebMCP scanner's browser does) and records what
 * registers and when. Cloudflare's runtime is checked only after a deploy.
 */

const SITE = 'https://texuli.com';
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
};
const TOOL_NAMES = [
  'texuli_search_docs',
  'texuli_read_page',
  'texuli_get_component',
  'texuli_validate_blueprint',
];

/** `_headers` → exact path → header lines. */
function headerRules(): Map<string, [string, string][]> {
  const rules = new Map<string, [string, string][]>();
  let path: string | undefined;
  for (const line of readFileSync(join(DIST, '_headers'), 'utf8').split('\n')) {
    if (!line.trim()) path = undefined;
    else if (!line.startsWith(' ')) {
      path = line.trim();
      rules.set(path, []);
    } else if (path) {
      const colon = line.indexOf(':');
      rules.get(path)?.push([line.slice(0, colon).trim(), line.slice(colon + 1).trim()]);
    }
  }
  return rules;
}

let rules = new Map<string, [string, string][]>();

/** The static host: a built file with its rule's headers, or 404.html. */
function asset(request: Request): Response {
  const path = decodeURIComponent(new URL(request.url).pathname);
  let file = normalize(join(DIST, path));
  if (!file.startsWith(DIST)) file = join(DIST, '__outside__');
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file))
    return new Response(readFileSync(join(DIST, '404.html')), {
      status: 404,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  const headers = new Headers({
    'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
  });
  for (const [name, value] of rules.get(path) ?? []) headers.set(name, value);
  return new Response(readFileSync(file), { status: 200, headers });
}

const ASSETS = { fetch: async (request: Request) => asset(request) };
let server: Server | undefined;
let origin = '';
/** Every path the browser asked for, in order. */
const served: string[] = [];

test.beforeAll(async () => {
  if (!existsSync(join(DIST, 'md-manifest.json')))
    throw new Error('Run `pnpm build` before this spec.');
  rules = headerRules();
  server = createServer(async (incoming, outgoing) => {
    const headers = new Headers();
    for (const [name, value] of Object.entries(incoming.headers))
      if (typeof value === 'string') headers.set(name, value);
    const chunks: Buffer[] = [];
    for await (const chunk of incoming) chunks.push(chunk as Buffer);
    const method = incoming.method ?? 'GET';
    const request = new Request(`${SITE}${incoming.url ?? '/'}`, {
      method,
      headers,
      ...(method === 'GET' || method === 'HEAD' ? {} : { body: Buffer.concat(chunks) }),
    });
    const path = new URL(request.url).pathname;
    served.push(path);
    const response =
      path === '/mcp'
        ? await mcp({ request, env: { ASSETS } })
        : await middleware({ request, next: async () => asset(request), env: { ASSETS } });
    const out: Record<string, string> = {};
    response.headers.forEach((value, name) => {
      out[name] = value;
    });
    outgoing.writeHead(response.status, out);
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  });
  await new Promise<void>((done) => server?.listen(0, '127.0.0.1', done));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test.afterAll(
  () =>
    new Promise<void>((done) => {
      if (!server) return done();
      server.close(() => done());
    })
);

/**
 * Install a recording `modelContext` before any page script runs.
 * `mode` picks the API the stub offers; `none` installs nothing.
 */
async function stubModelContext(page: Page, mode: 'provideContext' | 'registerTool' | 'none') {
  await page.addInitScript((api) => {
    type Tool = { name: string; inputSchema: unknown; execute: (args: unknown) => unknown };
    const state = {
      api: [] as string[],
      tools: [] as Tool[],
      atDomContentLoaded: -1,
      atLoad: -1,
      loadAt: -1,
      registeredAt: -1,
      violations: [] as string[],
    };
    const registered = () => {
      if (state.registeredAt < 0) state.registeredAt = performance.now();
    };
    (window as unknown as { __webmcp: typeof state }).__webmcp = state;
    // The directives the bridge could trip: scripts, requests and Trusted Types.
    // (Pages with live demos report inline styles of their own, bridge or not.)
    document.addEventListener('securitypolicyviolation', (event) => {
      if (
        /^(?:script-src|connect-src|require-trusted-types-for|trusted-types)/u.test(
          event.violatedDirective
        )
      )
        state.violations.push(
          `${event.disposition} ${event.violatedDirective} ${event.blockedURI}`
        );
    });
    document.addEventListener('DOMContentLoaded', () => {
      state.atDomContentLoaded = state.tools.length;
    });
    window.addEventListener('load', () => {
      state.atLoad = state.tools.length;
      state.loadAt = performance.now();
    });
    if (api === 'none') return;
    const context =
      api === 'provideContext'
        ? {
            provideContext(value: { tools: Tool[] }) {
              state.api.push('provideContext');
              state.tools = [...value.tools];
              registered();
            },
          }
        : {
            registerTool(tool: Tool) {
              state.api.push('registerTool');
              state.tools.push(tool);
              registered();
            },
          };
    Object.defineProperty(Navigator.prototype, 'modelContext', {
      configurable: true,
      get: () => context,
    });
  }, mode);
}

type Snapshot = {
  api: string[];
  loadAt: number;
  registeredAt: number;
  names: string[];
  schemas: Record<string, { type?: string; required?: string[]; properties?: object }>;
  atLoad: number;
  violations: string[];
};

async function snapshot(page: Page): Promise<Snapshot> {
  return page.evaluate(() => {
    const state = (
      window as unknown as {
        __webmcp: {
          api: string[];
          tools: { name: string; inputSchema: object }[];
          atLoad: number;
          loadAt: number;
          registeredAt: number;
          violations: string[];
        };
      }
    ).__webmcp;
    return {
      api: state.api,
      loadAt: state.loadAt,
      registeredAt: state.registeredAt,
      names: state.tools.map((tool) => tool.name),
      schemas: Object.fromEntries(state.tools.map((tool) => [tool.name, tool.inputSchema])),
      atLoad: state.atLoad,
      violations: state.violations,
    };
  });
}

/** Run one registered tool in the page and return its MCP-shaped result. */
function callTool(page: Page, name: string, args: unknown) {
  return page.evaluate(
    async ([tool, input]) => {
      const state = (
        window as unknown as {
          __webmcp: {
            tools: {
              name: string;
              execute: (
                args: unknown
              ) => Promise<{ content: { text: string }[]; isError?: boolean }>;
            }[];
          };
        }
      ).__webmcp;
      const found = state.tools.find((item) => item.name === tool);
      if (!found) throw new Error(`no tool ${tool}`);
      return found.execute(input);
    },
    [name, args] as const
  );
}

test('registers the four tools with their schemas during page load, under the strict CSP', async ({
  page,
}) => {
  await stubModelContext(page, 'provideContext');
  await page.goto(`${origin}/`);
  await expect.poll(async () => (await snapshot(page)).names.length).toBe(4);
  const state = await snapshot(page);
  // The layout's loader starts the tools chunk as its module runs (before
  // DOMContentLoaded) when modelContext exists; the tools register when that
  // one same-origin chunk arrives, at the load event or within moments of it
  // on a local server whose load fires at once. A scanner that loads the page
  // and then reads the registrations sees all four.
  expect(state.registeredAt).toBeGreaterThan(0);
  expect(state.loadAt).toBeGreaterThan(0);
  expect(state.registeredAt - state.loadAt).toBeLessThan(1000);
  test.info().annotations.push({
    type: 'timing',
    description: `registered ${Math.round(state.registeredAt)} ms after navigation start, load at ${Math.round(state.loadAt)} ms`,
  });
  expect(state.api).toEqual(['provideContext']);
  expect(state.names).toEqual(TOOL_NAMES);
  expect(state.schemas.texuli_search_docs).toMatchObject({ type: 'object', required: ['query'] });
  expect(state.schemas.texuli_read_page).toMatchObject({ type: 'object', required: ['path'] });
  expect(state.schemas.texuli_get_component).toMatchObject({ type: 'object', required: ['id'] });
  expect(state.schemas.texuli_validate_blueprint).toMatchObject({
    type: 'object',
    required: ['draft'],
  });
  expect(state.violations).toEqual([]);
  // The page itself is under the enforcing policy with Trusted Types.
  const csp = (await page.request.get(`${origin}/`)).headers()['content-security-policy'] ?? '';
  expect(csp).toContain("require-trusted-types-for 'script'");
  expect(csp).toContain("connect-src 'self'");
});

test('every tool answers against the served build through same-origin requests only', async ({
  page,
}) => {
  const outbound: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(origin)) outbound.push(request.url());
  });
  await stubModelContext(page, 'provideContext');
  await page.goto(`${origin}/guides/theming/`);
  await expect.poll(async () => (await snapshot(page)).names.length).toBe(4);

  const search = await callTool(page, 'texuli_search_docs', { query: 'theming', limit: 3 });
  expect(search.isError).toBeUndefined();
  const hits = JSON.parse(search.content[0]?.text ?? '{}');
  expect(hits.results.length).toBeGreaterThan(0);
  expect(hits.results.map((hit: { path: string }) => hit.path)).toContain('/guides/theming/');

  const read = await callTool(page, 'texuli_read_page', { path: '/guides/theming/' });
  expect(read.isError).toBeUndefined();
  expect(read.content[0]?.text).toMatch(/^# Theming\n/u);
  expect(read.content[0]?.text).toContain('## CSS layers');

  const component = await callTool(page, 'texuli_get_component', { id: 'card' });
  expect(component.isError).toBeUndefined();
  expect(component.content[0]?.text.length).toBeGreaterThan(100);

  const valid = await callTool(page, 'texuli_validate_blueprint', {
    draft: { id: 'card', props: { title: 'Fictional' } },
    fragment: true,
  });
  const validation = JSON.parse(valid.content[0]?.text ?? '{}');
  expect(validation).toMatchObject({ tier: 'untrusted' });
  expect(typeof validation.valid).toBe('boolean');
  expect(Array.isArray(validation.diagnostics)).toBe(true);

  // Refusals are tool errors, and a hostile path never becomes a request.
  const before = served.length;
  const traversal = await callTool(page, 'texuli_read_page', { path: '/../_headers' });
  expect(traversal.isError).toBe(true);
  const elsewhere = await callTool(page, 'texuli_read_page', { path: '//evil.example/x' });
  expect(elsewhere.isError).toBe(true);
  const badId = await callTool(page, 'texuli_get_component', { id: '../secrets' });
  expect(badId.isError).toBe(true);
  expect(served.slice(before)).toEqual([]);
  const missing = await callTool(page, 'texuli_get_component', { id: 'no-such-component' });
  expect(missing.isError).toBe(true);

  expect(outbound).toEqual([]);
  expect((await snapshot(page)).violations).toEqual([]);
});

test('falls back to registerTool, once per tool', async ({ page }) => {
  await stubModelContext(page, 'registerTool');
  await page.goto(`${origin}/component-pages/card/`);
  await expect.poll(async () => (await snapshot(page)).names.length).toBe(4);
  expect((await snapshot(page)).registeredAt).toBeGreaterThan(0);
  const state = await snapshot(page);
  expect(state.api).toEqual(['registerTool', 'registerTool', 'registerTool', 'registerTool']);
  expect(state.names).toEqual(TOOL_NAMES);
  expect(state.violations).toEqual([]);
});

test('without modelContext the bridge is a no-op and its tools chunk is never fetched', async ({
  page,
}) => {
  const scripts: string[] = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'script') scripts.push(new URL(request.url()).pathname);
  });
  await stubModelContext(page, 'none');
  await page.goto(`${origin}/`);
  await page.waitForTimeout(500);
  const state = await snapshot(page);
  expect(state.atLoad).toBe(0);
  expect(state.violations).toEqual([]);
  expect(scripts.some((path) => /webmcp\./u.test(path))).toBe(false);
  expect(await page.evaluate(() => 'modelContext' in navigator)).toBe(false);
});
