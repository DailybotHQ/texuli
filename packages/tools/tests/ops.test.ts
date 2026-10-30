// @vitest-environment node
import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { runDeckCli } from '../src/cli/deck.ts';
import { runDocumentCli } from '../src/cli/document.ts';
import { runInitCli } from '../src/cli-init/cli.ts';
import { listThemes, previewTheme } from '../src/cli-init/themes.ts';
import {
  createOperationRegistry,
  defineOperation,
  OPERATION_ERROR_CODES,
  type Operation,
  SUPPORTED_SCHEMA_KEYWORDS,
  schemaKeywordIssues,
  TEXULI_ALIASES,
  TEXULI_OPERATIONS,
  TOOLS_VERSION,
  texuliOps,
  validateJson,
} from '../src/ops/index.ts';
import { scenario } from './scenario.ts';

/**
 * The operations registry (ADR-017): every agent-facing capability is one
 * named, schema-described, example-carrying operation, invoked through one
 * schema-checked `invoke()` with stable error codes.
 */

const EXPECTED = [
  'catalog.search',
  'catalog.validate',
  'component.get',
  'example.search',
  'theme.search',
  'theme.get',
  'theme.preview',
  'deck.run',
  'document.run',
  'document.export',
];

const documentFixture = {
  format: 'texuli-document',
  formatVersion: 1,
  meta: { title: 'Fictional brief', locale: 'en' },
  blocks: [
    {
      id: 'p1',
      type: 'paragraph',
      content: [{ type: 'text', text: 'A fictional paragraph.', marks: [] }],
    },
  ],
};

const restore = () => {
  vi.restoreAllMocks();
  process.exitCode = 0;
};
afterEach(restore);

it('declares every operation once, self-described for agents, in the supported schema subset', async () => {
  await scenario('names, runtimes, summaries, limits and examples', () => {
    expect(TEXULI_OPERATIONS.map((operation) => operation.name)).toEqual(EXPECTED);
    expect(new Set(TEXULI_OPERATIONS.map((operation) => operation.name)).size).toBe(
      EXPECTED.length
    );
    for (const operation of TEXULI_OPERATIONS) {
      const label = operation.name;
      expect(operation.name, label).toMatch(/^[a-z][a-z0-9]*\.[a-z][a-z0-9-]*$/u);
      expect(['edge', 'node', 'site'], label).toContain(operation.runtime);
      expect(operation.title.length, label).toBeGreaterThan(3);
      expect(operation.summary.length, label).toBeGreaterThanOrEqual(40);
      expect(operation.summary.length, label).toBeLessThanOrEqual(400);
      expect(operation.input.type, label).toBe('object');
      expect(operation.input.additionalProperties, label).toBe(false);
      expect(operation.output.type, label).toBe('object');
      expect(operation.limits.inputBytes, label).toBeGreaterThan(0);
      expect(operation.limits.timeMs, label).toBeGreaterThan(0);
      expect(operation.examples.length, label).toBeGreaterThan(0);
      expect(operation.annotations, label).toMatchObject({
        readOnly: true,
        destructive: false,
        openWorld: false,
      });
      expect(schemaKeywordIssues(operation.input), label).toEqual([]);
      expect(schemaKeywordIssues(operation.output), label).toEqual([]);
    }
  });
  await scenario(
    'PDF and DOCX writers are node-only; every other operation runs at the edge',
    () => {
      const node = TEXULI_OPERATIONS.filter((operation) => operation.runtime === 'node');
      expect(node.map((operation) => operation.name)).toEqual(['document.export']);
    }
  );
  await scenario('the registry refuses a duplicate name or an unsupported schema keyword', () => {
    const base = TEXULI_OPERATIONS[0] as Operation;
    expect(() => createOperationRegistry([base, base])).toThrow(/Duplicate operation/u);
    expect(() =>
      createOperationRegistry([{ ...base, input: { type: 'object', oneOf: [] } }])
    ).toThrow(/oneOf/u);
    expect(SUPPORTED_SCHEMA_KEYWORDS).toContain('additionalProperties');
  });
});

it('round-trips every example through its input and output schemas', async () => {
  for (const operation of TEXULI_OPERATIONS) {
    for (const example of operation.examples) {
      await scenario(`${operation.name}: ${example.title}`, async () => {
        expect(validateJson(operation.input, example.input)).toEqual([]);
        const outcome = await texuliOps.invoke(operation.name, example.input);
        if (!outcome.ok) throw new Error(`${outcome.error.code}: ${outcome.error.message}`);
        expect(validateJson(operation.output, outcome.output)).toEqual([]);
      });
    }
  }
});

