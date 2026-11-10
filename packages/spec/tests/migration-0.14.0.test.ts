/**
 * Spec 0.14.0 (ADR-032, locked design systems; published in Texuli 0.16.0): an additive minor.
 * The step from 0.13.0 stamps `spec` only, so every 0.13.0 blueprint migrates losslessly to
 * 0.14.0; design-system documents keep formatVersion 1; and 0.14.0 stays pinned to the digest
 * published in Texuli 0.16.0. The current version is checked in migration-0.15.0.test.ts.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { SpecCatalog } from '../src/catalog.ts';
import { migrateDesignSystem, validateDesignSystem } from '../src/design-system/index.ts';
import { type Schema, validateInstance } from '../src/dialect.ts';
import { migrateBlueprint, SPEC_MIGRATIONS } from '../src/migrations/index.ts';
import { validateBlueprint } from '../src/validate.ts';
import type { SpecVersionHistory } from '../src/versioning.ts';
import { validateWorkflowGraph } from '../src/workflow.ts';
import { build, json, normative } from './helpers.ts';

const PUBLISHED_0130_DIGEST = '37897e1b4d669ca0f32ba49b4960c921e860c1bacb38a9f29a1072389708ffae';
const PUBLISHED_0140_DIGEST = '39b8e87b561ae37c3a3b3ef45b7cec29ad4b05fa9b01cd9032c1b9f05f383e24';

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
};

const history = (): SpecVersionHistory =>
  JSON.parse(
    readFileSync(join(import.meta.dirname, '../versions.json'), 'utf8')
  ) as SpecVersionHistory;

describe('spec 0.14.0', () => {
  it('keeps the 0.13.0 → 0.14.0 step in an unbroken chain', () => {
    expect(SPEC_MIGRATIONS.some((step) => step.from === '0.13.0' && step.to === '0.14.0')).toBe(
      true
    );
    for (let i = 1; i < SPEC_MIGRATIONS.length; i++)
      expect(SPEC_MIGRATIONS[i]?.from).toBe(SPEC_MIGRATIONS[i - 1]?.to);
  });

  it('migrates every golden blueprint written for 0.13.0 by stamping spec only', () => {
    const goldens = Object.keys(normative).filter((path) => path.startsWith('fixtures/golden/'));
    expect(goldens.length).toBeGreaterThan(10);
    for (const path of goldens) {
      const input: Readonly<Record<string, unknown>> = deepFreeze({
        ...json<Record<string, unknown>>(path),
        spec: '0.13.0',
      });
      const result = migrateBlueprint(input, '0.14.0');
      expect(result, path).toMatchObject({
        from: '0.13.0',
        to: '0.14.0',
        applied: ['0.13.0->0.14.0'],
      });
      // Lossless: every field but spec is the same value, the tree the same object.
      expect(result.blueprint, path).toEqual({ ...input, spec: '0.14.0' });
      expect((result.blueprint as { tree: unknown }).tree, path).toBe(input.tree);
      // Idempotent.
      const again = migrateBlueprint(result.blueprint, '0.14.0');
      expect(again.applied, path).toEqual([]);
      expect(again.blueprint, path).toBe(result.blueprint);
    }
  });

  it('keeps a migrated 0.13.0 blueprint valid against the current schema and catalog', () => {
    const documents = {
      blueprintSchema: json<Schema>('schemas/blueprint.schema.json'),
      catalog: json<SpecCatalog>('catalog/components.json'),
      workflowSchema: json<Schema>('schemas/workflow.schema.json'),
      validateWorkflowGraph,
    };
    const input = { ...json<Record<string, unknown>>('fixtures/golden/lego.json'), spec: '0.13.0' };
    const { blueprint } = migrateBlueprint(input, '0.14.0');
    expect(validateBlueprint(blueprint, documents).ok).toBe(true);
    // An older chain start reaches 0.14.0 through every step.
    const legacy = migrateBlueprint({ ...input, spec: '0.12.0' }, '0.14.0');
    expect(legacy.applied).toEqual(['0.12.0->0.13.0', '0.13.0->0.14.0']);
  });

  it('keeps every committed design-system document valid without a format migration', () => {
    const docs = Object.keys(normative).filter(
      (path) => path.startsWith('fixtures/design-systems/') && !path.includes('/invalid/')
    );
    expect(docs.length).toBeGreaterThan(0);
    for (const path of docs) {
      const doc = deepFreeze(json<Record<string, unknown>>(path));
      const migrated = migrateDesignSystem(doc);
      expect(migrated.ok, path).toBe(true);
      if (!migrated.ok) continue;
      expect(migrated.applied, path).toEqual([]);
      expect(migrated.document, path).toEqual(doc);
      expect(validateDesignSystem(migrated.document).ok, path).toBe(true);
    }
  });

  it('keeps the committed catalog valid against the current catalog schema', () => {
    const schema = json<Schema>('schemas/catalog.schema.json');
    expect(validateInstance(schema, json<SpecCatalog>('catalog/components.json'))).toEqual([]);
  });

  it('accepts 0.14.0 in the blueprint spec enum, after 0.13.0', () => {
    const text = normative['schemas/blueprint.schema.json'] as string;
    expect(text).toMatch(/"0\.13\.0",\s*"0\.14\.0",/);
  });

  it('keeps 0.13.0 and 0.14.0 pinned to the digests published in Texuli 0.15.0 and 0.16.0', () => {
    const releases = history().releases;
    expect(releases.find((release) => release.specVersion === '0.13.0')?.specDigest).toBe(
      PUBLISHED_0130_DIGEST
    );
    const pinned = releases.find((release) => release.specVersion === '0.14.0');
    expect(pinned).toMatchObject({ specDigest: PUBLISHED_0140_DIGEST, change: 'minor' });
    for (const term of ['color', 'colors', 'data-virtual-list', 'link', 'mark', '0.13.0→0.14.0'])
      expect(pinned?.summary).toContain(term);
    expect(build.stamp.specDigest).not.toBe(PUBLISHED_0140_DIGEST);
  });
});
