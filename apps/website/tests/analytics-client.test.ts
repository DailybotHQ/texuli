/**
 * Client-side analytics (T-34, T-35, T-43): the config gate fails closed
 * (no id, direct mode, a non-same-origin script); payloads lose PII keys and
 * email-shaped values; track() is a silent no-op when off and queues until the
 * loader is ready when on; the shipped public/umami-loader.js injects only the
 * configured same-origin script through the `texuli-analytics` Trusted Types
 * policy and skips auditing clients; UmamiLoader.astro gates its tag; and the
 * landing copy command tracks code_copy only after a successful copy.
 *
 * Modules read `import.meta.env` at module scope, so each case re-stubs the
 * environment and re-imports fresh. The built-site proof (no env, zero
 * analytics requests) is tests/e2e/analytics.spec.ts.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PII_DENYLIST_KEYS, sanitizeEventData } from '../src/lib/analytics';
import { UMAMI_READY_EVENT } from '../src/lib/track.ts';
import { ANALYTICS_SKIP_UA, shouldSkipAnalytics } from '../src/lib/umami-skip.ts';

type UmamiStub = { track: ReturnType<typeof vi.fn> };

function stubUmami(): UmamiStub {
  const stub: UmamiStub = { track: vi.fn() };
  (globalThis as { umami?: UmamiStub }).umami = stub;
  return stub;
}

async function freshImport<T>(path: string, env: Record<string, string | undefined>): Promise<T> {
  vi.resetModules();
  vi.unstubAllEnvs();
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) vi.stubEnv(key, value);
  }
  return import(/* @vite-ignore */ path) as Promise<T>;
}

type Constances = typeof import('../src/lib/constances');
type Track = typeof import('../src/lib/track.ts');
type CopyCommand = typeof import('../src/components/sections/web/web-copy-command.ts');
const loadConstances = (env: Record<string, string | undefined>) =>
  freshImport<Constances>('../src/lib/constances', env);
const loadTrack = (env: Record<string, string | undefined>) =>
  freshImport<Track>('../src/lib/track.ts', env);

const ENABLED = { PUBLIC_UMAMI_WEBSITE_ID: 'test-id', PUBLIC_UMAMI_ENABLE: 'true' };
const flushReady = () => document.dispatchEvent(new CustomEvent(UMAMI_READY_EVENT));

afterEach(() => {
  delete (globalThis as { umami?: unknown }).umami;
  document.body.innerHTML = '';
  Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.restoreAllMocks();
});

describe('ANALYTICS gating', () => {
  it('is off with no id and points at the first-party proxy when enabled', async () => {
    const off = await loadConstances({ PUBLIC_UMAMI_WEBSITE_ID: '', PROD: 'true' });
    expect(off.ANALYTICS.umami).toMatchObject({
      websiteId: '',
      enabled: false,
      scriptUrl: '',
      hostUrl: '',
    });
    const on = await loadConstances({
      PUBLIC_UMAMI_WEBSITE_ID: 'test-id',
      PROD: 'true',
      PUBLIC_UMAMI_USE_PROXY: '',
    });
    expect(on.ANALYTICS.umami).toMatchObject({
      enabled: true,
      scriptUrl: '/api/umami/script.js',
      hostUrl: '/api/umami',
    });
  });

  // The enforced CSP allows `script-src 'self'` and `connect-src 'self'` only,
  // so direct mode or a foreign script would be a silent off: fail closed.
  it('fails closed in direct mode and on every non-same-origin script override', async () => {
    const off = { enabled: false, scriptUrl: '', hostUrl: '' };
    const direct = await loadConstances({
      PUBLIC_UMAMI_WEBSITE_ID: 'test-id',
      PROD: 'true',
      PUBLIC_UMAMI_USE_PROXY: 'false',
    });
    expect(direct.ANALYTICS.umami).toMatchObject(off);
    for (const url of [
      'https://cloud.umami.is/script.js',
      '//cloud.umami.is/script.js',
      '/\\cloud.umami.is/script.js',
      'http://analytics.example.com/script.js',
      'javascript:alert(1)',
      'api/umami/script.js',
    ]) {
      const { ANALYTICS } = await loadConstances({
        PUBLIC_UMAMI_WEBSITE_ID: 'test-id',
        PROD: 'true',
        PUBLIC_UMAMI_SCRIPT_URL: url,
      });
      expect(ANALYTICS.umami, url).toMatchObject(off);
    }
    const sameOrigin = await loadConstances({
      PUBLIC_UMAMI_WEBSITE_ID: 'test-id',
      PROD: 'true',
      PUBLIC_UMAMI_SCRIPT_URL: '/api/umami/script.js',
    });
    expect(sameOrigin.ANALYTICS.umami.scriptUrl).toBe('/api/umami/script.js');
  });

  it('stays off in local dev unless PUBLIC_UMAMI_ENABLE=true', async () => {
    const dev = await loadConstances({
      PUBLIC_UMAMI_WEBSITE_ID: 'test-id',
      PUBLIC_UMAMI_ENABLE: '',
    });
    expect(dev.ANALYTICS.umami.enabled).toBe(false);
    expect(dev.ANALYTICS.umami.scriptUrl).toBe('');
    const optedIn = await loadConstances({
      PUBLIC_UMAMI_WEBSITE_ID: 'test-id',
      PROD: 'false',
      PUBLIC_UMAMI_ENABLE: 'true',
    });
    expect(optedIn.ANALYTICS.umami.enabled).toBe(true);
  });

  it('reads the search verification metas from the environment, off by default', async () => {
    const withKeys = await loadConstances({
      PUBLIC_BING_SITE_VERIFICATION: 'bing-code',
      PUBLIC_GOOGLE_SITE_VERIFICATION: 'google-token',
    });
    expect(withKeys.ANALYTICS.verification).toMatchObject({
      bing: 'bing-code',
      google: 'google-token',
    });
    const without = await loadConstances({});
    expect(without.ANALYTICS.verification).toMatchObject({ bing: '', google: '' });
  });
});

