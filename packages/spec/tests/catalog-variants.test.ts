/**
 * Catalog variants, sizes and states (ADR-032, spec 0.13.0): the optional `axes` and `states`
 * of a catalog component, authored in a manifest or in a per-group variants file, merged by the
 * projection into `catalog/components.json`. Axes derive from the component's enum props, so a
 * drift between an axis and its prop fails with a stable code; defaults are among the values;
 * states come from one closed list.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildCatalog } from '@texuli/catalog/build';
import {
  CATALOG_AXIS_NAMES,
  CATALOG_STATE_NAMES,
  manifestData,
  validateCatalogManifest,
} from '@texuli/catalog/manifest';
import { ALL_MANIFEST_GROUPS } from '@texuli/catalog/manifests/all';
import { describe, expect, it } from 'vitest';
import {
  type BuiltCatalogLike,
  CATALOG_VARIANTS_CODES,
  CATALOG_VARIANTS_FORMAT,
  CatalogVariantsError,
  type CatalogVariantsFile,
  checkCatalogVariants,
  mergeCatalogVariants,
  projectCatalog,
  SPEC_AXIS_NAMES,
  SPEC_STATE_NAMES,
  type SpecCatalog,
} from '../src/catalog.ts';
import { checkConformance } from '../src/conformance.ts';
import { type Schema, validateInstance } from '../src/dialect.ts';
import { committedOutputs, normative } from './helpers.ts';

const SPEC = join(import.meta.dirname, '..');
const json = <T>(rel: string) => JSON.parse(readFileSync(join(SPEC, rel), 'utf8')) as T;
const schema = json<Schema>('schemas/catalog.schema.json');
const HASH = 'a'.repeat(64);

type Entry = BuiltCatalogLike['entries'][number];
const entry = (id: string, props: Entry['props'], extra: Partial<Entry> = {}): Entry => ({
  id,
  label: id,
  summary: `The ${id} fixture.`,
  group: 'forms',
  tier: 'app',
  emit: ['developer'],
  props,
  ...extra,
});

/** Two fictional components: one with both axes and a default, one whose density has none. */
const FIXTURE: BuiltCatalogLike = {
  entries: [
    entry(
      'fixture-button',
      [
        { name: 'variant', kind: 'enum', enumValues: ['default', 'outline'], default: 'default' },
        { name: 'size', kind: 'enum', enumValues: ['sm', 'md', 'lg'], default: 'md' },
        { name: 'label', kind: 'string' },
      ],
      { axes: { variant: 'variant', size: 'size' }, states: ['disabled', 'hover', 'focus-visible'] }
    ),
    entry('fixture-grid', [
      { name: 'density', kind: 'enum', enumValues: ['comfortable', 'compact'] },
      { name: 'mode', kind: 'enum', enumValues: ['view', 'edit'], default: 'view' },
      { name: 'rows', kind: 'array' },
    ]),
    entry('fixture-card', [{ name: 'title', kind: 'string' }]),
  ],
};

const file = (
  name: string,
  components: CatalogVariantsFile['components']
): CatalogVariantsFile => ({
  format: CATALOG_VARIANTS_FORMAT,
  version: 1,
  name,
  components,
});

const codes = (files: readonly unknown[], catalog: BuiltCatalogLike = FIXTURE) =>
  mergeCatalogVariants(catalog, files).issues.map((issue) => issue.code);

