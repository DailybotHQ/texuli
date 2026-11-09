/**
 * Portable design-system bundles: pack/unpack round-trips byte-identically
 * with history, and tampered, oversized or hash-mismatched bundles are
 * refused with stable codes. Sources are never executed.
 */
import { describe, expect, it } from 'vitest';
import {
  bundleCanonicalJson,
  DESIGN_SYSTEM_BUNDLE_CODES,
  DESIGN_SYSTEM_BUNDLE_FORMAT,
  DESIGN_SYSTEM_BUNDLE_LIMITS,
  designSystemContentHash,
  packBundle,
  sha256Hex,
  unpackBundle,
  validateBundle,
} from '../src/design-system/index.ts';
import type { Schema } from '../src/dialect.ts';
import { validateInstance } from '../src/dialect.ts';
import { json } from './helpers.ts';

const schema = json<Schema>('schemas/design-system-bundle.schema.json');

const document = {
  format: 'texuli/design-system',
  formatVersion: 1,
  id: 'harborline',
  version: '1.2.0',
  name: 'Harborline',
  color: { brand: { seed: '#0e7490' } },
  allow: { button: { variants: ['default'] }, card: {} },
  library: [
    {
      id: 'pricing-card',
      name: 'Pricing card',
      purpose: 'One plan with its price.',
      version: '0.3.0',
      status: 'draft',
      composes: ['card', 'button'],
    },
  ],
};

const source = '<div class="tx-card"></div>';
const librarySources = [
  {
    id: 'pricing-card',
    version: '0.3.0',
    language: 'svelte',
    source,
  },
];

const history = [
  {
    version: '1.2.0',
    contentHash: designSystemContentHash(document),
    changelog: 'Initial locked release.',
    status: 'approved' as const,
    approvedBy: 'Design reviewer',
    approvedAt: '2026-11-09T14:30:00Z',
  },
];

const codes = (value: unknown): string[] => validateBundle(value).errors.map((issue) => issue.code);

describe('packBundle / unpackBundle', () => {
  it('round-trips a document with sources and history byte-identically', () => {
    const packed = packBundle({ document, librarySources, history });
    if (!packed.ok) throw new Error(JSON.stringify(packed.errors));
    expect(packed.bundle.format).toBe(DESIGN_SYSTEM_BUNDLE_FORMAT);
    expect(packed.bundle.version).toBe(1);
    expect(packed.bundle.allowManifest.contentHash).toBe(designSystemContentHash(document));
    expect(packed.bundle.librarySources[0]?.contentHash).toBe(sha256Hex(source));
    expect(validateInstance(schema, packed.bundle)).toEqual([]);
    expect(validateBundle(packed.bundle)).toEqual({ ok: true, errors: [] });
    const unpacked = unpackBundle(packed.bundle);
    if (!unpacked.ok) throw new Error(JSON.stringify(unpacked.errors));
    expect(unpacked.document).toEqual(document);
    expect(unpacked.history).toEqual(packed.bundle.history);
    const again = packBundle({
      document: unpacked.document,
      librarySources: unpacked.librarySources,
      history: unpacked.history,
    });
    if (!again.ok) throw new Error(JSON.stringify(again.errors));
    expect(bundleCanonicalJson(again.bundle)).toBe(bundleCanonicalJson(packed.bundle));
  });

  it('packs an empty library and history', () => {
    const packed = packBundle({ document });
    if (!packed.ok) throw new Error(JSON.stringify(packed.errors));
    expect(packed.bundle.librarySources).toEqual([]);
    expect(packed.bundle.history).toEqual([]);
    expect(validateInstance(schema, packed.bundle)).toEqual([]);
  });
});

describe('validateBundle refusals', () => {
  it('refuses a tampered document hash, a source hash mismatch, an oversized source and a path-traversing id', () => {
    const packed = packBundle({ document, librarySources, history });
    if (!packed.ok) throw new Error(JSON.stringify(packed.errors));
    const tampered = {
      ...packed.bundle,
      document: { ...document, name: 'Edited' },
    };
    expect(codes(tampered)).toContain('content-hash-mismatch');
    const badSource = {
      ...packed.bundle,
      librarySources: packed.bundle.librarySources.map((entry) => ({
        ...entry,
        contentHash: 'b'.repeat(64),
      })),
    };
    expect(codes(badSource)).toContain('library-hash-mismatch');
    const oversized = packBundle({
      document,
      librarySources: [
        {
          id: 'pricing-card',
          version: '0.3.0',
          source: 'x'.repeat(DESIGN_SYSTEM_BUNDLE_LIMITS.source + 1),
        },
      ],
    });
    expect(oversized.ok).toBe(false);
    if (oversized.ok) throw new Error('expected refusal');
    expect(oversized.errors.map((issue) => issue.code)).toContain('too-large');
    const traversal = packBundle({
      document,
      librarySources: [{ id: '../secret', version: '0.3.0', source: source }],
    });
    expect(traversal.ok).toBe(false);
    if (traversal.ok) throw new Error('expected refusal');
    expect(traversal.errors.map((issue) => issue.code)).toContain('path-refused');
    expect(codes({ ...packed.bundle, extra: true })).toContain('unknown-key');
    expect(codes({ ...packed.bundle, format: 'texuli/other' })).toContain('format-version');
    expect(DESIGN_SYSTEM_BUNDLE_CODES).toContain('content-hash-mismatch');
  });
});
