/**
 * Cloud-ready design-system contracts (ADR-032): the allow manifest, the
 * ds-check report (with locked findings) and the design-system bundle each
 * validate against a published, versioned schema in the spec dialect, and
 * the TypeScript and Kotlin projections stay current.
 */
import { describe, expect, it } from 'vitest';
import { KOTLIN_OUT, TS_OUT } from '../src/build.ts';
import { checkSchemaDocument, type Schema, validateInstance } from '../src/dialect.ts';
import { build, json } from './helpers.ts';

const HASH = 'a'.repeat(64);

const SCHEMAS = [
  'schemas/allow-manifest.schema.json',
  'schemas/ds-check-report.schema.json',
  'schemas/design-system-bundle.schema.json',
] as const;

const allowSchema = json<Schema>('schemas/allow-manifest.schema.json');
const reportSchema = json<Schema>('schemas/ds-check-report.schema.json');
const bundleSchema = json<Schema>('schemas/design-system-bundle.schema.json');

const allowManifest = {
  version: '1.2.0',
  contentHash: HASH,
  specVersion: '0.13.0',
  allow: {
    button: { variants: ['default', 'outline'], sizes: ['sm', 'md'] },
    badge: { tones: ['success'] },
    card: {},
  },
  library: [{ id: 'pricing-card', version: '0.3.0', status: 'draft' }],
  catalogDigest: HASH,
  extensions: ['acme'],
};

const lockedReport = {
  format: 'texuli/ds-check',
  version: 1,
  ok: true,
  file: 'harborline.json',
  document: { id: 'harborline', version: '1.2.0', name: 'Harborline' },
  codes: [],
  errors: [],
  runs: [
    {
      variant: null,
      ok: true,
      modes: ['light', 'dark'],
      hash: HASH,
      contrast: {
        light: [
          {
            foreground: '--tx-foreground',
            background: '--tx-background',
            kind: 'text',
            ratio: 12.5,
            required: 4.5,
            pass: true,
          },
        ],
      },
      adjustments: [],
      warnings: [],
      inlineBytes: 0,
      targets: [{ variable: '--tx-control-height-md', px: 40, required: 24, pass: true }],
    },
  ],
  locked: {
    locked: true,
    allowed: ['badge', 'button', 'card'],
    library: ['pricing-card'],
    catalogChecked: true,
    approval: {
      status: 'approved',
      version: '1.2.0',
      approvedBy: 'Design reviewer',
      approvedAt: '2026-11-09T14:30:00Z',
      contentHash: HASH,
      stored: HASH,
      matches: true,
    },
    entries: [{ id: 'pricing-card', status: 'draft', contentHash: HASH }],
  },
};

const bundle = {
  format: 'texuli/design-system-bundle',
  version: 1,
  document: {
    format: 'texuli/design-system',
    formatVersion: 1,
    id: 'harborline',
    version: '1.2.0',
    name: 'Harborline',
  },
  allowManifest,
  librarySources: [
    {
      id: 'pricing-card',
      version: '0.3.0',
      language: 'svelte',
      source: '<div class="tx-card"></div>',
      contentHash: HASH,
    },
  ],
  history: [
    {
      version: '1.2.0',
      contentHash: HASH,
      changelog: 'Initial locked release.',
      status: 'approved',
      approvedBy: 'Design reviewer',
      approvedAt: '2026-11-09T14:30:00Z',
    },
  ],
};

const codes = (value: unknown, schema: Schema): string[] =>
  validateInstance(schema, value).map((issue) => issue.code);

describe('design-system contract schemas', () => {
  it('stays in the dialect', () => {
    for (const path of SCHEMAS) {
      expect(checkSchemaDocument(json(path)), path).toEqual([]);
    }
  });

  it('validates an allow manifest and refuses extra or missing fields', () => {
    expect(validateInstance(allowSchema, allowManifest)).toEqual([]);
    expect(
      validateInstance(allowSchema, {
        version: '1.0.0',
        contentHash: HASH,
        specVersion: '0.13.0',
      })
    ).toEqual([]);
    expect(codes({ ...allowManifest, extra: true }, allowSchema)).toEqual(['additional-property']);
    expect(codes({ version: '1.0.0', specVersion: '0.13.0' }, allowSchema)).toEqual(['required']);
    expect(codes({ ...allowManifest, specVersion: 'v13' }, allowSchema)).toEqual(['pattern']);
  });

  it('validates a locked ds-check report, including a null base variant', () => {
    expect(validateInstance(reportSchema, lockedReport)).toEqual([]);
    expect(codes({ ...lockedReport, format: 'texuli/other' }, reportSchema)).toEqual(['const']);
    expect(codes({ ...lockedReport, version: 2 }, reportSchema)).toEqual(['const']);
    const { locked: _locked, ...withoutLocked } = lockedReport;
    expect(codes(withoutLocked, reportSchema)).toEqual(['required']);
    const failing = {
      ...lockedReport,
      ok: false,
      codes: ['content-hash-mismatch'],
      errors: [
        {
          code: 'content-hash-mismatch',
          path: '$.approval.contentHash',
          message: 'The recorded content hash does not match the document.',
        },
      ],
    };
    expect(validateInstance(reportSchema, failing)).toEqual([]);
  });

  it('validates a design-system bundle and refuses an unknown format', () => {
    expect(validateInstance(bundleSchema, bundle)).toEqual([]);
    expect(
      validateInstance(bundleSchema, {
        ...bundle,
        librarySources: [],
        history: [],
      })
    ).toEqual([]);
    expect(codes({ ...bundle, format: 'texuli/other' }, bundleSchema)).toEqual(['const']);
    const { document: _document, ...withoutDocument } = bundle;
    expect(codes(withoutDocument, bundleSchema)).toEqual(['required']);
    const oversized = {
      ...bundle,
      librarySources: [
        {
          id: 'pricing-card',
          version: '0.3.0',
          source: 'x'.repeat(65537),
          contentHash: HASH,
        },
      ],
    };
    expect(codes(oversized, bundleSchema)).toEqual(['max-length']);
  });

  it('projects TypeScript and Kotlin for each contract', () => {
    const stamp = `Spec ${build.stamp.specVersion}, digest ${build.stamp.specDigest}`;
    expect(build.generated[`${TS_OUT}allow-manifest.ts`]).toContain(
      'export interface AllowManifest'
    );
    expect(build.generated[`${TS_OUT}ds-check-report.ts`]).toContain(
      'export interface DsCheckReport'
    );
    expect(build.generated[`${TS_OUT}design-system-bundle.ts`]).toContain(
      'export interface DesignSystemBundle'
    );
    expect(build.generated[`${KOTLIN_OUT}AllowManifest.kt`]).toContain('data class AllowManifest');
    expect(build.generated[`${KOTLIN_OUT}DsCheckReport.kt`]).toContain('data class DsCheckReport');
    expect(build.generated[`${KOTLIN_OUT}DesignSystemBundle.kt`]).toContain(
      'data class DesignSystemBundle'
    );
    for (const path of [
      `${TS_OUT}allow-manifest.ts`,
      `${TS_OUT}ds-check-report.ts`,
      `${TS_OUT}design-system-bundle.ts`,
      `${KOTLIN_OUT}AllowManifest.kt`,
      `${KOTLIN_OUT}DsCheckReport.kt`,
      `${KOTLIN_OUT}DesignSystemBundle.kt`,
    ]) {
      expect(build.generated[path], path).toContain(stamp);
    }
  });
});