describe('catalog variants: projection', () => {
  it('derives axis values from the enum prop and the default from the manifest', () => {
    const catalog = projectCatalog(FIXTURE, HASH, {}, [
      file('part-c', {
        'fixture-grid': {
          axes: { density: { prop: 'density', default: 'comfortable' } },
          states: ['selected', 'focus-visible', 'readonly'],
        },
      }),
    ]);
    const [button, card, grid] = catalog.components;
    expect(button?.axes).toEqual({
      variant: { prop: 'variant', values: ['default', 'outline'], default: 'default' },
      size: { prop: 'size', values: ['sm', 'md', 'lg'], default: 'md' },
    });
    // States are kept in the canonical order of the closed list.
    expect(button?.states).toEqual(['hover', 'focus-visible', 'disabled']);
    // A per-group file fills the default the manifest prop lacks.
    expect(grid?.axes).toEqual({
      density: { prop: 'density', values: ['comfortable', 'compact'], default: 'comfortable' },
    });
    expect(grid?.states).toEqual(['focus-visible', 'selected', 'readonly']);
    // A component without a declaration gets neither field, so old output is unchanged.
    expect(card).not.toHaveProperty('axes');
    expect(card).not.toHaveProperty('states');
    // Other enums stay plain props.
    expect(grid?.axes).not.toHaveProperty('mode');
    expect(validateInstance(schema, catalog)).toEqual([]);
    expect(checkCatalogVariants(catalog)).toEqual([]);
  });

  it('merges several per-group files, each id declared once', () => {
    const merged = mergeCatalogVariants(FIXTURE, [
      file('part-b', { 'fixture-card': { states: [] } }),
      file('part-c', {
        'fixture-grid': { axes: { density: { prop: 'density', default: 'compact' } } },
      }),
    ]);
    expect(merged.issues).toEqual([]);
    expect([...merged.byId.keys()].sort()).toEqual([
      'fixture-button',
      'fixture-card',
      'fixture-grid',
    ]);
    expect(
      codes([
        file('part-a', { 'fixture-card': { states: ['hover'] } }),
        file('part-b', { 'fixture-card': { states: ['hover'] } }),
        // Declared in its manifest already.
        file('part-c', { 'fixture-button': { states: ['hover'] } }),
      ])
    ).toEqual(['variants-duplicate-component', 'variants-duplicate-component']);
  });

  it('projects real manifests through the catalog build', async () => {
    const forms = ALL_MANIFEST_GROUPS.find((group) => group.name === 'forms');
    const button = forms?.manifests.find((manifest) => manifest.id === 'button');
    expect(button).toBeDefined();
    if (!forms || !button) return;
    const authored = manifestData({
      ...button,
      axes: { variant: 'variant', size: 'size' },
      states: ['hover', 'focus-visible', 'disabled', 'loading'],
    });
    expect(validateCatalogManifest(authored).diagnostics).toEqual([]);
    const build = await buildCatalog([{ name: 'forms', manifests: [authored] }]);
    const catalog = projectCatalog(build.catalog, build.hash);
    const variant = button.props.find((prop) => prop.name === 'variant');
    const size = button.props.find((prop) => prop.name === 'size');
    expect(catalog.components[0]?.axes).toEqual({
      variant: { prop: 'variant', values: variant?.enumValues, default: variant?.default },
      size: { prop: 'size', values: size?.enumValues, default: size?.default },
    });
    expect(catalog.components[0]?.states).toEqual([
      'hover',
      'focus-visible',
      'disabled',
      'loading',
    ]);
    expect(validateInstance(schema, catalog)).toEqual([]);
  });

  it('leaves the committed catalog valid while no component declares variants yet', () => {
    const committed = json<SpecCatalog>('catalog/components.json');
    expect(checkCatalogVariants(committed)).toEqual([]);
    const committedFiles = committedOutputs();
    expect(checkConformance(normative, committedFiles)).toEqual([]);
    // Conformance reports a drifted axis with its stable code.
    const drifted = JSON.parse(JSON.stringify(projectCatalog(FIXTURE, HASH))) as SpecCatalog;
    const axis = drifted.components[0]?.axes?.size;
    if (axis) axis.values = ['md'];
    const edited = { ...normative, 'catalog/components.json': JSON.stringify(drifted) };
    expect(
      checkConformance(edited, committedFiles)
        .filter((issue) => issue.check === 'variants')
        .map((issue) => issue.code)
    ).toEqual(['variants-axis-drift']);
  });
});

describe('catalog variants: drift and defaults', () => {
  const projected = () => projectCatalog(FIXTURE, HASH);
  const button = (catalog: SpecCatalog) => {
    const found = catalog.components.find((c) => c.id === 'fixture-button');
    if (!found) throw new Error('fixture-button');
    return found;
  };

  it('detects an axis that no longer matches its prop (variants-axis-drift)', () => {
    // The prop gains a value after projection.
    const grown = projected();
    const variant = button(grown).props.find((p) => p.name === 'variant');
    if (variant) variant.enumValues = ['default', 'outline', 'ghost'];
    expect(checkCatalogVariants(grown).map((i) => [i.code, i.path])).toEqual([
      ['variants-axis-drift', 'catalog/components.json:fixture-button.axes.variant'],
    ]);
    // The axis values are reordered or edited by hand.
    const edited = projected();
    const axis = button(edited).axes?.size;
    if (axis) axis.values = ['lg', 'md', 'sm'];
    expect(checkCatalogVariants(edited).map((i) => i.code)).toEqual(['variants-axis-drift']);
    // The prop is removed or stops being an enum.
    const removed = projected();
    button(removed).props = button(removed).props.filter((p) => p.name !== 'size');
    expect(checkCatalogVariants(removed).map((i) => i.code)).toEqual(['variants-axis-drift']);
    // Conformance reports the same stable code.
    expect(CATALOG_VARIANTS_CODES).toContain('variants-axis-drift');
  });

  it('keeps every default among the axis values (variants-axis-default)', () => {
    const catalog = projected();
    const axis = button(catalog).axes?.variant;
    if (axis) axis.default = 'ghost';
    expect(checkCatalogVariants(catalog).map((i) => i.code)).toEqual(['variants-axis-default']);
    // A source default outside the values, or one that contradicts the prop default.
    expect(
      codes([
        file('part-c', {
          'fixture-grid': { axes: { density: { prop: 'density', default: 'airy' } } },
        }),
      ])
    ).toEqual(['variants-axis-default']);
    const contradicts = mergeCatalogVariants(
      { entries: FIXTURE.entries.map((e) => ({ ...e, axes: undefined, states: undefined })) },
      [file('part-a', { 'fixture-button': { axes: { size: { prop: 'size', default: 'lg' } } } })]
    );
    expect(contradicts.issues.map((i) => i.code)).toEqual(['variants-axis-default']);
    // No default anywhere: the projection refuses it.
    expect(() =>
      projectCatalog(FIXTURE, HASH, {}, [
        file('part-c', { 'fixture-grid': { axes: { density: 'density' } } }),
      ])
    ).toThrow(CatalogVariantsError);
  });

  it('refuses an axis on a prop that is missing or not an enum (variants-axis-prop)', () => {
    expect(
      codes([
        file('part-c', {
          'fixture-grid': { axes: { size: 'size', density: { prop: 'rows', default: 'x' } } },
        }),
      ])
    ).toEqual(['variants-axis-prop', 'variants-axis-prop']);
  });
});

