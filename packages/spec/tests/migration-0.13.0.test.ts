/**
 * Spec 0.13.0 (ADR-032, locked design systems): an additive minor. The step from 0.12.0 stamps
 * `spec` only, so every 0.12.0 blueprint migrates losslessly; design-system documents keep
 * formatVersion 1 and need no migration; the version is pinned; and the Kotlin vocabulary
 * carries a component's axes and states only when the catalog declares them.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { SpecCatalog } from '../src/catalog.ts';
import { vocabularyToKotlin } from '../src/codegen/kotlin.ts';
import { migrateDesignSystem, validateDesignSystem } from '../src/design-system/index.ts';
import { type Schema, validateInstance } from '../src/dialect.ts';
import { migrateBlueprint, SPEC_MIGRATIONS } from '../src/migrations/index.ts';
import { validateBlueprint } from '../src/validate.ts';
import { SPEC_VERSION } from '../src/version.ts';
import type { SpecVersionHistory } from '../src/versioning.ts';
import { validateWorkflowGraph } from '../src/workflow.ts';
import { build, json, normative } from './helpers.ts';

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
};

describe('spec 0.13.0', () => {
  it('is the current version, with the 0.12.0 → 0.13.0 step last in the chain', () => {
    expect(SPEC_VERSION).toBe('0.13.0');
    expect(SPEC_MIGRATIONS.at(-1)).toMatchObject({ from: '0.12.0', to: '0.13.0' });
    for (let i = 1; i < SPEC_MIGRATIONS.length; i++)
      expect(SPEC_MIGRATIONS[i]?.from).toBe(SPEC_MIGRATIONS[i - 1]?.to);
  });

  it('migrates every golden blueprint written for 0.12.0 by stamping spec only', () => {
    const goldens = Object.keys(normative).filter((path) => path.startsWith('fixtures/golden/'));
    expect(goldens.length).toBeGreaterThan(10);
    for (const path of goldens) {
      const input: Readonly<Record<string, unknown>> = deepFreeze({
        ...json<Record<string, unknown>>(path),
        spec: '0.12.0',
      });
      const result = migrateBlueprint(input);
      expect(result, path).toMatchObject({
        from: '0.12.0',
        to: '0.13.0',
        applied: ['0.12.0->0.13.0'],
      });
      // Lossless: every field but spec is the same value, the tree the same object.
      expect(result.blueprint, path).toEqual({ ...input, spec: '0.13.0' });
      expect((result.blueprint as { tree: unknown }).tree, path).toBe(input.tree);
      // Idempotent.
      const again = migrateBlueprint(result.blueprint);
      expect(again.applied, path).toEqual([]);
      expect(again.blueprint, path).toBe(result.blueprint);
    }
  });

  it('keeps a migrated 0.12.0 blueprint valid against the 0.13.0 schema and catalog', () => {
    const documents = {
      blueprintSchema: json<Schema>('schemas/blueprint.schema.json'),
      catalog: json<SpecCatalog>('catalog/components.json'),
      workflowSchema: json<Schema>('schemas/workflow.schema.json'),
      validateWorkflowGraph,
    };
    const input = { ...json<Record<string, unknown>>('fixtures/golden/lego.json'), spec: '0.12.0' };
    const { blueprint } = migrateBlueprint(input);
    expect(validateBlueprint(blueprint, documents).ok).toBe(true);
    // An older chain start reaches 0.13.0 through every step.
    const legacy = migrateBlueprint({ ...input, spec: '0.11.0' });
    expect(legacy.applied).toEqual(['0.11.0->0.12.0', '0.12.0->0.13.0']);
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

  it('keeps the committed catalog valid against the 0.13.0 catalog schema', () => {
    const schema = json<Schema>('schemas/catalog.schema.json');
    expect(validateInstance(schema, json<SpecCatalog>('catalog/components.json'))).toEqual([]);
  });

  it('pins 0.13.0 as a minor release with the digest of the files built now', () => {
    const history = JSON.parse(
      readFileSync(join(import.meta.dirname, '../versions.json'), 'utf8')
    ) as SpecVersionHistory;
    const last = history.releases.at(-1);
    expect(last).toMatchObject({
      specVersion: '0.13.0',
      specDigest: build.stamp.specDigest,
      change: 'minor',
    });
    for (const term of ['allow', 'library', 'approval', 'axes', 'states', '0.12.0→0.13.0'])
      expect(last?.summary).toContain(term);
    for (const text of Object.values(build.generated))
      expect(text).toContain(`Spec 0.13.0, digest ${build.stamp.specDigest}`);
  });
});

describe('generated Kotlin vocabulary (0.13.0)', () => {
  const catalog = json<SpecCatalog>('catalog/components.json');
  const first = catalog.components[0];
  if (!first) throw new Error('empty catalog');

  it('emits a component’s axes and states when the catalog declares them', () => {
    const withAxes: SpecCatalog = {
      ...catalog,
      components: [
        {
          ...first,
          axes: {
            size: { prop: 'size', values: ['sm', 'md'], default: 'md' },
            variant: { prop: 'variant', values: ['default', 'outline'], default: 'default' },
          },
          states: ['hover', 'focus-visible'],
        },
      ],
    };
    const text = vocabularyToKotlin(withAxes, build.stamp);
    // Axes in canonical order (variant before size), whatever the input order.
    expect(text).toContain(
      'axes = SpecAxes(variant = SpecAxis(prop = "variant", values = listOf("default", "outline"), default = "default"), size = SpecAxis(prop = "size", values = listOf("sm", "md"), default = "md")),'
    );
    expect(text).toContain('states = listOf(SpecStateName.HOVER, SpecStateName.FOCUS_VISIBLE),');
  });

  it('leaves the vocabulary byte-stable for components without them', () => {
    const text = vocabularyToKotlin(catalog, build.stamp);
    expect(text).not.toContain('axes = ');
    expect(text).not.toContain('states = ');
    const committed = readFileSync(
      join(import.meta.dirname, '../generated/kotlin/com/texuli/spec/Vocabulary.kt'),
      'utf8'
    );
    expect(committed).toBe(text);
  });
});
