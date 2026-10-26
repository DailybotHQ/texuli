/**
 * Umami loader units (T-34): the UA skip list, the shipped loader's
 * behavior (inject, skip, no-tag no-op), the skip-list duplication guard
 * between the source of truth and the unbundled public file, and the
 * component's off-by-default gate. The built-site proof (no env → zero
 * analytics requests) is tests/e2e/analytics.spec.ts (T-39).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ANALYTICS_SKIP_UA, shouldSkipAnalytics } from '../src/lib/umami-skip.ts';

const LOADER_SRC = resolve('apps/website/public/umami-loader.js');
const LOADER_URL = new URL(`file://${LOADER_SRC}`).href;

/** Stub the UA, plant (or omit) the mount tag, run the loader once. */
async function runLoader(
  attrs: Record<string, string> | null,
  userAgent: string
): Promise<HTMLScriptElement[]> {
  vi.stubGlobal('navigator', { userAgent });
  document.head.innerHTML = '';
  if (attrs) {
    const tag = document.createElement('script');
    for (const [key, value] of Object.entries(attrs)) tag.setAttribute(key, value);
    document.head.appendChild(tag);
  }
  const appended: HTMLScriptElement[] = [];
  const spy = vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
    appended.push(node as HTMLScriptElement);
    return node;
  });
  vi.resetModules();
  await import(LOADER_URL);
  spy.mockRestore();
  return appended;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('shouldSkipAnalytics (the UA skip list)', () => {
  it.each([
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Chrome-Lighthouse',
    'Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/131.0.0.0 Chrome-Lighthouse',
    'Mozilla/5.0 (compatible; Chrome/131.0.0.0; PageSpeed/1.0)',
    'GTmetrix/2.0 (https://gtmetrix.com)',
    'Pingdom.com_bot_version_1.4_(https://www.pingdom.com/)',
    'WebPageTest/1.0 (+https://www.webpagetest.org)',
  ])('skips the auditing client %j', (userAgent) => {
    expect(shouldSkipAnalytics(userAgent)).toBe(true);
  });

  it.each([
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
    // Headless visitors are real visitors (and the site's own verification
    // runs must see the loader fire): only auditing tools are skipped.
    'Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/131.0.0.0 Safari/537.36',
    // Bots that read the site are not auditing tools; the edge decides
    // separately what to count (T-37).
    'Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
  ])('serves the real client %j', (userAgent) => {
    expect(shouldSkipAnalytics(userAgent)).toBe(false);
  });

  it.each([undefined, null, ''])('treats a missing user agent as a real client', (userAgent) => {
    expect(shouldSkipAnalytics(userAgent)).toBe(false);
  });

  it('matches markers case-insensitively', () => {
    expect(shouldSkipAnalytics('Mozilla/5.0 LIGHTHOUSE-household-appliance')).toBe(true);
  });
});

describe('the shipped loader (public/umami-loader.js)', () => {
  const mount = {
    'data-umami-loader': '',
    'data-script-src': '/api/umami/script.js',
    'data-website-id': 'texuli-test-id',
    'data-host-url': '/api/umami',
  };

  it('injects the analytics script through the proxy with id and endpoint', async () => {
    const appended = await runLoader(mount, 'Mozilla/5.0 (Macintosh) Chrome/131.0.0.0');
    expect(appended).toHaveLength(1);
    expect(appended[0].getAttribute('src')).toBe('/api/umami/script.js');
    expect(appended[0].getAttribute('data-website-id')).toBe('texuli-test-id');
    expect(appended[0].getAttribute('data-host-url')).toBe('/api/umami');
    expect(appended[0].hasAttribute('defer')).toBe(true);
  });

  it('injects without a host attribute in direct mode', async () => {
    const appended = await runLoader(
      { ...mount, 'data-host-url': '' },
      'Mozilla/5.0 (Macintosh) Chrome/131.0.0.0'
    );
    expect(appended).toHaveLength(1);
    expect(appended[0].getAttribute('data-host-url')).toBeNull();
  });

  it('injects nothing for an auditing client', async () => {
    const appended = await runLoader(
      mount,
      'Mozilla/5.0 (X11; Linux x86_64) Chrome/131.0.0.0 Chrome-Lighthouse'
    );
    expect(appended).toHaveLength(0);
  });

  it('injects nothing without the mount tag (the disabled shape)', async () => {
    const appended = await runLoader(null, 'Mozilla/5.0 (Macintosh) Chrome/131.0.0.0');
    expect(appended).toHaveLength(0);
  });

  it('injects nothing when the tag carries no script source', async () => {
    const appended = await runLoader(
      { 'data-umami-loader': '', 'data-website-id': 'texuli-test-id' },
      'Mozilla/5.0 (Macintosh) Chrome/131.0.0.0'
    );
    expect(appended).toHaveLength(0);
  });

  it('carries every canonical skip marker (duplication drift guard)', () => {
    const shipped = readFileSync(LOADER_SRC, 'utf8');
    for (const marker of ANALYTICS_SKIP_UA) {
      expect(shipped).toContain(`'${marker}'`);
    }
  });
});
