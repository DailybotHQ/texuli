/**
 * `ds.bundle` (ADR-032): pack or unpack a portable design-system bundle in
 * memory. Read only; sources are never executed. File I/O is `texuli ds
 * pack` / `texuli ds unpack`.
 */
import { packBundle, unpackBundle } from '@texuli/spec/design-system';
import { defineOperation } from './registry.ts';
import { type Operation, OperationError } from './types.ts';

export const dsBundle: Operation = defineOperation({
  name: 'ds.bundle',
  title: 'Pack or unpack a portable design-system bundle',
  summary:
    'Pack a design-system document with its library sources and release history into one JSON bundle, or unpack a bundle and return those parts. Returns ok, the bundle or the document, allowManifest, librarySources and history; hash mismatches, oversized sources and path-traversing ids are refused with stable codes. Sources are never executed.',
  input: {
    type: 'object',
    properties: {
      bundle: {
        type: 'object',
        description:
          'A texuli/design-system-bundle object to unpack (format, version 1, document, allowManifest, librarySources, history).',
      },
      document: {
        type: 'object',
        description: 'A texuli/design-system document to pack. Ignored when bundle is set.',
      },
      librarySources: {
        type: 'array',
        maxItems: 64,
        items: { type: 'object' },
        description:
          'Library component sources as text: { id, version, source, language? }. Ignored when bundle is set.',
      },
      history: {
        type: 'array',
        maxItems: 32,
        items: { type: 'object' },
        description:
          'Approved versions with changelog entries: { version, contentHash, changelog?, status?, approvedBy?, approvedAt? }. Ignored when bundle is set.',
      },
    },
    additionalProperties: false,
  },
  output: {
    type: 'object',
    properties: {
      ok: { type: 'boolean' },
      bundle: { type: 'object' },
      document: { type: 'object' },
      allowManifest: { type: 'object' },
      librarySources: { type: 'array' },
      history: { type: 'array' },
      errors: { type: 'array' },
    },
    required: ['ok'],
  },
  annotations: { readOnly: true, destructive: false, idempotent: true, openWorld: false },
  runtime: 'edge',
  limits: { inputBytes: 1_048_576, timeMs: 10_000, items: 64 },
  examples: [
    {
      title: 'Pack a minimal document',
      input: {
        document: {
          format: 'texuli/design-system',
          formatVersion: 1,
          id: 'harborline',
          version: '1.0.0',
          name: 'Harborline',
          color: { brand: { seed: '#0e7490' } },
        },
      },
    },
  ],
  async handler(input) {
    const { bundle, document, librarySources, history } = input as {
      bundle?: unknown;
      document?: unknown;
      librarySources?: unknown[];
      history?: unknown[];
    };
    if (bundle !== undefined) {
      const unpacked = unpackBundle(bundle);
      if (!unpacked.ok) return { ok: false, errors: unpacked.errors };
      return {
        ok: true,
        document: unpacked.document,
        allowManifest: unpacked.allowManifest,
        librarySources: unpacked.librarySources,
        history: unpacked.history,
      };
    }
    if (document === undefined)
      throw new OperationError('invalid-input', 'Pass bundle to unpack or document to pack.');
    const packed = packBundle({
      document,
      ...(librarySources ? { librarySources: librarySources as never } : {}),
      ...(history ? { history: history as never } : {}),
    });
    if (!packed.ok) return { ok: false, errors: packed.errors };
    return { ok: true, bundle: packed.bundle };
  },
});
