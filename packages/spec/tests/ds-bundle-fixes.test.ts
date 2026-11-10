import { describe, expect, it } from 'vitest';
import {
  allowManifestFromDocument,
  DESIGN_SYSTEM_BUNDLE_LIMITS,
  designSystemContentHash,
  packBundle,
  sha256Hex,
  validateBundle,
} from '../src/design-system/index.ts';

const document = {
  format: 'texuli/design-system',
  formatVersion: 1,
  id: 'harborline',
  version: '1.2.0',
  name: 'Harborline',
  color: { brand: { seed: '#0e7490' } },
};

const source = '<div class="tx-card"></div>';
const sourceEntry = { id: 'pricing-card', version: '0.3.0', source };
const codes = (value: unknown): string[] => validateBundle(value).errors.map((error) => error.code);

describe('design-system bundle contract fixes', () => {
  it('keeps every valid allow entry and axis value up to the design-system caps', () => {
    const values = Array.from({ length: DESIGN_SYSTEM_BUNDLE_LIMITS.axis }, (_, index) => `v${index}`);
    const allow = Object.fromEntries(
      Array.from({ length: DESIGN_SYSTEM_BUNDLE_LIMITS.allow }, (_, index) => [
        `component-${index}`,
        index === 4095 ? { variants: values } : {},
      ])
    );
    const expanded = { ...document, allow };

    const manifest = allowManifestFromDocument(expanded);
    expect(Object.keys(manifest.allow ?? {})).toHaveLength(DESIGN_SYSTEM_BUNDLE_LIMITS.allow);
    expect(manifest.allow?.['component-4095']?.variants).toEqual(values);

    const packed = packBundle({ document: expanded });
    expect(packed.ok, JSON.stringify(packed)).toBe(true);
    if (!packed.ok) throw new Error(JSON.stringify(packed.errors));
    expect(Object.keys(packed.bundle.allowManifest.allow ?? {})).toHaveLength(
      DESIGN_SYSTEM_BUNDLE_LIMITS.allow
    );
    expect(validateBundle(packed.bundle)).toEqual({ ok: true, errors: [] });
  });

  it('rejects duplicate library source ids while packing and validating', () => {
    const duplicate = { ...sourceEntry, version: '0.4.0' };
    const packed = packBundle({ document, librarySources: [sourceEntry, duplicate] });
    expect(packed.ok).toBe(false);
    if (packed.ok) throw new Error('Expected duplicate source id refusal.');
    expect(packed.errors.map((error) => error.code)).toContain('invalid-value');

    const valid = packBundle({ document, librarySources: [sourceEntry] });
    if (!valid.ok) throw new Error(JSON.stringify(valid.errors));
    expect(
      codes({
        ...valid.bundle,
        librarySources: [...valid.bundle.librarySources, valid.bundle.librarySources[0]],
      })
    ).toContain('invalid-value');
  });

  it('refuses a current-version history hash that disagrees with the document while packing', () => {
    const packed = packBundle({
      document,
      history: [{ version: document.version, contentHash: 'a'.repeat(64) }],
    });
    expect(packed.ok).toBe(false);
    if (packed.ok) throw new Error('Expected current history hash refusal.');
    expect(packed.errors.map((error) => error.code)).toContain('content-hash-mismatch');
  });

  it('measures source limits in UTF-8 bytes', () => {
    const atLimit = 'é'.repeat(DESIGN_SYSTEM_BUNDLE_LIMITS.source / 2);
    const accepted = packBundle({ document, librarySources: [{ id: 'copy', version: '1.0.0', source: atLimit }] });
    expect(accepted.ok).toBe(true);

    const overLimit = `${atLimit}é`;
    const rejected = packBundle({
      document,
      librarySources: [{ id: 'copy', version: '1.0.0', source: overLimit }],
    });
    expect(rejected.ok).toBe(false);
    if (rejected.ok) throw new Error('Expected UTF-8 byte limit refusal.');
    expect(rejected.errors.map((error) => error.code)).toContain('too-large');

    const valid = packBundle({ document, librarySources: [sourceEntry] });
    if (!valid.ok) throw new Error(JSON.stringify(valid.errors));
    const malformed = {
      ...valid.bundle,
      librarySources: [
        { id: 'copy', version: '1.0.0', source: overLimit, contentHash: sha256Hex(overLimit) },
      ],
    };
    expect(codes(malformed)).toContain('too-large');
  });

  it('accepts ISO UTC history timestamps with long fractional seconds', () => {
    const timestamp = `2026-11-10T05:10:19.${'1234567890'.repeat(4)}Z`;
    const packed = packBundle({
      document,
      history: [{ version: document.version, contentHash: designSystemContentHash(document), approvedAt: timestamp }],
    });
    expect(packed.ok).toBe(true);
    if (!packed.ok) throw new Error(JSON.stringify(packed.errors));
    expect(validateBundle(packed.bundle)).toEqual({ ok: true, errors: [] });
  });
});
