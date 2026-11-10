/**
 * Spec 0.15.0 (ADR-032, Texuli 0.17.0): an additive minor. The published 0.14.0 pin is
 * untouched; the step from 0.14.0 stamps `spec` only, so every 0.14.0 blueprint migrates
 * losslessly; design-system documents keep formatVersion 1; and the catalog props a patch could
 * not carry (the data-virtual-list mode and selectable) are pinned as 0.15.0.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { SpecCatalog } from '../src/catalog.ts';
import { migrateDesignSystem, validateDesignSystem } from '../src/design-system/index.ts';
import { type Schema, validateInstance } from '../src/dialect.ts';
import { migrateBlueprint, SPEC_MIGRATIONS } from '../src/migrations/index.ts';
import { validateBlueprint } from '../src/validate.ts';
import { SPEC_VERSION } from '../src/version.ts';
import type { SpecVersionHistory } from '../src/versioning.ts';
import { validateWorkflowGraph } from '../src/workflow.ts';
import { build, json, normative } from './helpers.ts';

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

describe('spec 0.15.0', () => {
  it('is the current version, with the 0.14.0 → 0.15.0 step last in the chain', () => {
    expect(SPEC_VERSION).toBe('0.15.0');
    expect(SPEC_MIGRATIONS.at(-1)).toMatchObject({ from: '0.14.0', to: '0.15.0' });
    for (let i = 1; i < SPEC_MIGRATIONS.length; i++)
      expect(SPEC_MIGRATIONS[i]?.from).toBe(SPEC_MIGRATIONS[i - 1]?.to);
  });

  it('migrates every golden blueprint written for 0.14.0 by stamping spec only', () => {
    const goldens = Object.keys(normative).filter((path) => path.startsWith('fixtures/golden/'));
    expect(goldens.length).toBeGreaterThan(10);
    for (const path of goldens) {
      const input: Readonly<Record<string, unknown>> = deepFreeze({
        ...json<Record<string, unknown>>(path),
        spec: '0.14.0',
      });
      const result = migrateBlueprint(input);
      expect(result, path).toMatchObject({
        from: '0.14.0',
        to: '0.15.0',
        applied: ['0.14.0->0.15.0'],
      });
      // Lossless: every field but spec is the same value, the tree the same object.
      expect(result.blueprint, path).toEqual({ ...input, spec: '0.15.0' });
      expect((result.blueprint as { tree: unknown }).tree, path).toBe(input.tree);
      // Idempotent.
      const again = migrateBlueprint(result.blueprint);
      expect(again.applied, path).toEqual([]);
      expect(again.blueprint, path).toBe(result.blueprint);
    }
  });

  it('keeps a migrated 0.14.0 blueprint valid against the 0.15.0 schema and catalog', () => {
    const documents = {
      blueprintSchema: json<Schema>('schemas/blueprint.schema.json'),
      catalog: json<SpecCatalog>('catalog/components.json'),
      workflowSchema: json<Schema>('schemas/workflow.schema.json'),
      validateWorkflowGraph,
    };
    const input = { ...json<Record<string, unknown>>('fixtures/golden/lego.json'), spec: '0.14.0' };
    const { blueprint } = migrateBlueprint(input);
    expect(validateBlueprint(blueprint, documents).ok).toBe(true);
    // An older chain start reaches 0.15.0 through every step.
    const legacy = migrateBlueprint({ ...input, spec: '0.13.0' });
    expect(legacy.applied).toEqual(['0.13.0->0.14.0', '0.14.0->0.15.0']);
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

  it('keeps the committed catalog valid against the 0.15.0 catalog schema', () => {
    const schema = json<Schema>('schemas/catalog.schema.json');
    expect(validateInstance(schema, json<SpecCatalog>('catalog/components.json'))).toEqual([]);
  });

  it('accepts 0.15.0 in the blueprint spec enum, after 0.14.0', () => {
    const text = normative['schemas/blueprint.schema.json'] as string;
    expect(text).toMatch(/"0\.14\.0",\s*"0\.15\.0"\s*\]/);
  });

  it('leaves the published 0.14.0 pin as released and pins 0.15.0 to the files built now', () => {
    const releases = history().releases;
    expect(releases.find((release) => release.specVersion === '0.14.0')?.specDigest).toBe(
      PUBLISHED_0140_DIGEST
    );
    expect(build.stamp.specDigest).not.toBe(PUBLISHED_0140_DIGEST);
    const last = releases.at(-1);
    expect(last).toMatchObject({
      specVersion: '0.15.0',
      specDigest: build.stamp.specDigest,
      change: 'minor',
    });
    for (const term of ['data-virtual-list', 'mode', 'feed', 'selectable', '0.14.0→0.15.0'])
      expect(last?.summary).toContain(term);
    for (const text of Object.values(build.generated))
      expect(text).toContain(`Spec 0.15.0, digest ${build.stamp.specDigest}`);
  });
});
