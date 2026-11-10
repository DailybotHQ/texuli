/**
 * PLAN_016 T-validator-corpus (ADR-032): the conformance corpus of `checkDesignSystemFull`.
 * `fixtures/ds-validate/cases/<area>.<code>.{fail,pass}.json` hold one failing and one fixed
 * fictional input per issue code; `fixtures/ds-validate/golden/<name>.json` hold the expected
 * reports (code, severity, area, path, value, mode and variant of every finding). The test
 * fails on drift; `TEXULI_UPDATE_GOLDEN=1` rewrites the goldens after a reviewed change.
 * Hostile inputs (size, depth, prototype keys, unicode, wrong types) fail closed.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SpecCatalog } from '@texuli/spec';
import { DESIGN_SYSTEM_CODES, DESIGN_SYSTEM_COMPILER_CODES } from '@texuli/spec/design-system';
import { compileDesignSystem } from '@texuli/tokens/design-system/compile-core';
import { describe, expect, it } from 'vitest';
import {
  checkDesignSystemFull,
  compiledFindings,
  DS_FULL_CODES,
  DS_FULL_LIMIT_CODES,
  DS_FULL_PROTOTYPE_LIMITS,
  type DsFullFinding,
  type DsFullOptions,
  LOCKED_CSS_CODES,
  LOCKED_STATIC_CODES,
} from '../src/ds-check/index.ts';
import { DS_CHECK_LOCKED_CODES } from '../src/ds-check/static.ts';

const ROOT = join(import.meta.dirname, '../fixtures/ds-validate');
const CASES = join(ROOT, 'cases');
const GOLDEN = join(ROOT, 'golden');
const UPDATE = process.env.TEXULI_UPDATE_GOLDEN === '1';
const catalog = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../spec/catalog/components.json'), 'utf8')
) as SpecCatalog;

interface Fixture {
  description: string;
  code: string;
  expect: 'fail' | 'pass';
  document?: unknown;
  options?: Omit<DsFullOptions, 'catalog'>;
  /** A compiled variable map (`reference`: a fresh compile) for the token and palette checks. */
  compiled?: Record<string, Record<string, string>> | 'reference';
}

interface Golden {
  ok: boolean;
  codes: string[];
  findings: Partial<DsFullFinding>[];
}

const project = (finding: DsFullFinding): Partial<DsFullFinding> => ({
  code: finding.code,
  severity: finding.severity,
  area: finding.area,
  path: finding.path,
  ...(finding.value !== undefined ? { value: finding.value } : {}),
  ...(finding.mode ? { mode: finding.mode } : {}),
  ...(finding.variant ? { variant: finding.variant } : {}),
});

function referenceVars() {
  const compiled = compileDesignSystem({
    format: 'texuli/design-system',
    formatVersion: 1,
    id: 'reference',
    version: '1.0.0',
    name: 'Reference',
    color: { brand: { seed: '#0e7490' } },
  });
  if (!compiled.ok) throw new Error('reference compile failed');
  return compiled.vars as Record<string, Record<string, string>>;
}

async function run(fixture: Fixture): Promise<Golden> {
  if (fixture.compiled !== undefined) {
    const vars = fixture.compiled === 'reference' ? referenceVars() : fixture.compiled;
    const findings = compiledFindings(vars, undefined);
    const errors = findings.filter((f) => f.severity === 'error');
    return {
      ok: errors.length === 0,
      codes: [...new Set(errors.map((f) => f.code))].sort(),
      findings: findings.map(project),
    };
  }
  const report = await checkDesignSystemFull(fixture.document, {
    catalog,
    ...(fixture.options ?? {}),
  });
  return { ok: report.ok, codes: report.codes, findings: report.findings.map(project) };
}

function golden(name: string, actual: Golden) {
  const file = join(GOLDEN, `${name}.json`);
  const text = `${JSON.stringify(actual, null, 2)}\n`;
  if (UPDATE) {
    mkdirSync(GOLDEN, { recursive: true });
    writeFileSync(file, text);
    return;
  }
  expect(existsSync(file), `missing golden ${name}.json (run with TEXULI_UPDATE_GOLDEN=1)`).toBe(
    true
  );
  expect(actual, `${name} drifted from its golden report`).toEqual(
    JSON.parse(readFileSync(file, 'utf8'))
  );
}

// New chart foreground tokens are required system entries and appear in missing-token reports.

const files = readdirSync(CASES)
  .filter((f) => f.endsWith('.json'))
  .sort();
const fixtures = files.map((file) => ({
  name: file.replace(/\.json$/, ''),
  fixture: JSON.parse(readFileSync(join(CASES, file), 'utf8')) as Fixture,
}));

