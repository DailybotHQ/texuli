// @vitest-environment node
import { expect, it } from 'vitest';
import {
  isCatalogManifest,
  validateCatalogManifest,
  validateCatalogManifests,
} from '../src/manifest/index.ts';
import {
  type cardPropNames,
  DISPLAY_MANIFESTS,
  DISPLAY_PROP_NAMES,
} from '../src/manifests/display/index.ts';

/** Assert schema prop names equal the canonical list (order-insensitive). */
function expectPropsMatch(
  manifestId: keyof typeof DISPLAY_PROP_NAMES,
  names: readonly string[]
): void {
  const manifest = DISPLAY_MANIFESTS.find((entry) => entry.id === manifestId);
  expect(manifest, `missing manifest ${manifestId}`).toBeDefined();
  const schemaNames = manifest!.props.map((prop) => prop.name).sort();
  expect(schemaNames).toEqual([...names].sort());
}

it('display manifests are a closed, frozen, app-tier set with schema parity', () => {
  // validates every display/feedback manifest as a closed set
  {
    const result = validateCatalogManifests(DISPLAY_MANIFESTS);
    expect(result.diagnostics, JSON.stringify(result.diagnostics, null, 2)).toEqual([]);
    expect(result.valid).toBe(true);
    expect(DISPLAY_MANIFESTS.length).toBe(Object.keys(DISPLAY_PROP_NAMES).length);
    expect(new Set(DISPLAY_MANIFESTS.map((m) => m.id)).size).toBe(DISPLAY_MANIFESTS.length);
  }
  for (const manifest of DISPLAY_MANIFESTS) {
    expect(isCatalogManifest(manifest)).toBe(true);
    expect(Object.isFrozen(manifest)).toBe(true);
    // inline-text is a catalog node (audit G03), not a texuli component.
    expect(manifest.package).toBe(manifest.id === 'inline-text' ? '@texuli/catalog' : 'texuli');
    expect(manifest.tier).toBe('app');
    expect(manifest.agentEmittable).toBe(false);
    expect(manifest.useWhen.length).toBeGreaterThan(0);
    expect(manifest.dontUseWhen.length).toBeGreaterThan(0);
    expect(manifest.examples.length).toBeGreaterThan(0);
    expect(validateCatalogManifest(manifest).valid).toBe(true);
  }
  for (const [id, names] of Object.entries(DISPLAY_PROP_NAMES)) {
    expectPropsMatch(id as keyof typeof DISPLAY_PROP_NAMES, names);
  }
  // documents Card props used by Card.svelte
  {
    // Compile-time anchor: cardPropNames is the contract Card authors extend.
    type CardProp = (typeof cardPropNames)[number];
    const required: CardProp[] = ['variant', 'href', 'hrefTrust', 'linkLabel', 'class'];
    expect(required).toEqual([...DISPLAY_PROP_NAMES.card]);
  }
  // rejects unknown example props against the schema
  {
    const card = DISPLAY_MANIFESTS.find((m) => m.id === 'card')!;
    const broken = {
      ...card,
      examples: [{ id: 'x', title: 'X', props: { notAProp: true } }],
    };
    const result = validateCatalogManifest(broken);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'unknown-prop')).toBe(true);
  }
});