it('refuses invalid input, oversized input and unavailable runtimes with stable codes', async () => {
  const cases: [string, string, unknown, string, RegExp?][] = [
    ['unknown operation', 'catalog.drop', {}, 'unknown-operation'],
    ['non-object input', 'catalog.search', [], 'invalid-input', /\$ must be an object/u],
    ['unknown argument', 'component.get', { id: 'card', path: '/etc' }, 'invalid-input', /path/u],
    ['missing argument', 'component.get', {}, 'invalid-input', /\$\.id is required/u],
    ['wrong type', 'catalog.search', { query: 7 }, 'invalid-input', /\$\.query must be a string/u],
    ['out of range', 'catalog.search', { limit: 0 }, 'invalid-input', /\$\.limit/u],
    ['not an integer', 'catalog.search', { limit: 1.5 }, 'invalid-input', /integer/u],
    ['closed vocabulary', 'catalog.search', { tier: 'root' }, 'invalid-input', /one of/u],
    [
      'prototype key',
      'component.get',
      JSON.parse('{"id":"card","__proto__":{"x":1}}'),
      'invalid-input',
    ],
    ['bad pattern', 'component.get', { id: '../card' }, 'invalid-input', /pattern/u],
    ['too large', 'component.get', { id: 'x'.repeat(5000) }, 'input-too-large'],
    ['not found', 'component.get', { id: 'not-in-catalog' }, 'not-found', /catalog\.search/u],
    ['unknown theme', 'theme.get', { id: 'no-such-theme' }, 'not-found'],
  ];
  for (const [name, operation, input, code, message] of cases) {
    await scenario(name, async () => {
      const outcome = await texuliOps.invoke(operation, input);
      expect(outcome.ok).toBe(false);
      if (outcome.ok) return;
      expect(outcome.error.code).toBe(code);
      expect(OPERATION_ERROR_CODES).toContain(outcome.error.code);
      if (message) expect(outcome.error.message).toMatch(message);
    });
  }
  await scenario('a cyclic input is refused instead of throwing', async () => {
    const cyclic: Record<string, unknown> = { id: 'card' };
    cyclic.self = cyclic;
    const outcome = await texuliOps.invoke('component.get', cyclic);
    expect(outcome).toMatchObject({ ok: false, error: { code: 'invalid-input' } });
  });
  await scenario('a door that serves only edge operations refuses node ones', async () => {
    const outcome = await texuliOps.invoke(
      'document.export',
      { format: 'pdf', document: documentFixture },
      { runtimes: ['edge'] }
    );
    expect(outcome).toMatchObject({ ok: false, error: { code: 'runtime-unavailable' } });
    expect(texuliOps.list({ runtimes: ['edge'] }).map((operation) => operation.name)).toEqual(
      EXPECTED.filter((name) => name !== 'document.export')
    );
  });
});

it('checks handler output, failures and the time budget', async () => {
  const make = (handler: Operation['handler'], timeMs = 1000) =>
    defineOperation({
      name: 'test.run',
      title: 'Test',
      summary: 'A test operation that returns what its handler returns, for the registry tests.',
      input: { type: 'object', properties: {}, additionalProperties: false },
      output: {
        type: 'object',
        properties: { value: { type: 'string' } },
        required: ['value'],
      },
      annotations: { readOnly: true, destructive: false, idempotent: true, openWorld: false },
      runtime: 'edge',
      limits: { inputBytes: 100, timeMs },
      examples: [{ title: 'Run', input: {} }],
      handler,
    });
  const cases: [string, Operation, string][] = [
    ['invalid output', make(() => ({ value: 1 })), 'invalid-output'],
    [
      'thrown error',
      make(() => {
        throw new Error('boom');
      }),
      'operation-failed',
    ],
    ['time budget', make(() => new Promise(() => {}), 20), 'timeout'],
  ];
  for (const [name, operation, code] of cases) {
    await scenario(name, async () => {
      const registry = createOperationRegistry([operation]);
      expect(await registry.invoke('test.run', {})).toMatchObject({ ok: false, error: { code } });
    });
  }
  await scenario('a valid output passes', async () => {
    const registry = createOperationRegistry([make(() => ({ value: 'ok' }))]);
    expect(await registry.invoke('test.run', {})).toEqual({
      ok: true,
      operation: 'test.run',
      output: { value: 'ok' },
    });
  });
});

