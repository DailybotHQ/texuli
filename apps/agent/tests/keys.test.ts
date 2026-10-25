import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { format, inspect } from 'node:util';
import { describe, expect, it } from 'vitest';
import { parseLocalAgentConfig, resolveKillSwitch } from '../src/guard.ts';
import {
  createSecret,
  describeProviderKey,
  isSecret,
  redactSecrets,
  resolveProviderKey,
} from '../src/keys.ts';
import { issueSession } from '../src/limits.ts';
import { createNodeAgentSettings } from '../src/node-config.ts';
import worker, { workerProviderKey } from '../src/worker.ts';
import { HASH } from './helpers.ts';

/*
 * Task 90: provider key handling. Keys are fictional and injected as config
 * TEXT or a fake environment; no test reads ~/.config/texuli/ or any .env.
 */

const KEY = 'test-key-not-real-0001-example';
const OTHER = 'test-key-not-real-0002-example';
const config = (value: unknown) => JSON.stringify(value);

describe('redacting secrets', () => {
  it('prints [redacted] through every common path and reveals only on request', () => {
    const secret = createSecret(KEY);
    const holder = { provider: 'xai', key: secret, nested: [secret] };
    for (const printed of [
      String(secret),
      `${secret}`,
      JSON.stringify(holder),
      inspect(holder, { depth: 5 }),
      format('%s %o %j', secret, holder, holder),
    ]) {
      expect(printed).not.toContain(KEY);
      expect(printed).toContain('[redacted]');
    }
    expect(secret.reveal()).toBe(KEY);
    expect(isSecret(secret)).toBe(true);
    expect(Object.isFrozen(secret)).toBe(true);
  });

  it('redacts secret values inside free text such as an upstream error', () => {
    const text = `401 from provider: key ${KEY} rejected (also ${OTHER})`;
    expect(redactSecrets(text, [createSecret(KEY), createSecret(OTHER), null])).toBe(
      '401 from provider: key [redacted] rejected (also [redacted])'
    );
  });
});

describe('local operator file: provider block', () => {
  it('parses the key as a secret and keeps the enabled semantics unchanged', () => {
    const parsed = parseLocalAgentConfig(
      config({ enabled: false, provider: { id: 'xai', key: KEY } })
    );
    expect(parsed.enabled).toBe(false);
    expect(parsed.provider?.id).toBe('xai');
    expect(parsed.provider?.key.reveal()).toBe(KEY);
    expect(JSON.stringify(parsed)).not.toContain(KEY);
    expect(resolveKillSwitch({ env: '1', envMode: 'on-when-1', local: parsed })).toEqual({
      enabled: false,
      source: 'local-config',
    });
    // A provider block alone never turns the service on or off.
    const keyOnly = parseLocalAgentConfig(config({ provider: { id: 'xai', key: KEY } }));
    expect(keyOnly.enabled).toBeUndefined();
    expect(resolveKillSwitch({ envMode: 'off-when-0', local: keyOnly })).toEqual({
      enabled: true,
      source: 'default',
    });
  });

  it('ignores malformed provider blocks and stray key fields', () => {
    for (const provider of [
      { id: 'xai' },
      { id: 'xai', key: 'short' },
      { id: 'xai', key: 'has spaces in it' },
      { id: 'xai', key: 12345678901 },
      { id: 'XAI!', key: KEY },
      { id: 'xai', key: 'x'.repeat(513) },
      'xai',
      [KEY],
    ]) {
      expect(parseLocalAgentConfig(config({ provider })).provider).toBeUndefined();
    }
    expect(parseLocalAgentConfig(config({ apiKey: KEY, key: KEY }))).toEqual({});
  });
});

describe('provider key resolution', () => {
  const local = parseLocalAgentConfig(config({ provider: { id: 'xai', key: KEY } }));

  it('prefers the environment (the secret store) over the local file', () => {
    const resolution = resolveProviderKey({ envKey: OTHER, envProvider: 'xai', local });
    expect(resolution).toMatchObject({ provider: 'xai', source: 'env', rejected: [] });
    expect(resolution.key?.reveal()).toBe(OTHER);
  });

  it('falls back to the local file, and to none without either', () => {
    const fromLocal = resolveProviderKey({ local });
    expect(fromLocal).toMatchObject({ provider: 'xai', source: 'local-config' });
    expect(fromLocal.key?.reveal()).toBe(KEY);
    expect(resolveProviderKey({})).toEqual({
      key: null,
      provider: null,
      source: 'none',
      rejected: [],
    });
  });

  it('reports malformed settings by name only and never echoes their values', () => {
    const resolution = resolveProviderKey({ envKey: 'bad key', envProvider: 'X AI', local });
    expect(resolution.source).toBe('local-config');
    expect(resolution.rejected).toEqual(['AGENT_PROVIDER', 'AGENT_PROVIDER_KEY']);
    const described = describeProviderKey(resolveProviderKey({ envKey: 'bad key' }));
    expect(described).toBe('provider key: none (replay provider); ignored AGENT_PROVIDER_KEY');
    expect(described).not.toContain('bad key');
  });

  it('describes a present key without printing it', () => {
    const described = describeProviderKey(resolveProviderKey({ local }));
    expect(described).toBe('provider key: present for xai (local-config; no adapter uses it yet)');
    expect(described).not.toContain(KEY);
  });
});

