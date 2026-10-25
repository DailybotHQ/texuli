// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  CatalogManifestError,
  defineCatalogManifest,
  isCatalogManifest,
  validateCatalogManifest,
  validateCatalogManifests,
} from '../src/manifest/index.ts';

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
  examples: [{ id: 'section-title', title: 'Section H2', props: { level: '2', text: 'Overview' } }],
};

describe('validateCatalogManifest', () => {
  it('accepts a complete app-tier manifest and defaults agentEmittable to false', () => {
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
  });

  it('accepts an agent-emittable content manifest', () => {
    const result = validateCatalogManifest(headingManifest);
    expect(result.valid).toBe(true);
    const defined = defineCatalogManifest(headingManifest);
    expect(defined.agentEmittable).toBe(true);
    expect(defined.tier).toBe('content');
    expect(defined.package).toBe('@texuli/blocks');
  });

  it('rejects incomplete entries', () => {
    const result = validateCatalogManifest({ id: 'Bad_Id' });
    expect(result.valid).toBe(false);
    const codes = result.diagnostics.map((d) => d.code);
    expect(codes).toContain('missing-field');
    expect(codes).toContain('invalid-id');
    expect(result.diagnostics.every((d) => d.jsonPath.startsWith('$.'))).toBe(true);
    expect(result.diagnostics.every((d) => d.hint.length > 0)).toBe(true);
  });

  it('rejects contradictory useWhen and dontUseWhen', () => {
    const result = validateCatalogManifest({
      ...buttonManifest,
      useWhen: ['A primary action'],
      dontUseWhen: ['A primary action'],
    });
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'contradiction')).toBe(true);
  });

  it('rejects agentEmittable without examples or useWhen', () => {
    const result = validateCatalogManifest({
      ...headingManifest,
      useWhen: [],
      examples: [],
    });
    expect(result.valid).toBe(false);
    const codes = new Set(result.diagnostics.map((d) => d.code));
    expect(codes.has('agent-requires-examples') || codes.has('too-few')).toBe(true);
  });

  it('rejects agentEmittable app-tier without dontUseWhen guardrails', () => {
    const result = validateCatalogManifest({
      ...buttonManifest,
      agentEmittable: true,
      dontUseWhen: [],
    });
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'app-emittable-needs-guardrails')).toBe(true);
  });

  it('rejects enum props without enumValues and unknown example props', () => {
    const result = validateCatalogManifest({
      ...buttonManifest,
      props: [{ name: 'size', kind: 'enum' }],
      examples: [{ id: 'x', title: 'X', props: { nope: true } }],
    });
    expect(result.valid).toBe(false);
    const codes = result.diagnostics.map((d) => d.code);
    expect(codes).toContain('enum-values-required');
    expect(codes).toContain('unknown-prop');
  });

  it('rejects duplicate prop names, bad packages and unknown fields', () => {
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
  });

  it('validateCatalogManifests rejects duplicate ids across the closed list', () => {
    const result = validateCatalogManifests([
      buttonManifest,
      { ...buttonManifest, label: 'Other' },
    ]);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'duplicate-id')).toBe(true);
  });

  it('defineCatalogManifest throws CatalogManifestError with diagnostics', () => {
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
