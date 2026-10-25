// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildCatalog } from '../src/build/index.ts';
import {
  defineCatalogManifest,
  MANIFEST_SCHEMA_VERSION,
  validateCatalogManifest,
  validateCatalogManifests,
} from '../src/manifest/index.ts';

const card = {
  id: 'versioning-card',
  package: 'texuli',
  label: 'Versioning card',
  summary: 'A minimal manifest used to pin schema-version behavior.',
  tier: 'app' as const,
  useWhen: ['A minimal valid manifest'],
  dontUseWhen: [],
  a11y: 'No interactive parts.',
  props: [],
  examples: [],
};

describe('manifest schema versioning', () => {
  it('pins the current schema version constant', () => {
    expect(MANIFEST_SCHEMA_VERSION).toBe(1);
  });

  it('accepts an explicit schemaVersion equal to the current version', () => {
    const result = validateCatalogManifest({ ...card, schemaVersion: 1 });
    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
  });

  it('refuses any other value with a schema-version diagnostic', () => {
    for (const bad of [2, 0, -1, '1', null, true]) {
      const result = validateCatalogManifest({ ...card, schemaVersion: bad });
      expect(result.valid, `valid for ${JSON.stringify(bad)}`).toBe(false);
      const diag = result.diagnostics.find((d) => d.code === 'schema-version');
      expect(diag, `diagnostic for ${JSON.stringify(bad)}`).toBeDefined();
      expect(diag?.jsonPath).toBe('$.schemaVersion');
    }
  });

  it('reports the list index when validating many manifests', () => {
    const result = validateCatalogManifests([
      card,
      { ...card, id: 'versioning-card-2', schemaVersion: 3 },
    ]);
    expect(result.valid).toBe(false);
    const diag = result.diagnostics.find((d) => d.code === 'schema-version');
    expect(diag?.jsonPath).toBe('$[1].schemaVersion');
  });

  it('never copies schemaVersion into the defined manifest', () => {
    const defined = defineCatalogManifest({ ...card, schemaVersion: 1 });
    expect(Object.hasOwn(defined, 'schemaVersion')).toBe(false);
  });

  it('builds byte-identical catalogs with and without an explicit schemaVersion', async () => {
    const declared = await buildCatalog([
      { name: 'versioning-group', manifests: [{ ...card, schemaVersion: 1 }] },
    ]);
    const omitted = await buildCatalog([{ name: 'versioning-group', manifests: [card] }]);
    expect(declared.json).toBe(omitted.json);
    expect(declared.hash).toBe(omitted.hash);
    expect(declared.fileName).toBe(omitted.fileName);
    expect(declared.catalog.entries).toHaveLength(1);
    expect(Object.hasOwn(declared.catalog.entries[0] ?? {}, 'schemaVersion')).toBe(false);
  });
});
