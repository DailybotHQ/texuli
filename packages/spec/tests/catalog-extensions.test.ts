/**
 * Host catalog extensions (T-catalog-extensions, ADR-032, amendment r15): a host library's
 * components in the catalog's component shape, ids `<ns>:<id>`, each composing catalog ids.
 * `mergeCatalogs` refuses bad extensions with stable codes and merges the rest; an `allow`
 * section can then enable, narrow or disable a namespaced id like a Texuli one; the allow
 * manifest records the merged catalog; the kit's matrix lists extension components. The
 * namespace `acme` is fictional.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { matrixModel } from '../../texuli/src/ds-kit/matrix/model.ts';
import { compileAllowManifest } from '../../tokens/src/design-system/allow-manifest.ts';
import type { SpecCatalog } from '../src/catalog.ts';
import {
  CATALOG_EXTENSION_CODES,
  CATALOG_EXTENSION_FORMAT,
  CATALOG_EXTENSION_LIMITS,
  mergeCatalogs,
} from '../src/catalog-extensions.ts';
import { checkConformance } from '../src/conformance.ts';
import { checkDesignSystemAllow, validateDesignSystem } from '../src/design-system/index.ts';
import { type Schema, validateInstance } from '../src/dialect.ts';
import { committedOutputs, json, normative } from './helpers.ts';

const texuli = json<SpecCatalog>('catalog/components.json');
const schema = json<Schema>('schemas/catalog.schema.json');
const extensionSchema = { ...(schema.$defs?.extension as Schema), $defs: schema.$defs };

/** A fictional host library: a KPI strip and a pricing card built from catalog ids. */
const acme = () => ({
  format: CATALOG_EXTENSION_FORMAT,
  version: 1,
  namespace: 'acme',
  components: [
    {
      id: 'acme:kpi-strip',
      label: 'KPI strip',
      summary: 'A row of key figures for a dashboard header.',
      group: 'display',
      placement: 'app',
      emit: [],
      capability: 'web-only',
      props: [
        { name: 'tone', kind: 'enum', enumValues: ['neutral', 'brand'] },
        { name: 'color', kind: 'enum', enumValues: ['none', 'chart-1'] },
        { name: 'items', kind: 'array', required: true },
      ],
      axes: {
        tone: { prop: 'tone', values: ['neutral', 'brand'], default: 'neutral' },
        color: { prop: 'color', values: ['none', 'chart-1'], default: 'none' },
      },
      states: ['hover', 'focus-visible'],
      composes: ['card', 'stat', 'text'],
    },
    {
      id: 'acme:pricing-card',
      label: 'Pricing card',
      summary: 'One plan with its price and a call to action.',
      group: 'display',
      placement: 'app',
      emit: [],
      capability: 'web-only',
      props: [],
      composes: ['card', 'heading', 'button', 'acme:kpi-strip'],
    },
  ],
});

const doc = (extra: Record<string, unknown>) => ({
  format: 'texuli/design-system',
  formatVersion: 1,
  id: 'harborline',
  version: '1.0.0',
  name: 'Harborline',
  color: { brand: { seed: '#0f766e' } },
  ...extra,
});

const codes = (extensions: unknown[]) =>
  mergeCatalogs(texuli, extensions).issues.map((i) => i.code);

