// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  isCatalogManifest,
  validateCatalogManifest,
  validateCatalogManifests,
} from '../src/manifest/index.ts';
import {
  type buttonPropNames,
  FORMS_MANIFESTS,
  FORMS_PROP_NAME_MAP,
  FORMS_PROP_NAMES,
  formsManifestsById,
} from '../src/manifests/forms/index.ts';

/** Assert schema prop names equal the canonical list (order-insensitive). */
function expectPropsMatch(
  manifestId: keyof typeof FORMS_PROP_NAMES,
  names: readonly string[]
): void {
  const manifest = formsManifestsById[manifestId];
  expect(manifest, `missing manifest ${manifestId}`).toBeDefined();
  const schemaNames = manifest!.props.map((prop) => prop.name).sort();
  expect(schemaNames).toEqual([...names].sort());
}

describe('forms manifests', () => {
  it('validates every form manifest as a closed set', () => {
    const result = validateCatalogManifests(FORMS_MANIFESTS);
    expect(result.diagnostics, JSON.stringify(result.diagnostics, null, 2)).toEqual([]);
    expect(result.valid).toBe(true);
    expect(FORMS_MANIFESTS.length).toBe(Object.keys(FORMS_PROP_NAMES).length);
    expect(new Set(FORMS_MANIFESTS.map((manifest) => manifest.id)).size).toBe(
      FORMS_MANIFESTS.length
    );
  });

  it('keeps every entry frozen, app-tier, and non-emittable by default', () => {
    for (const manifest of FORMS_MANIFESTS) {
      expect(isCatalogManifest(manifest)).toBe(true);
      expect(Object.isFrozen(manifest)).toBe(true);
      expect(manifest.package).toBe('texuli');
      expect(manifest.tier).toBe('app');
      expect(manifest.agentEmittable).toBe(false);
      expect(manifest.useWhen.length).toBeGreaterThan(0);
      expect(manifest.dontUseWhen.length).toBeGreaterThan(0);
      expect(manifest.examples.length).toBeGreaterThan(0);
      expect(validateCatalogManifest(manifest).valid).toBe(true);
      expect(formsManifestsById[manifest.id]).toBe(manifest);
    }
  });

  it('matches each component prop surface to its schema (type parity)', () => {
    for (const [id, names] of Object.entries(FORMS_PROP_NAMES)) {
      expectPropsMatch(id as keyof typeof FORMS_PROP_NAMES, names);
      expect(FORMS_PROP_NAME_MAP[id as keyof typeof FORMS_PROP_NAME_MAP]).toEqual(names);
    }
  });

  it('documents Button props used by Button.svelte', () => {
    // Compile-time anchor: buttonPropNames is the contract Button authors extend.
    type ButtonProp = (typeof buttonPropNames)[number];
    const required: ButtonProp[] = [
      'variant',
      'size',
      'href',
      'hrefTrust',
      'type',
      'disabled',
      'loading',
      'loadingLabel',
      'autoLoading',
      'label',
      'onclick',
      'class',
      'children',
    ];
    expect(required).toEqual([...FORMS_PROP_NAMES.button]);
  });

  it('rejects unknown example props against the schema', () => {
    const button = FORMS_MANIFESTS.find((manifest) => manifest.id === 'button')!;
    const broken = {
      ...button,
      examples: [{ id: 'x', title: 'X', props: { notAProp: true } }],
    };
    const result = validateCatalogManifest(broken);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === 'unknown-prop')).toBe(true);
  });
});

describe('combobox and multi-select manifests', () => {
  it('document the filter function and the form props agents need to read', () => {
    for (const id of ['combobox', 'multi-select']) {
      const manifest = formsManifestsById[id];
      expect(manifest, id).toBeDefined();
      expect(manifest!.agentEmittable).toBe(false);
      const props = new Map(manifest!.props.map((prop) => [prop.name, prop]));
      const filter = props.get('filter');
      expect(filter?.kind).toBe('unknown');
      expect(filter?.description).toMatch(/Function prop the host passes/);
      expect(filter?.description).toMatch(/Not agent-emittable/);
      expect(filter?.description).toMatch(/Replaces the default/);
      expect(props.get('name')?.kind).toBe('string');
      expect(props.get('required')).toMatchObject({ kind: 'boolean', default: false });
      expect(props.get('requiredMessage')?.kind).toBe('string');
      expect(props.get('form')?.kind).toBe('string');
      expect(props.get('disabled')).toMatchObject({ kind: 'boolean', default: false });
    }
    // MultiSelect is always multiple: the prop is not part of its surface.
    expect(formsManifestsById['multi-select']!.props.some((prop) => prop.name === 'multiple')).toBe(
      false
    );
  });
});
