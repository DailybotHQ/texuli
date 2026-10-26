import { afterEach, describe, expect, it, vi } from 'vitest';
import { EVENTS, PII_DENYLIST_KEYS, sanitizeEventData } from '../src/lib/analytics';

/**
 * `constances.ts` reads `import.meta.env` at module scope, so each case
 * re-stubs the environment and re-imports the module fresh. Stubs are
 * cleared first: vi.stubEnv accumulates, and a case that stubs nothing
 * must see a clean env. Tests never stub PROD false — the vitest run is
 * naturally non-PROD, which is exactly the branch under test; PROD:true
 * cases stub it true to stand in for a production build.
 */
async function loadConstances(env: Record<string, string | undefined>) {
  vi.resetModules();
  vi.unstubAllEnvs();
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) vi.stubEnv(key, value);
  }
  return import('../src/lib/constances');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('ANALYTICS gating', () => {
  it('is disabled with no website id, and emits no script URL', async () => {
    const { ANALYTICS } = await loadConstances({
      PUBLIC_UMAMI_WEBSITE_ID: '',
      PROD: 'true',
    });
    expect(ANALYTICS.umami.websiteId).toBe('');
    expect(ANALYTICS.umami.enabled).toBe(false);
    expect(ANALYTICS.umami.scriptUrl).toBe('');
    expect(ANALYTICS.umami.hostUrl).toBe('');
  });

  it('points at the first-party proxy by default when enabled', async () => {
    const { ANALYTICS } = await loadConstances({
      PUBLIC_UMAMI_WEBSITE_ID: 'test-id',
      PROD: 'true',
      PUBLIC_UMAMI_USE_PROXY: '',
    });
    expect(ANALYTICS.umami.enabled).toBe(true);
    expect(ANALYTICS.umami.scriptUrl).toBe('/api/umami/script.js');
    expect(ANALYTICS.umami.hostUrl).toBe('/api/umami');
  });

  it('points at the cloud origin in direct mode (explicit opt-out)', async () => {
    const { ANALYTICS } = await loadConstances({
      PUBLIC_UMAMI_WEBSITE_ID: 'test-id',
      PROD: 'true',
      PUBLIC_UMAMI_USE_PROXY: 'false',
    });
    expect(ANALYTICS.umami.enabled).toBe(true);
    expect(ANALYTICS.umami.scriptUrl).toBe('https://cloud.umami.is/script.js');
    expect(ANALYTICS.umami.hostUrl).toBe('');
  });

  it('stays off in local dev without the explicit enable flag', async () => {
    const { ANALYTICS } = await loadConstances({
      PUBLIC_UMAMI_WEBSITE_ID: 'test-id',
      PUBLIC_UMAMI_ENABLE: '',
    });
    expect(ANALYTICS.umami.enabled).toBe(false);
    expect(ANALYTICS.umami.scriptUrl).toBe('');
  });

  it('opts into local runs via PUBLIC_UMAMI_ENABLE=true', async () => {
    const { ANALYTICS } = await loadConstances({
      PUBLIC_UMAMI_WEBSITE_ID: 'test-id',
      PROD: 'false',
      PUBLIC_UMAMI_ENABLE: 'true',
    });
    expect(ANALYTICS.umami.enabled).toBe(true);
  });

  it('honors a script URL override only while an id exists', async () => {
    const overridden = await loadConstances({
      PUBLIC_UMAMI_WEBSITE_ID: 'test-id',
      PROD: 'true',
      PUBLIC_UMAMI_SCRIPT_URL: '/api/umami/script.js',
    });
    expect(overridden.ANALYTICS.umami.scriptUrl).toBe('/api/umami/script.js');

    const noId = await loadConstances({
      PUBLIC_UMAMI_WEBSITE_ID: '',
      PROD: 'true',
      PUBLIC_UMAMI_SCRIPT_URL: 'https://cloud.umami.is/script.js',
    });
    expect(noId.ANALYTICS.umami.scriptUrl).toBe('');
  });

  it('reads the Bing verification meta from the environment', async () => {
    const withKey = await loadConstances({
      PUBLIC_BING_SITE_VERIFICATION: 'bing-code',
    });
    expect(withKey.ANALYTICS.verification.bing).toBe('bing-code');

    const without = await loadConstances({});
    expect(without.ANALYTICS.verification.bing).toBe('');
  });

  it('reads the Google verification meta from the environment; both stay off by default', async () => {
    const withKey = await loadConstances({
      PUBLIC_GOOGLE_SITE_VERIFICATION: 'google-token',
    });
    expect(withKey.ANALYTICS.verification.google).toBe('google-token');

    const without = await loadConstances({});
    expect(without.ANALYTICS.verification.google).toBe('');
    expect(without.ANALYTICS.verification.bing).toBe('');
  });
});

describe('sanitizeEventData', () => {
  it('returns undefined for absent payloads', () => {
    expect(sanitizeEventData(undefined)).toBeUndefined();
  });

  it('strips every denylisted key, case-insensitively', () => {
    const result = sanitizeEventData({
      Email: 'a@b.c',
      user_name: 'x',
      MESSAGE: 'hi',
      phone: '555',
      component: 'alert',
    });
    expect(result).toEqual({ component: 'alert' });
  });

  it('returns undefined when everything was stripped', () => {
    expect(sanitizeEventData({ fullname: 'x', apikey: 'y' })).toBeUndefined();
  });

  it('keeps booleans and numbers on allowed keys', () => {
    expect(sanitizeEventData({ depth: 75, visible: true })).toEqual({
      depth: 75,
      visible: true,
    });
  });
});

describe('event catalog', () => {
  it('reserves the server-side bot and markdown events', () => {
    expect(EVENTS.AI_BOT_VISIT).toBe('ai_bot_visit');
    expect(EVENTS.UNKNOWN_BOT_VISIT).toBe('unknown_bot_visit');
    expect(EVENTS.MARKDOWN_REQUEST).toBe('markdown_request');
  });

  it('documents a denylist long enough to catch compound keys', () => {
    expect(PII_DENYLIST_KEYS.length).toBeGreaterThanOrEqual(9);
  });
});