describe('mergeCatalogs', () => {
  it('merges a host extension: namespaced ids, composes that resolve, host-only tiers', () => {
    expect(validateInstance(extensionSchema, acme())).toEqual([]);
    const merged = mergeCatalogs(texuli, [acme()]);
    expect(merged.issues).toEqual([]);
    expect(merged.ok).toBe(true);
    expect(merged.catalog.components).toHaveLength(texuli.components.length + 2);
    const strip = merged.catalog.components.find((c) => c.id === 'acme:kpi-strip');
    expect(strip).toMatchObject({
      placement: 'app',
      emit: [],
      capability: 'web-only',
      composes: ['card', 'stat', 'text'],
      states: ['hover', 'focus-visible'],
    });
    // Props sorted, like the projection; ids sorted across the merge.
    expect(strip?.props.map((p) => p.name)).toEqual(['color', 'items', 'tone']);
    const ids = merged.catalog.components.map((c) => c.id);
    expect(ids).toEqual([...ids].sort());
    expect(merged.extensions).toEqual([
      { namespace: 'acme', digest: expect.stringMatching(/^[0-9a-f]{64}$/) },
    ]);
    // The merged catalog is a valid catalog document, with a new, stable hash.
    expect(validateInstance(schema, merged.catalog)).toEqual([]);
    expect(merged.catalog.catalogHash).not.toBe(texuli.catalogHash);
    expect(mergeCatalogs(texuli, [acme()]).catalog.catalogHash).toBe(merged.catalog.catalogHash);
    // Nothing to merge: the Texuli catalog, unchanged.
    expect(mergeCatalogs(texuli, []).catalog).toEqual(texuli);
  });

  it('refuses collisions, unknown composes and bad namespaces with stable codes', () => {
    const one = acme();
    const twice = { ...acme(), components: [one.components[0], one.components[0]] };
    expect(codes([twice])).toEqual(['extension-collision']);
    expect(codes([acme(), acme()])).toEqual(['extension-collision']);
    const shadow = { ...acme(), components: [{ ...one.components[0], id: 'button' }] };
    expect(codes([shadow])).toEqual(['extension-id']);
    const other = { ...acme(), components: [{ ...one.components[0], id: 'globex:kpi' }] };
    expect(codes([other])).toEqual(['extension-id']);
    for (const namespace of ['texuli', 'A', 'x', 'way-too-long-namespace', '', undefined])
      expect(codes([{ ...acme(), namespace }]), String(namespace)).toEqual(['extension-namespace']);
    const unknown = {
      ...acme(),
      components: [{ ...one.components[0], composes: ['ghost-widget'] }],
    };
    expect(codes([unknown])).toEqual(['extension-composes']);
    const self = {
      ...acme(),
      components: [{ ...one.components[0], composes: ['acme:kpi-strip'] }],
    };
    expect(codes([self])).toEqual(['extension-composes']);
    const leaf = { ...acme(), components: [{ ...one.components[0], composes: [] }] };
    expect(validateInstance(extensionSchema, leaf)).toEqual([]);
    const mergedLeaf = mergeCatalogs(texuli, [leaf]);
    expect(mergedLeaf.ok).toBe(true);
    expect(
      mergedLeaf.catalog.components.find((component) => component.id === 'acme:kpi-strip')
    ).toMatchObject({ composes: [] });
    const missing = { ...acme(), components: [{ ...one.components[0], composes: undefined }] };
    expect(codes([missing])).toEqual(['extension-composes']);
    expect(CATALOG_EXTENSION_CODES).toContain('extension-composes');
  });

  it('checks props, axes and states like the catalog does', () => {
    const one = acme().components[0] as Record<string, unknown>;
    const at = (patch: Record<string, unknown>) => ({
      ...acme(),
      components: [{ ...one, ...patch }],
    });
    expect(codes([at({ props: [{ name: 'x', kind: 'html' }] })])).toEqual(['extension-props']);
    expect(codes([at({ props: [{ name: 'x', kind: 'string', schema: {} }] })])).toEqual([
      'extension-props',
    ]);
    expect(
      codes([
        at({ axes: { tone: { prop: 'tone', values: ['brand', 'neutral'], default: 'neutral' } } }),
      ])
    ).toEqual(['extension-axis']);
    expect(
      codes([
        at({ axes: { tone: { prop: 'tone', values: ['neutral', 'brand'], default: 'loud' } } }),
      ])
    ).toEqual(['extension-axis']);
    expect(codes([at({ states: ['hover', 'pressed'] })])).toEqual(['extension-state']);
    expect(codes([at({ emit: ['untrusted'] })])).toEqual(['extension-format']);
    expect(codes([at({ events: ['press'] })])).toEqual(['extension-format']);
    expect(codes([at({ placement: undefined })])).toEqual(['extension-format']);
    expect(codes([at({ onclick: 'x' })])).toEqual(['extension-format']);
  });

  it('treats extensions as untrusted input and refuses a bad one whole', () => {
    expect(codes([null, 'x', { format: 'other' }])).toEqual([
      'extension-format',
      'extension-format',
      'extension-format',
    ]);
    const many = Array.from({ length: CATALOG_EXTENSION_LIMITS.extensions + 1 }, (_, i) => ({
      ...acme(),
      namespace: `acme${i}`,
      components: [{ ...acme().components[0], id: `acme${i}:kpi-strip` }],
    }));
    expect(codes(many)).toEqual(['extension-oversize']);
    const big = {
      ...acme(),
      components: Array.from({ length: CATALOG_EXTENSION_LIMITS.components + 1 }, (_, i) => ({
        ...acme().components[0],
        id: `acme:kpi-${i}`,
      })),
    };
    expect(codes([big])).toEqual(['extension-oversize']);
    const cyclic: Record<string, unknown> = { ...acme() };
    cyclic.self = cyclic;
    expect(codes([cyclic])).toEqual(['extension-format']);
    const proto = JSON.parse(
      `{"format":"${CATALOG_EXTENSION_FORMAT}","version":1,"namespace":"acme","components":[{"__proto__":{"x":1},"id":"acme:a","label":"A","summary":"S.","group":"display","placement":"app","emit":[],"capability":"web-only","props":[],"composes":["card"]}]}`
    );
    expect(codes([proto])).toEqual(['extension-format']);
    // One bad component refuses its extension; a good extension beside it still merges.
    const bad = { ...acme(), components: [acme().components[0], { id: 'acme:x' }] };
    const globex = {
      ...acme(),
      namespace: 'globex',
      components: [{ ...acme().components[0], id: 'globex:kpi' }],
    };
    const merged = mergeCatalogs(texuli, [bad, globex]);
    expect(merged.ok).toBe(false);
    expect(merged.catalog.components.some((c) => c.id.startsWith('acme:'))).toBe(false);
    expect(merged.catalog.components.some((c) => c.id === 'globex:kpi')).toBe(true);
    // An extension composing a refused one is refused too (no dangling id).
    const dependent = {
      ...acme(),
      namespace: 'initech',
      components: [{ ...acme().components[0], id: 'initech:panel', composes: ['acme:kpi-strip'] }],
    };
    const chained = mergeCatalogs(texuli, [bad, dependent]);
    expect(chained.catalog.components.some((c) => c.id.startsWith('initech:'))).toBe(false);
    expect(chained.issues.map((i) => i.code)).toContain('extension-composes');
  });

  it('keeps namespaced ids and composes out of the Texuli catalog itself', () => {
    const merged = mergeCatalogs(texuli, [acme()]);
    const edited = { ...normative, 'catalog/components.json': JSON.stringify(merged.catalog) };
    const messages = checkConformance(edited, committedOutputs()).map((i) => i.message);
    expect(messages.some((m) => m.includes('acme:kpi-strip: a namespaced id or composes'))).toBe(
      true
    );
  });
});