describe('Node dev adapter settings (config text, never a file)', () => {
  it('reads token ceilings from environment text or the local config text', () => {
    const localBudgets = { perSessionDailyTokens: 20, globalDailyTokens: 200 };
    const environmentBudgets = { perSessionDailyTokens: 10, globalDailyTokens: 100 };
    const fromLocal = createNodeAgentSettings({
      env: {},
      readConfigText: () => config({ tokenBudgets: localBudgets }),
    });
    expect(fromLocal.tokenBudgets()).toEqual(localBudgets);

    const fromEnvironment = createNodeAgentSettings({
      env: { AGENT_TOKEN_BUDGETS: config(environmentBudgets) },
      readConfigText: () => config({ tokenBudgets: localBudgets }),
    });
    expect(fromEnvironment.tokenBudgets()).toEqual(environmentBudgets);
  });

  it('reads the operator text for both the kill switch and the key, and refreshes it', () => {
    let text: string | null = config({ provider: { id: 'xai', key: KEY } });
    let now = 0;
    const settings = createNodeAgentSettings({
      env: {},
      readConfigText: () => text,
      clock: () => now,
    });
    expect(settings.killSwitch()).toEqual({ enabled: true, source: 'default' });
    expect(settings.providerKey().key?.reveal()).toBe(KEY);

    text = config({ enabled: false });
    now = 500;
    expect(settings.killSwitch().enabled).toBe(true);
    now = 1_000;
    expect(settings.killSwitch()).toEqual({ enabled: false, source: 'local-config' });
    expect(settings.providerKey().source).toBe('none');
  });

  it('treats an unreadable file as no setting and lets env decide', () => {
    const settings = createNodeAgentSettings({
      env: { AGENT_ENABLED: '0', AGENT_PROVIDER_KEY: OTHER, AGENT_PROVIDER: 'xai' },
      readConfigText: () => {
        throw new Error('EACCES');
      },
    });
    expect(settings.killSwitch()).toEqual({ enabled: false, source: 'env' });
    expect(settings.providerKey()).toMatchObject({ source: 'env', provider: 'xai' });
  });
});

describe('edge worker adapter (environment only)', () => {
  it('resolves the key from its environment and has no file path at all', () => {
    expect(workerProviderKey({ AGENT_PROVIDER_KEY: KEY, AGENT_PROVIDER: 'xai' })).toMatchObject({
      source: 'env',
      provider: 'xai',
    });
    expect(workerProviderKey({})).toMatchObject({ source: 'none', key: null });
    expect(workerProviderKey.length).toBe(1);
  });

  it('never returns the key in health or draft responses', async () => {
    const sessionSecret = 'fictional-worker-session-secret-0001';
    const env = {
      AGENT_ENABLED: '1',
      AGENT_SESSION_SECRET: sessionSecret,
      AGENT_PROVIDER_KEY: KEY,
      AGENT_PROVIDER: 'xai',
    };
    const health = await worker.fetch(new Request('https://agent.example/v1/health'), env);
    expect(await health.text()).not.toContain(KEY);
    const token = await issueSession(sessionSecret, Date.now());
    const draft = await worker.fetch(
      new Request('https://agent.example/v1/draft', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt: `Use the key ${KEY}`, catalogHash: HASH }),
      }),
      env
    );
    expect(await draft.text()).not.toContain(KEY);
  });
});

describe('repository boundary', () => {
  const root = join(import.meta.dirname, '..');
  function files(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      if (name === 'node_modules') return [];
      const path = join(dir, name);
      return statSync(path).isDirectory() ? files(path) : [path];
    });
  }
  const tracked = [
    ...files(join(root, 'src')),
    ...files(join(root, 'tests')),
    ...files(join(root, 'docs')),
    join(root, 'README.md'),
  ];

  it('holds no provider-shaped keys', () => {
    const keyShapes = [/\bxai-[A-Za-z0-9]{20,}/, /\bsk-[A-Za-z0-9_-]{20,}/, /\bAKIA[0-9A-Z]{16}\b/];
    for (const path of tracked) {
      const text = readFileSync(path, 'utf8');
      for (const shape of keyShapes) expect(shape.test(text), `${path} ${shape}`).toBe(false);
    }
  });

  it('never reads .env files, and only the Node adapter reads the file system', () => {
    for (const path of files(join(root, 'src'))) {
      const text = readFileSync(path, 'utf8');
      expect(/['"`][^'"`]*\.env['"`]|dotenv/.test(text), path).toBe(false);
      if (!path.endsWith('node.ts')) expect(text.includes('readFileSync'), path).toBe(false);
    }
  });
});
