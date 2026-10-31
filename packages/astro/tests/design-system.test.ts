// @vitest-environment node
/**
 * The Astro design-system option (ADR-023, T-ds-runtime): `texuli({
 * designSystem })` inlines `designSystemStyle` in every page's head through a
 * generated middleware, and its CSP hash is the SHA-256 of the exact style
 * body, computed the way the website's CSP build hashes inline styles.
 */
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { designSystemStyle } from '@texuli/tokens/design-system/apply';
import { compileDesignSystem, resolveDesignSystem } from '@texuli/tokens/design-system/compile';
import { describe, expect, it } from 'vitest';
import {
  designSystemInlineStyle,
  designSystemMiddlewareSource,
  injectDesignSystemStyle,
} from '../src/design-system/index.ts';
import { texuli } from '../src/integration/index.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const acmeDoc = JSON.parse(
  readFileSync(join(root, 'packages/spec/fixtures/design-systems/acme.json'), 'utf8')
);
const resolved = await resolveDesignSystem(acmeDoc, { trust: 'developer' });
if (!resolved.ok) throw new Error(JSON.stringify(resolved.errors));
const acme = compileDesignSystem(resolved.document, {
  trust: 'developer',
  modes: ['light', 'dark'],
});
if (!acme.ok) throw new Error(JSON.stringify(acme.errors));

/** The website's CSP rule (apps/website/src/components/security/csp.ts): hash the exact body. */
const websiteHash = (body: string) =>
  `sha256-${createHash('sha256').update(body).digest('base64')}`;
const INLINE_STYLE = /<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi;
const page =
  '<!doctype html><html><head><title>x</title></head><body><main data-tx-ds="acme"></main></body></html>';

describe('designSystemInlineStyle and injectDesignSystemStyle', () => {
  it('inline the same CSS as designSystemStyle with its CSP hash, once, before </head>', async () => {
    for (const options of [{}, { selector: ':root', modes: ['light'] as const }]) {
      const { css, hash } = await designSystemInlineStyle({ compiled: acme, ...options });
      const expected = designSystemStyle(acme, {
        ...options,
        modes: options.modes ? [...options.modes] : undefined,
      });
      expect(css).toBe(expected);
      const html = injectDesignSystemStyle(page, css);
      const bodies = [...html.matchAll(INLINE_STYLE)].map((match) => match[1]);
      expect(bodies).toEqual([css]);
      expect(html.indexOf('<style')).toBeLessThan(html.indexOf('</head>'));
      expect(hash).toBe(websiteHash(bodies[0] as string));
      // Idempotent, and a page without a head is left alone.
      expect(injectDesignSystemStyle(html, css)).toBe(html);
      expect(injectDesignSystemStyle('<p>fragment</p>', css)).toBe('<p>fragment</p>');
    }
    expect(() => injectDesignSystemStyle(page, 'a{}</style><script>x()</script>')).toThrow(
      TypeError
    );
    await expect(
      designSystemInlineStyle({ compiled: acme, selector: '</style><script>' })
    ).rejects.toThrow(TypeError);
  });
});

describe('texuli({ designSystem })', () => {
  it('writes a middleware that inlines the style in HTML responses, and adds the hash to Astro CSP', async () => {
    const dir = pathToFileURL(`${mkdtempSync(join(tmpdir(), 'texuli-astro-ds-'))}/`);
    const middlewares: { order: string; entrypoint: string | URL }[] = [];
    const updates: unknown[] = [];
    const hook = texuli({ designSystem: { compiled: acme } }).hooks['astro:config:setup'];
    await hook?.({
      injectScript: () => undefined,
      addMiddleware: (entry: { order: string; entrypoint: string | URL }) =>
        middlewares.push(entry),
      createCodegenDir: () => dir,
      updateConfig: (update: unknown) => updates.push(update),
      config: { security: { csp: true } },
    } as never);
    expect(middlewares).toHaveLength(1);
    expect(middlewares[0]?.order).toBe('pre');
    const { css, hash } = await designSystemInlineStyle({ compiled: acme });
    expect(updates).toEqual([
      { security: { csp: { algorithm: 'SHA-256', styleDirective: { hashes: [hash] } } } },
    ]);
    const entry = middlewares[0]?.entrypoint as URL;
    expect(readFileSync(entry, 'utf8')).toBe(designSystemMiddlewareSource(css));

    const module = (await import(entry.href)) as {
      onRequest: (context: unknown, next: () => Promise<Response>) => Promise<Response>;
    };
    const html = await module.onRequest(
      {},
      async () =>
        new Response(page, {
          status: 201,
          headers: {
            'content-type': 'text/html; charset=utf-8',
            'content-length': '1',
            'x-a': 'b',
          },
        })
    );
    expect(html.status).toBe(201);
    expect(html.headers.get('x-a')).toBe('b');
    expect(html.headers.get('content-length')).toBeNull();
    expect(await html.text()).toBe(injectDesignSystemStyle(page, css));
    const json = await module.onRequest({}, async () =>
      Response.json({ page }, { headers: { 'content-type': 'application/json' } })
    );
    expect(await json.json()).toEqual({ page });

    // Without the option nothing is written; without Astro CSP no hash is added.
    const plain: unknown[] = [];
    await texuli().hooks['astro:config:setup']?.({
      injectScript: () => undefined,
      addMiddleware: (entry: unknown) => plain.push(entry),
      createCodegenDir: () => dir,
      updateConfig: (update: unknown) => plain.push(update),
      config: {},
    } as never);
    const noCsp: unknown[] = [];
    await texuli({ designSystem: { compiled: acme } }).hooks['astro:config:setup']?.({
      injectScript: () => undefined,
      addMiddleware: () => undefined,
      createCodegenDir: () => dir,
      updateConfig: (update: unknown) => noCsp.push(update),
      config: {},
    } as never);
    expect(plain).toEqual([]);
    expect(noCsp).toEqual([]);
    expect(() => texuli({ designSystem: {} as never })).toThrow(TypeError);
  });
});