it('keeps the seven 0.8 tool names as deprecated aliases that resolve to operations', async () => {
  await scenario('every alias targets a real operation and says it is deprecated', () => {
    expect(TEXULI_ALIASES.map((alias) => alias.name)).toEqual([
      'deck',
      'document',
      'catalog',
      'component',
      'validate',
      'example',
      'theme',
    ]);
    for (const alias of TEXULI_ALIASES) {
      for (const target of alias.targets)
        expect(texuliOps.get(target)?.name, alias.name).toBe(target);
      expect(texuliOps.describe(alias.name), alias.name).toMatch(/^Deprecated alias/u);
      expect(schemaKeywordIssues(texuliOps.inputSchema(alias.name) ?? {}), alias.name).toEqual([]);
    }
  });
  const pairs: [string, unknown, string, unknown][] = [
    ['catalog', { query: 'card', limit: 3 }, 'catalog.search', { query: 'card', limit: 3 }],
    ['component', { id: 'card' }, 'component.get', { id: 'card' }],
    ['example', { componentId: 'card' }, 'example.search', { componentId: 'card' }],
    ['theme', { id: 'violet' }, 'theme.get', { id: 'violet' }],
    ['theme', { query: 'violet', limit: 5 }, 'theme.search', { query: 'violet', limit: 5 }],
    ['deck', { command: 'capabilities' }, 'deck.run', { command: 'capabilities' }],
    [
      'document',
      { command: 'from-markdown', markdown: '# Brief' },
      'document.run',
      { command: 'from-markdown', markdown: '# Brief' },
    ],
    [
      'document',
      { command: 'to-docx', document: documentFixture },
      'document.export',
      { format: 'docx', document: documentFixture },
    ],
  ];
  for (const [alias, aliasInput, target, targetInput] of pairs) {
    await scenario(`${alias} -> ${target}`, async () => {
      const viaAlias = await texuliOps.invoke(alias, aliasInput);
      const direct = await texuliOps.invoke(target, targetInput);
      expect(viaAlias).toEqual(direct);
      expect(viaAlias).toMatchObject({ ok: true, operation: target });
    });
  }
  await scenario('an alias still refuses what its target refuses', async () => {
    expect(await texuliOps.invoke('theme', { id: 'violet', bogus: 1 })).toMatchObject({
      ok: false,
      error: { code: 'invalid-input' },
    });
  });
});

it('reads the version from the package manifest, never a literal', () => {
  const manifest = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8')
  ) as { version: string };
  expect(TOOLS_VERSION).toBe(manifest.version);
  expect(TOOLS_VERSION).not.toBe('0.0.0');
});

it('runs the CLI theme, deck and document commands through the registry, with one theme implementation', async () => {
  await scenario(
    'theme list and preview equal the theme operations',
    async () => {
      const spy = vi.spyOn(texuliOps, 'invoke');
      const listed = await listThemes('ocean');
      const searched = await texuliOps.invoke('theme.search', { query: 'ocean', limit: 500 });
      if (!searched.ok) throw new Error(searched.error.message);
      expect(listed.map((theme) => theme.id)).toEqual(
        (searched.output as { themes: { id: string }[] }).themes.map((theme) => theme.id)
      );
      const preview = await previewTheme('ocean', 'dark');
      const operation = await texuliOps.invoke('theme.preview', { id: 'ocean', mode: 'dark' });
      expect(operation).toEqual({ ok: true, operation: 'theme.preview', output: preview });
      expect(await previewTheme('no-such-theme', 'light')).toBeNull();
      const names = spy.mock.calls.map(([name]) => name);
      expect(names).toContain('theme.search');
      expect(names).toContain('theme.preview');
    },
    restore
  );
  await scenario(
    'the full list is every theme in the library',
    async () => {
      const all = await listThemes();
      expect(all.length).toBeGreaterThanOrEqual(200);
      const io = { out: vi.fn(), err: vi.fn() };
      expect(await runInitCli(['theme', 'list', '--json'], io)).toBe(0);
      expect(JSON.parse(String(io.out.mock.calls[0]?.[0])).themes).toEqual(all);
    },
    restore
  );
  await scenario(
    'deck and document commands call deck.run, document.run and document.export',
    async () => {
      vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      const spy = vi.spyOn(texuliOps, 'invoke');
      expect(await runDeckCli(['capabilities'])).toEqual({ ok: true });
      expect(await runDocumentCli(['validate', '--text', JSON.stringify(documentFixture)])).toEqual(
        { ok: true }
      );
      expect(await runDocumentCli(['to-docx', '--text', JSON.stringify(documentFixture)])).toEqual({
        ok: true,
      });
      expect(spy.mock.calls.map(([name]) => name)).toEqual([
        'deck.run',
        'document.run',
        'document.export',
      ]);
    }
  );
});