describe('sanitizeEventData', () => {
  it('strips every denylisted key case-insensitively and keeps allowed scalars', () => {
    expect(PII_DENYLIST_KEYS.length).toBeGreaterThanOrEqual(9);
    expect(sanitizeEventData(undefined)).toBeUndefined();
    expect(
      sanitizeEventData({
        Email: 'a@b.c',
        user_name: 'x',
        MESSAGE: 'hi',
        phone: '555',
        component: 'alert',
      })
    ).toEqual({ component: 'alert' });
    expect(sanitizeEventData({ fullname: 'x', apikey: 'y' })).toBeUndefined();
    expect(sanitizeEventData({ depth: 75, visible: true })).toEqual({ depth: 75, visible: true });
  });
});

describe('track()', () => {
  it('is a silent no-op when disabled: dropped, not deferred, and window.umami untouched', async () => {
    const { track } = await loadTrack({});
    const consoleSpies = [
      vi.spyOn(console, 'log'),
      vi.spyOn(console, 'warn'),
      vi.spyOn(console, 'error'),
    ];
    track('code_copy', { page: '/guides/theming/' });
    expect((globalThis as { umami?: unknown }).umami).toBeUndefined();
    const umami = stubUmami();
    flushReady();
    expect(umami.track).not.toHaveBeenCalled();
    for (const spy of consoleSpies) expect(spy).not.toHaveBeenCalled();
  });

  it('queues until the ready signal and flushes in order; calls a loaded script directly', async () => {
    const queued = await loadTrack(ENABLED);
    queued.track('theme_switch', { from: 'light', to: 'dark' });
    queued.track('code_copy', { page: '/guides/theming/' });
    const umami = stubUmami();
    flushReady();
    expect(umami.track.mock.calls).toEqual([
      ['theme_switch', { from: 'light', to: 'dark' }],
      ['code_copy', { page: '/guides/theming/' }],
    ]);

    const direct = await loadTrack(ENABLED);
    const loaded = stubUmami();
    direct.track('studio_launch', { studio: 'media-lab' });
    flushReady();
    expect(loaded.track).toHaveBeenCalledTimes(1);
  });

  it('sanitizes before queueing: denied keys go, email-shaped values are redacted', async () => {
    const { track } = await loadTrack(ENABLED);
    track('theme_switch', { from: 'contact alice@example.com', to: 'dark' });
    // A payload of only denied keys still sends the (non-PII) event name.
    track('code_copy', { token: 'secret' } as unknown as { page: string });
    track('outbound_doc_link', { url: 'https://example.com/people/bob@example.com/docs' });
    const umami = stubUmami();
    flushReady();
    expect(umami.track.mock.calls).toEqual([
      ['theme_switch', { from: 'contact [redacted]', to: 'dark' }],
      ['code_copy', undefined],
      ['outbound_doc_link', { url: 'https://example.com/people/[redacted]/docs' }],
    ]);
  });

  it('oncePerInstance forwards only the first call, and emitter failures never surface', async () => {
    const { oncePerInstance, track } = await loadTrack(ENABLED);
    const umami = stubUmami();
    const open = oncePerInstance('component_demo_open');
    open({ component: 'button' });
    open({ component: 'button' });
    expect(umami.track.mock.calls).toEqual([['component_demo_open', { component: 'button' }]]);

    umami.track.mockImplementation(() => {
      throw new Error('collector down');
    });
    const errorSpy = vi.spyOn(console, 'error');
    expect(() => track('theme_switch', { from: 'light', to: 'dark' })).not.toThrow();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

describe('the shipped loader (public/umami-loader.js)', () => {
  const LOADER_SRC = resolve('apps/website/public/umami-loader.js');
  const LOADER_URL = new URL(`file://${LOADER_SRC}`).href;
  const BROWSER = 'Mozilla/5.0 (Macintosh) Chrome/131.0.0.0';
  const mount = {
    'data-umami-loader': '',
    'data-script-src': '/api/umami/script.js',
    'data-website-id': 'texuli-test-id',
    'data-host-url': '/api/umami',
  };

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
    await import(/* @vite-ignore */ LOADER_URL);
    spy.mockRestore();
    return appended;
  }

  it('skips auditing clients only; headless visitors and reading bots are real clients', () => {
    for (const userAgent of [
      `${BROWSER} Safari/537.36 Chrome-Lighthouse`,
      'Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/131.0.0.0 Chrome-Lighthouse',
      'Mozilla/5.0 (compatible; Chrome/131.0.0.0; PageSpeed/1.0)',
      'GTmetrix/2.0 (https://gtmetrix.com)',
      'Pingdom.com_bot_version_1.4_(https://www.pingdom.com/)',
      'WebPageTest/1.0 (+https://www.webpagetest.org)',
      'Mozilla/5.0 LIGHTHOUSE-household-appliance',
    ]) {
      expect(shouldSkipAnalytics(userAgent), userAgent).toBe(true);
    }
    for (const userAgent of [
      BROWSER,
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
      'Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/131.0.0.0 Safari/537.36',
      'Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
      undefined,
      null,
      '',
    ]) {
      expect(shouldSkipAnalytics(userAgent), String(userAgent)).toBe(false);
    }
    // Duplication drift guard: the unbundled public file carries every marker.
    const shipped = readFileSync(LOADER_SRC, 'utf8');
    for (const marker of ANALYTICS_SKIP_UA) expect(shipped, marker).toContain(`'${marker}'`);
  });

  it('injects the proxied script with id, endpoint, defer and no query or hash tracking', async () => {
    const [script, ...rest] = await runLoader(mount, BROWSER);
    expect(rest).toEqual([]);
    expect(script.getAttribute('src')).toBe('/api/umami/script.js');
    expect(script.getAttribute('data-website-id')).toBe('texuli-test-id');
    expect(script.getAttribute('data-host-url')).toBe('/api/umami');
    expect(script.hasAttribute('defer')).toBe(true);
    // Theme share links live in #theme=: the tracker must drop them.
    expect(script.getAttribute('data-exclude-search')).toBe('true');
    expect(script.getAttribute('data-exclude-hash')).toBe('true');

    const direct = await runLoader({ ...mount, 'data-host-url': '' }, BROWSER);
    expect(direct).toHaveLength(1);
    expect(direct[0].getAttribute('data-host-url')).toBeNull();
  });

  it('injects nothing for an auditor, without the tag, without a source, or for a non-http(s) source', async () => {
    const cases: [string, Record<string, string> | null, string][] = [
      [
        'auditing client',
        mount,
        'Mozilla/5.0 (X11; Linux x86_64) Chrome/131.0.0.0 Chrome-Lighthouse',
      ],
      ['no mount tag', null, BROWSER],
      [
        'no script source',
        { 'data-umami-loader': '', 'data-website-id': 'texuli-test-id' },
        BROWSER,
      ],
      ['javascript: source', { ...mount, 'data-script-src': 'javascript:alert(1)' }, BROWSER],
    ];
    for (const [name, attrs, userAgent] of cases) {
      expect(await runLoader(attrs, userAgent), name).toHaveLength(0);
    }
  });

  it('creates the src through a texuli-analytics policy that vouches for the one configured URL', async () => {
    const policies: { name: string; rules: { createScriptURL: (url: string) => unknown } }[] = [];
    vi.stubGlobal('trustedTypes', {
      createPolicy: (name: string, rules: { createScriptURL: (url: string) => string }) => {
        policies.push({ name, rules });
        return {
          createScriptURL: (url: string) => ({ toString: () => rules.createScriptURL(url) }),
        };
      },
    });
    const appended = await runLoader(mount, BROWSER);
    expect(policies.map((policy) => policy.name)).toEqual(['texuli-analytics']);
    expect(appended[0].getAttribute('src')).toBe('/api/umami/script.js');
    const rules = policies[0].rules;
    expect(rules.createScriptURL('/api/umami/script.js')).toBe('/api/umami/script.js');
    expect(() => rules.createScriptURL('/evil.js')).toThrow();
    expect(() => rules.createScriptURL('https://attacker.example/script.js')).toThrow();
  });

  it('injects nothing when the CSP refuses the policy, and creates none for an auditor', async () => {
    vi.stubGlobal('trustedTypes', {
      createPolicy: () => {
        throw new TypeError('Policy "texuli-analytics" disallowed.');
      },
    });
    expect(await runLoader(mount, BROWSER)).toHaveLength(0);

    const createPolicy = vi.fn();
    vi.stubGlobal('trustedTypes', { createPolicy });
    expect(await runLoader(mount, 'Mozilla/5.0 Chrome/131.0.0.0 Chrome-Lighthouse')).toHaveLength(
      0
    );
    expect(createPolicy).not.toHaveBeenCalled();
  });

  it('UmamiLoader.astro gates the same-origin loader tag on the enabled flag', () => {
    // The root config does not compile .astro; the rendered proof is the e2e spec.
    const source = readFileSync(
      resolve('apps/website/src/components/analytics/UmamiLoader.astro'),
      'utf8'
    );
    expect(source).toContain('umami.enabled &&');
    expect(source).toMatch(/<script[^>]*is:inline/s);
    for (const attribute of [
      'src="/umami-loader.js"',
      'data-umami-loader',
      'data-script-src={umami.scriptUrl}',
      'data-website-id={umami.websiteId}',
      'data-host-url={umami.hostUrl}',
    ]) {
      expect(source, attribute).toContain(attribute);
    }
    expect(source).not.toContain('cloud.umami.is');
  });
});

describe('the landing copy command (web-copy-command.ts, T-43)', () => {
  const COMMAND = 'pnpm add texuli';
  const FAILED = 'Copy failed: your browser blocked the clipboard.';

  function buildHost(): { host: HTMLElement; status: () => string | null | undefined } {
    const host = document.createElement('div');
    host.setAttribute('data-copy-command', '');
    host.innerHTML = [
      '<button type="button" data-copy-command-button="">Copy install command</button>',
      `<template data-copy-command-text="">${COMMAND}</template>`,
      '<p class="status" role="status" data-copy-command-status=""></p>',
    ].join('');
    document.body.append(host);
    return {
      host,
      status: () => host.querySelector('[data-copy-command-status]')?.textContent,
    };
  }

  function stubClipboard(writeText: ((text: string) => Promise<void>) | undefined): void {
    const value = writeText === undefined ? undefined : { writeText };
    Object.defineProperty(navigator, 'clipboard', { value, configurable: true });
  }

  async function copy(env: Record<string, string>): Promise<{ status: string | null | undefined }> {
    const { wireCopyCommand } = await freshImport<CopyCommand>(
      '../src/components/sections/web/web-copy-command.ts',
      env
    );
    const { host, status } = buildHost();
    expect(() => wireCopyCommand(host, '/install-test/')).not.toThrow();
    host.querySelector<HTMLButtonElement>('[data-copy-command-button]')?.click();
    await new Promise((done) => setTimeout(done, 0));
    return { status: status() };
  }

  it('copies, reports through the status region, then tracks code_copy', async () => {
    const writeText = vi.fn((_text: string) => Promise.resolve());
    stubClipboard(writeText);
    const umami = stubUmami();
    expect((await copy(ENABLED)).status).toBe('Command copied.');
    expect(writeText.mock.calls).toEqual([[COMMAND]]);
    expect(umami.track.mock.calls).toEqual([['code_copy', { page: '/install-test/' }]]);
  });

  it('never tracks a blocked or missing clipboard, and still copies with analytics off', async () => {
    for (const writeText of [() => Promise.reject(new Error('blocked')), undefined]) {
      stubClipboard(writeText);
      const umami = stubUmami();
      expect((await copy(ENABLED)).status).toBe(FAILED);
      expect(umami.track).not.toHaveBeenCalled();
    }
    stubClipboard(() => Promise.resolve());
    const umami = stubUmami();
    expect((await copy({})).status).toBe('Command copied.');
    expect(umami.track).not.toHaveBeenCalled();
  });
});