describe('catalog variants: states and source files', () => {
  it('keeps states to the closed list, each once', () => {
    expect(
      codes([
        file('part-b', {
          'fixture-card': { states: ['hover', 'pressed', 'hover', 'focus'] },
        }),
      ])
    ).toEqual(['variants-unknown-state', 'variants-duplicate-state', 'variants-unknown-state']);
    // The schema refuses an unknown state in components.json.
    const catalog = projectCatalog(FIXTURE, HASH);
    const bad = JSON.parse(JSON.stringify(catalog)) as { components: { states?: string[] }[] };
    if (bad.components[0]) bad.components[0].states = ['hover', 'pressed'];
    expect(validateInstance(schema, bad).length).toBeGreaterThan(0);
    // ... and a duplicate through the contract check.
    const twice = projectCatalog(FIXTURE, HASH);
    if (twice.components[0]) twice.components[0].states = ['hover', 'hover'];
    expect(checkCatalogVariants(twice).map((i) => i.code)).toEqual(['variants-duplicate-state']);
  });

  it('names the same axes and states in the schema, the spec and the catalog manifests', () => {
    const defs = schema.$defs ?? {};
    expect(Object.keys(defs.axes?.properties ?? {})).toEqual([...SPEC_AXIS_NAMES]);
    expect(defs.stateName?.enum).toEqual([...SPEC_STATE_NAMES]);
    expect([...CATALOG_AXIS_NAMES]).toEqual([...SPEC_AXIS_NAMES]);
    expect([...CATALOG_STATE_NAMES]).toEqual([...SPEC_STATE_NAMES]);
    expect(SPEC_STATE_NAMES).toHaveLength(11);
  });

  it('treats a variants file as untrusted input with stable codes', () => {
    expect(codes([{ format: 'other', version: 1, components: {} }])).toEqual(['variants-format']);
    expect(codes([null, 'x'])).toEqual(['variants-format', 'variants-format']);
    expect(codes([{ ...file('part-a', {}), extra: true }])).toEqual(['variants-format']);
    expect(
      codes([
        file('part-a', {
          'not-in-catalog': { states: [] },
          'fixture-card': { axes: { color: 'x' } as never },
        }),
      ])
    ).toEqual(['variants-unknown-axis', 'variants-unknown-component']);
    expect(
      codes([file('part-a', { 'fixture-card': { states: [], theme: 'dark' } as never })])
    ).toEqual(['variants-format']);
    const many = Object.fromEntries(Array.from({ length: 513 }, (_, i) => [`x-${i}`, {}]));
    expect(codes([file('part-a', many)])).toEqual(['variants-oversize']);
    // A prototype key is data, not a merge target.
    expect(
      codes([
        JSON.parse(
          `{"format":"${CATALOG_VARIANTS_FORMAT}","version":1,"components":{"__proto__":{"states":["hover"]}}}`
        ),
      ])
    ).toEqual(['variants-unknown-component']);
  });

  it('validates axes and states in an authored manifest with stable codes', () => {
    const forms = ALL_MANIFEST_GROUPS.find((group) => group.name === 'forms');
    const button = forms?.manifests.find((manifest) => manifest.id === 'button');
    if (!button) throw new Error('button manifest');
    const diag = (extra: Record<string, unknown>) =>
      validateCatalogManifest({ ...button, ...extra }).diagnostics.map((d) => d.code);
    expect(diag({ axes: { variant: 'variant' }, states: ['hover'] })).toEqual([]);
    expect(diag({ axes: { color: 'variant' } })).toEqual(['invalid-axis']);
    expect(diag({ axes: { variant: 'label' } })).toEqual(['axis-prop']);
    expect(diag({ states: ['hover', 'hover', 'pressed'] })).toEqual([
      'duplicate-state',
      'invalid-state',
    ]);
    expect(diag({ axes: 'variant' })).toEqual(['invalid-type']);
    const noDefault = {
      ...button,
      props: button.props.map((p) => (p.name === 'size' ? { ...p, default: undefined } : p)),
      axes: { size: 'size' },
    };
    expect(validateCatalogManifest(noDefault).diagnostics.map((d) => d.code)).toEqual([
      'axis-default',
    ]);
  });
});