/** Every code a full report can raise. */
const ALL_CODES = new Set<string>([
  ...DESIGN_SYSTEM_CODES,
  ...DESIGN_SYSTEM_COMPILER_CODES,
  ...DS_CHECK_LOCKED_CODES,
  ...DS_FULL_CODES,
  ...LOCKED_STATIC_CODES,
  'dynamic-value',
  ...LOCKED_CSS_CODES,
]);

describe('the corpus covers every issue code', () => {
  it('has a failing and a passing fixture per code, and nothing else', () => {
    const fail = new Set(
      fixtures.filter((f) => f.fixture.expect === 'fail').map((f) => f.fixture.code)
    );
    const pass = new Set(
      fixtures.filter((f) => f.fixture.expect === 'pass').map((f) => f.fixture.code)
    );
    for (const code of ALL_CODES) {
      expect(fail.has(code), `no failing fixture for ${code}`).toBe(true);
      expect(pass.has(code), `no passing fixture for ${code}`).toBe(true);
    }
    for (const code of [...fail, ...pass])
      expect(ALL_CODES.has(code), `unknown code ${code}`).toBe(true);
    // Every fixture names its code in its file name and holds fictional data only.
    for (const { name, fixture } of fixtures) {
      expect(name.split('.').at(-1), name).toBe(fixture.expect);
      expect(name, name).toContain(fixture.code);
      expect(fixture.description.length, name).toBeGreaterThan(5);
      expect(JSON.stringify(fixture), name).not.toMatch(
        /@(?!texuli\b)[a-z0-9-]+\.(com|org|net)\b/i
      );
    }
  });
});

describe('every fixture matches its golden report', () => {
  for (const { name, fixture } of fixtures) {
    it(name, async () => {
      const actual = await run(fixture);
      const codes = actual.findings.map((f) => f.code);
      if (fixture.expect === 'fail')
        expect(codes, `${name} must raise ${fixture.code}`).toContain(fixture.code);
      else {
        expect(codes, `${name} must not raise ${fixture.code}`).not.toContain(fixture.code);
        expect(actual.ok, `${name} must pass`).toBe(true);
      }
      for (const finding of actual.findings) {
        expect(['error', 'warning', 'info']).toContain(finding.severity);
        expect(finding.path?.length, `${name} ${finding.code}`).toBeGreaterThan(0);
      }
      golden(name, actual);
    });
  }
});

