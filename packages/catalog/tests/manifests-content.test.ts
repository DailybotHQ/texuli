// @vitest-environment node

import { expect, it } from 'vitest';
import {
  isCatalogManifest,
  validateCatalogManifest,
  validateCatalogManifests,
} from '../src/manifest/index.ts';
import {
  CONTENT_MANIFESTS,
  CONTENT_PROP_NAME_MAP,
  CONTENT_PROP_NAMES,
  contentManifestsById,
} from '../src/manifests/content/index.ts';

it('content, chart and media manifests are a closed, frozen, content-tier set with schema parity', () => {
  // validates every content, chart and media manifest as a closed set
  {
    const result = validateCatalogManifests(CONTENT_MANIFESTS);
    expect(result.diagnostics, JSON.stringify(result.diagnostics, null, 2)).toEqual([]);
    expect(result.valid).toBe(true);
    expect(CONTENT_MANIFESTS.length).toBe(Object.keys(CONTENT_PROP_NAMES).length);
    expect(new Set(CONTENT_MANIFESTS.map((manifest) => manifest.id)).size).toBe(
      CONTENT_MANIFESTS.length
    );
  }
  for (const manifest of CONTENT_MANIFESTS) {
    expect(isCatalogManifest(manifest)).toBe(true);
    expect(Object.isFrozen(manifest)).toBe(true);
    expect(manifest.tier).toBe('content');
    expect(manifest.agentEmittable).toBe(true);
    expect(manifest.examples.length).toBeGreaterThan(0);
    expect(contentManifestsById[manifest.id as keyof typeof contentManifestsById]).toBe(manifest);
    expect(validateCatalogManifest(manifest).valid).toBe(true);
  }
  for (const [id, names] of Object.entries(CONTENT_PROP_NAMES)) {
    const manifest = contentManifestsById[id as keyof typeof contentManifestsById];
    expect(manifest, `missing manifest ${id}`).toBeDefined();
    expect(manifest?.props.map((prop) => prop.name).sort()).toEqual([...names].sort());
    expect(CONTENT_PROP_NAME_MAP[id as keyof typeof CONTENT_PROP_NAME_MAP]).toEqual(names);
  }
  for (const id of ['charts-bullet', 'charts-gauge', 'charts-progress-ring', 'charts-sparkline']) {
    const manifest = contentManifestsById[id as keyof typeof contentManifestsById];
    const format = manifest?.props.find((prop) => prop.name === 'format');
    expect(format?.kind).toBe('object');
  }
  // rejects unknown example props
  {
    const pie = CONTENT_MANIFESTS.find((manifest) => manifest.id === 'charts-pie');
    expect(pie).toBeDefined();
    const invalid = {
      ...pie,
      examples: [{ id: 'bad', title: 'Bad', props: { title: 'x', madeUp: true } }],
    };
    const result = validateCatalogManifest(invalid);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === 'unknown-prop')).toBe(true);
  }
});