describe('allow sets over the merged catalog', () => {
  const merged = mergeCatalogs(texuli, [acme()]).catalog;

  it('accepts namespaced allow keys and library composes in the document', () => {
    const locked = doc({
      allow: {
        button: {},
        'acme:kpi-strip': { tones: ['brand'], colors: ['none'] },
        'acme:pricing-card': {},
      },
      library: [
        {
          id: 'plan-picker',
          name: 'Plan picker',
          purpose: 'Choose a plan.',
          version: '0.1.0',
          status: 'draft',
          composes: ['acme:pricing-card', 'button'],
        },
      ],
    });
    expect(validateDesignSystem(locked).errors).toEqual([]);
    expect(validateDesignSystem(doc({ allow: { 'Acme:Kpi': {} } })).ok).toBe(false);
    expect(validateDesignSystem(doc({ allow: { 'acme:kpi:x': {} } })).ok).toBe(false);
    // Library ids stay plain kebab-case.
    expect(
      validateDesignSystem(
        doc({
          library: [
            {
              id: 'acme:plan',
              name: 'Plan',
              purpose: 'x',
              version: '0.1.0',
              status: 'draft',
              composes: ['button'],
            },
          ],
        })
      ).ok
    ).toBe(false);
    expect(checkDesignSystemAllow(locked, merged).errors).toEqual([]);
  });

  it('enables, narrows and disables extension components, and refuses what the merge lacks', () => {
    expect(
      checkDesignSystemAllow(doc({ allow: { 'acme:kpi-strip': { tones: [] } } }), merged).errors
    ).toEqual([]);
    expect(
      checkDesignSystemAllow(
        doc({ allow: { 'acme:kpi-strip': { tones: ['loud'] } } }),
        merged
      ).errors.map((e) => [e.code, e.path])
    ).toEqual([['unknown-tone', '$.allow["acme:kpi-strip"].tones[0]']]);
    expect(
      checkDesignSystemAllow(doc({ allow: { 'acme:ghost': {} } }), merged).errors.map((e) => e.code)
    ).toEqual(['unknown-component']);
    // Without the merge, the namespaced id is unknown to the Texuli catalog.
    expect(
      checkDesignSystemAllow(doc({ allow: { 'acme:kpi-strip': {} } }), texuli).errors.map(
        (e) => e.code
      )
    ).toEqual(['unknown-component']);
  });

  it('records the merged catalog in the allow manifest', () => {
    const result = mergeCatalogs(texuli, [acme()]);
    const manifest = compileAllowManifest(doc({ allow: { 'acme:kpi-strip': {} } }), {
      catalog: result,
    });
    expect(manifest.allow).toEqual({ 'acme:kpi-strip': {} });
    expect(manifest.catalogDigest).toBe(result.catalog.catalogHash);
    expect(manifest.extensions).toEqual(['acme']);
    expect(compileAllowManifest(doc({}), {}).extensions).toBeUndefined();
  });

  it('lists extension components in the kit matrix, enabled or disabled by the allow set', () => {
    const open = matrixModel(merged);
    expect(open.enabled.map((c) => c.id)).toContain('acme:kpi-strip');
    const locked = matrixModel(merged, {
      version: '1.0.0',
      allow: { 'acme:kpi-strip': { tones: ['brand'] } },
    });
    expect(locked.enabled.map((c) => c.id)).toEqual(['acme:kpi-strip']);
    expect(locked.issues).toEqual([]);
    expect(JSON.stringify(locked.enabled[0])).toContain('brand');
    expect(
      matrixModel(texuli, { version: '1.0.0', allow: { 'acme:kpi-strip': {} } }).issues
    ).toEqual([{ code: 'unknown-component', id: 'acme:kpi-strip' }]);
  });
});

describe('the committed design-system schema', () => {
  it('writes the namespaced allow-key pattern', () => {
    const ds = JSON.parse(
      readFileSync(join(import.meta.dirname, '../schemas/design-system.schema.json'), 'utf8')
    ) as Record<string, unknown>;
    expect(JSON.stringify(ds)).toContain('(?:[a-z][a-z0-9]{1,15}:)?');
  });
});