describe('hostile documents fail closed', () => {
  const base = {
    format: 'texuli/design-system',
    formatVersion: 1,
    id: 'harborline',
    version: '1.0.0',
    name: 'Harborline',
  };

  for (const file of readdirSync(join(ROOT, 'hostile')).sort()) {
    it(`hostile/${file}`, async () => {
      const fixture = JSON.parse(readFileSync(join(ROOT, 'hostile', file), 'utf8')) as Fixture;
      const report = await checkDesignSystemFull(fixture.document, { catalog });
      expect(report.ok).toBe(false);
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
      golden(`hostile.${file.replace(/\.json$/, '')}`, {
        ok: report.ok,
        codes: report.codes,
        findings: report.findings.map(project),
      });
    });
  }

  it('refuses values that are not documents', async () => {
    for (const value of [null, [], 'harborline', 42, true]) {
      const report = await checkDesignSystemFull(value, { catalog });
      expect(report.ok, JSON.stringify(value)).toBe(false);
      expect(report.codes).toContain('invalid-type');
    }
  });

  it('refuses a 5 MB name and a 10,000-deep object quickly, without throwing', async () => {
    const started = Date.now();
    const huge = await checkDesignSystemFull({ ...base, name: 'x'.repeat(5_000_000) }, { catalog });
    expect(huge.ok).toBe(false);
    let deep: Record<string, unknown> = {};
    const root = deep;
    for (let i = 0; i < 10_000; i++) {
      const next: Record<string, unknown> = {};
      deep.child = next;
      deep = next;
    }
    const nested = await checkDesignSystemFull({ ...base, voice: root }, { catalog });
    expect(nested.ok).toBe(false);
    expect(Date.now() - started).toBeLessThan(10_000);
  });

  it('caps the allow set and the findings of an oversized document', async () => {
    const allow = Object.fromEntries(Array.from({ length: 5_000 }, (_, i) => [`c-${i}`, {}]));
    const report = await checkDesignSystemFull({ ...base, allow }, { catalog });
    expect(report.ok).toBe(false);
    expect(report.findings.length).toBeLessThanOrEqual(256);
  });

  it('scans hostile prototypes without throwing', async () => {
    const big = `<script>import { Button } from 'texuli';</script>${'<Button variant="ghost">x</Button>'.repeat(40_000)}`;
    let tree: Record<string, unknown> = { id: 'card' };
    const blueprint = { tree };
    for (let i = 0; i < 10_000; i++) {
      const child: Record<string, unknown> = { id: 'card' };
      tree.children = [child];
      tree = child;
    }
    const report = await checkDesignSystemFull(
      { ...base, color: { brand: { seed: '#0e7490' } }, allow: { card: {} } },
      {
        catalog,
        prototype: {
          files: { 'src/Big.svelte': big, 'src/Odd.svelte': '<Button variant={' },
          blueprints: { deep: blueprint },
        },
      }
    );
    expect(report.ok).toBe(false);
    expect(report.findings.length).toBeLessThanOrEqual(256);
    // The 1.4 MB file is over the per-file cap: refused unread, as an error.
    expect(report.findings.filter((f) => f.code === 'file-too-large')).toMatchObject([
      { severity: 'error', area: 'prototype-limits', path: 'src/Big.svelte' },
    ]);
  });

  it('finishes a hostile prototype scan well under a second', async () => {
    const big = `<script>import { Button } from 'texuli';</script>${'<Button variant="ghost">x</Button>'.repeat(40_000)}`;
    // Just under the per-file cap: about 14,000 tags read in full, with fast line lookups.
    const near = `<script>import { Button } from 'texuli';</script>\n${'<Button variant="ghost">x</Button>\n'.repeat(14_000)}`;
    expect(near.length).toBeLessThan(DS_FULL_PROTOTYPE_LIMITS.fileBytes);
    const doc = {
      ...base,
      color: { brand: { seed: '#0e7490' } },
      allow: { button: { variants: ['default'] } },
    };
    await checkDesignSystemFull(doc, { catalog }); // warm the compiler and the catalog index
    const started = performance.now();
    const report = await checkDesignSystemFull(doc, {
      catalog,
      prototype: { files: { 'src/Big.svelte': big, 'src/Near.svelte': near } },
    });
    expect(performance.now() - started).toBeLessThan(1000);
    expect(
      report.findings.some((f) => f.code === 'file-too-large' && f.path === 'src/Big.svelte')
    ).toBe(true);
    expect(
      report.findings.some(
        (f) => f.code === 'variant-not-allowed' && f.path.startsWith('src/Near.svelte')
      )
    ).toBe(true);
  });

  it('caps the files, the total bytes, the blueprints and the findings of a prototype', async () => {
    const doc = {
      ...base,
      color: { brand: { seed: '#0e7490' } },
      allow: { button: { variants: ['default'] } },
    };
    const small = `<script>import { Button } from 'texuli';</script>\n<Button variant="ghost">x</Button>\n`;
    const many = Object.fromEntries(
      Array.from({ length: DS_FULL_PROTOTYPE_LIMITS.files + 3 }, (_, i) => [
        `src/P${String(i).padStart(4, '0')}.svelte`,
        small,
      ])
    );
    const count = await checkDesignSystemFull(doc, { catalog, prototype: { files: many } });
    expect(count.findings.find((f) => f.code === 'prototype-too-large')).toMatchObject({
      severity: 'error',
      area: 'prototype-limits',
      path: 'files',
      message: expect.stringContaining('3 file(s)'),
    });
    const chunk = `<script>import { Button } from 'texuli';</script>\n${' '.repeat(DS_FULL_PROTOTYPE_LIMITS.fileBytes - 100)}`;
    const heavy = Object.fromEntries(
      Array.from({ length: 20 }, (_, i) => [`src/H${i}.svelte`, chunk])
    );
    const bytes = await checkDesignSystemFull(doc, { catalog, prototype: { files: heavy } });
    expect(bytes.findings.some((f) => f.code === 'prototype-too-large' && f.path === 'files')).toBe(
      true
    );
    const blueprints = Object.fromEntries(
      Array.from({ length: DS_FULL_PROTOTYPE_LIMITS.blueprints + 1 }, (_, i) => [
        `b${i}`,
        { tree: { id: 'button' } },
      ])
    );
    const bp = await checkDesignSystemFull(doc, { catalog, prototype: { blueprints } });
    expect(
      bp.findings.some((f) => f.code === 'prototype-too-large' && f.path === 'blueprints')
    ).toBe(true);
    // Ten files with 100 disallowed variants each: the report stops at the finding cap.
    const noisy = `<script>import { Button } from 'texuli';</script>\n${'<Button variant="ghost">x</Button>\n'.repeat(100)}`;
    const capped = await checkDesignSystemFull(doc, {
      catalog,
      prototype: {
        files: Object.fromEntries(
          Array.from({ length: 10 }, (_, i) => [`src/N${i}.svelte`, noisy])
        ),
      },
    });
    expect(capped.findings.length).toBeLessThanOrEqual(256);
    expect(capped.summary.warnings + capped.summary.errors).toBeGreaterThan(0);
    expect(capped.findings.some((f) => f.code === 'findings-capped')).toBe(true);
    for (const code of ['file-too-large', 'prototype-too-large', 'findings-capped'])
      expect(DS_FULL_LIMIT_CODES).toContain(code);
  });
});
