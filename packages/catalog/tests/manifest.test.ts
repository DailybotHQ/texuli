// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { buildCatalog } from '../src/build/index.ts';
import {
  CatalogManifestError,
  defineCatalogManifest,
  isCatalogManifest,
  MANIFEST_SCHEMA_VERSION,
  validateCatalogManifest,
  validateCatalogManifests,
} from '../src/manifest/index.ts';
import { scenario } from './scenario.ts';

describe('manifest validation', () => {
  const buttonManifest = {
    id: 'button',
    package: 'texuli',
    label: 'Button',
    summary: 'A pressable control that runs an action.',
    tier: 'app' as const,
    agentEmittable: false,
    useWhen: ['A primary or secondary action the user chooses'],
    dontUseWhen: ['Navigation to a route (use a link)', 'A toggle that stays pressed (use toggle)'],
    a11y: 'Must be a real button or role=button with a name; disabled state is exposed to AT.',
    props: [
      {
        name: 'variant',
        kind: 'enum' as const,
        enumValues: ['primary', 'secondary', 'ghost'],
        default: 'secondary',
        description: 'Visual weight',
      },
      { name: 'disabled', kind: 'boolean' as const, default: false },
      {
        name: 'type',
        kind: 'enum' as const,
        enumValues: ['button', 'submit', 'reset'],
        default: 'button',
      },
    ],
    examples: [
      {
        id: 'primary-save',
        title: 'Primary save',
        props: { variant: 'primary', type: 'submit' },
      },
    ],
    related: ['link', 'toggle'],
  };

  const headingManifest = {
    id: 'heading',
    package: '@texuli/blocks',
    label: 'Heading',
    summary: 'A section title with a real heading level.',
    tier: 'content' as const,
    agentEmittable: true,
    useWhen: ['Open a section with a clear title', 'Mark hierarchy H1–H4'],
    dontUseWhen: ['Long body copy (use text)', 'A single icon callout'],
    a11y: ['Rendered as a real heading level', 'Prefer one H1 per view'],
    props: [
      { name: 'level', kind: 'enum' as const, required: true, enumValues: ['1', '2', '3', '4'] },
      { name: 'text', kind: 'string' as const, required: true, trust: 'untrusted' },
    ],
    examples: [
      { id: 'section-title', title: 'Section H2', props: { level: '2', text: 'Overview' } },
    ],
  };

  it('validateCatalogManifest accepts app-tier and agent-emittable manifests', () => {
    // accepts a complete app-tier manifest and defaults agentEmittable to false
    {
      const { agentEmittable: _omit, ...withoutFlag } = buttonManifest;
      void _omit;
      const result = validateCatalogManifest(withoutFlag);
      expect(result.valid).toBe(true);
      expect(result.diagnostics).toEqual([]);
      expect(isCatalogManifest(withoutFlag)).toBe(true);

      const defined = defineCatalogManifest(withoutFlag);
      expect(defined.agentEmittable).toBe(false);
      expect(defined.id).toBe('button');
      expect(Object.isFrozen(defined)).toBe(true);
    }
    // accepts an agent-emittable content manifest
    {
      const result = validateCatalogManifest(headingManifest);
      expect(result.valid).toBe(true);
      const defined = defineCatalogManifest(headingManifest);
      expect(defined.agentEmittable).toBe(true);
      expect(defined.tier).toBe('content');
      expect(defined.package).toBe('@texuli/blocks');
    }
  });

  it('validateCatalogManifest rejects incomplete, contradictory, unguarded and malformed manifests, and duplicate ids', () => {
    // rejects incomplete entries
    {
      const result = validateCatalogManifest({ id: 'Bad_Id' });
      expect(result.valid).toBe(false);
      const codes = result.diagnostics.map((d) => d.code);
      expect(codes).toContain('missing-field');
      expect(codes).toContain('invalid-id');
      expect(result.diagnostics.every((d) => d.jsonPath.startsWith('$.'))).toBe(true);
      expect(result.diagnostics.every((d) => d.hint.length > 0)).toBe(true);
    }
    // rejects contradictory useWhen and dontUseWhen
    {
      const result = validateCatalogManifest({
        ...buttonManifest,
        useWhen: ['A primary action'],
        dontUseWhen: ['A primary action'],
      });
      expect(result.valid).toBe(false);
      expect(result.diagnostics.some((d) => d.code === 'contradiction')).toBe(true);
    }
    // rejects agentEmittable without examples or useWhen
    {
      const result = validateCatalogManifest({
        ...headingManifest,
        useWhen: [],
        examples: [],
      });
      expect(result.valid).toBe(false);
      const codes = new Set(result.diagnostics.map((d) => d.code));
      expect(codes.has('agent-requires-examples') || codes.has('too-few')).toBe(true);
    }
    // rejects agentEmittable app-tier without dontUseWhen guardrails
    {
      const result = validateCatalogManifest({
        ...buttonManifest,
        agentEmittable: true,
        dontUseWhen: [],
      });
      expect(result.valid).toBe(false);
      expect(result.diagnostics.some((d) => d.code === 'app-emittable-needs-guardrails')).toBe(
        true
      );
    }
    // rejects enum props without enumValues and unknown example props
    {
      const result = validateCatalogManifest({
        ...buttonManifest,
        props: [{ name: 'size', kind: 'enum' }],
        examples: [{ id: 'x', title: 'X', props: { nope: true } }],
      });
      expect(result.valid).toBe(false);
      const codes = result.diagnostics.map((d) => d.code);
      expect(codes).toContain('enum-values-required');
      expect(codes).toContain('unknown-prop');
    }
    // rejects duplicate prop names, bad packages and unknown fields
    {
      const result = validateCatalogManifest({
        ...buttonManifest,
        package: '@other/ui',
        props: [
          { name: 'disabled', kind: 'boolean' },
          { name: 'disabled', kind: 'string' },
        ],
        extra: true,
      });
      expect(result.valid).toBe(false);
      const codes = result.diagnostics.map((d) => d.code);
      expect(codes).toContain('duplicate-prop');
      expect(codes).toContain('invalid-package');
      expect(codes).toContain('unknown-field');
    }
    // validateCatalogManifests rejects duplicate ids across the closed list
    {
      const result = validateCatalogManifests([
        buttonManifest,
        { ...buttonManifest, label: 'Other' },
      ]);
      expect(result.valid).toBe(false);
      expect(result.diagnostics.some((d) => d.code === 'duplicate-id')).toBe(true);
    }
    expect(() => defineCatalogManifest({})).toThrow(CatalogManifestError);
    try {
      defineCatalogManifest({});
    } catch (error) {
      expect(error).toBeInstanceOf(CatalogManifestError);
      if (error instanceof CatalogManifestError) {
        expect(error.diagnostics.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('manifest schema versioning', () => {
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

  it('pins, accepts and refuses schemaVersion without changing the built catalog', async () => {
    await scenario('pins the current schema version constant', async () => {
      expect(MANIFEST_SCHEMA_VERSION).toBe(1);
    });
    await scenario('accepts an explicit schemaVersion equal to the current version', async () => {
      const result = validateCatalogManifest({ ...card, schemaVersion: 1 });
      expect(result.valid).toBe(true);
      expect(result.diagnostics).toEqual([]);
    });
    await scenario('refuses any other value with a schema-version diagnostic', async () => {
      for (const bad of [2, 0, -1, '1', null, true]) {
        const result = validateCatalogManifest({ ...card, schemaVersion: bad });
        expect(result.valid, `valid for ${JSON.stringify(bad)}`).toBe(false);
        const diag = result.diagnostics.find((d) => d.code === 'schema-version');
        expect(diag, `diagnostic for ${JSON.stringify(bad)}`).toBeDefined();
        expect(diag?.jsonPath).toBe('$.schemaVersion');
      }
    });
    await scenario('reports the list index when validating many manifests', async () => {
      const result = validateCatalogManifests([
        card,
        { ...card, id: 'versioning-card-2', schemaVersion: 3 },
      ]);
      expect(result.valid).toBe(false);
      const diag = result.diagnostics.find((d) => d.code === 'schema-version');
      expect(diag?.jsonPath).toBe('$[1].schemaVersion');
    });
    await scenario('never copies schemaVersion into the defined manifest', async () => {
      const defined = defineCatalogManifest({ ...card, schemaVersion: 1 });
      expect(Object.hasOwn(defined, 'schemaVersion')).toBe(false);
    });
    await scenario(
      'builds byte-identical catalogs with and without an explicit schemaVersion',
      async () => {
        const declared = await buildCatalog([
          { name: 'versioning-group', manifests: [{ ...card, schemaVersion: 1 }] },
        ]);
        const omitted = await buildCatalog([{ name: 'versioning-group', manifests: [card] }]);
        expect(declared.json).toBe(omitted.json);
        expect(declared.hash).toBe(omitted.hash);
        expect(declared.fileName).toBe(omitted.fileName);
        expect(declared.catalog.entries).toHaveLength(1);
        expect(Object.hasOwn(declared.catalog.entries[0] ?? {}, 'schemaVersion')).toBe(false);
      }
    );
  });
});
