// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { migrateEnvelope } from '../src/envelope/lifecycle.ts';
import { parseEnvelope } from '../src/envelope/parse.ts';
import {
  ENVELOPE_FORMAT,
  ENVELOPE_VERSION,
  SUPPORTED_ENVELOPE_VERSIONS,
} from '../src/envelope/types.ts';

const HASH = 'a'.repeat(64);
const tree = { id: 'blocks-text', props: { block: { type: 'text', markdown: 'Hello.' } } };
const wrap = {
  id: 'stored-1',
  catalog: HASH,
  generator: { kind: 'agent' as const, name: 'Assistant' },
};

const envelopeV1 = {
  format: ENVELOPE_FORMAT,
  version: ENVELOPE_VERSION,
  id: 'stored-1',
  catalog: HASH,
  status: 'draft' as const,
  createdAt: '2026-10-25T09:00:00Z',
  updatedAt: '2026-10-25T09:00:00Z',
  generator: { kind: 'agent' as const, name: 'Assistant' },
  tree,
};

describe('envelope version policy', () => {
  it('declares the versions this package reads', () => {
    expect(SUPPORTED_ENVELOPE_VERSIONS).toEqual([1]);
    expect(SUPPORTED_ENVELOPE_VERSIONS).toContain(ENVELOPE_VERSION);
  });

  it('writes the current version', () => {
    expect(ENVELOPE_VERSION).toBe(1);
  });
});

describe('migrateEnvelope', () => {
  it('passes a version 1 envelope through unchanged', () => {
    const result = migrateEnvelope(envelopeV1, wrap);
    expect(result).toMatchObject({ ok: true, migrated: false });
  });

  it('wraps a bare catalog tree as a draft', () => {
    const result = migrateEnvelope(tree, wrap);
    expect(result).toMatchObject({ ok: true, migrated: true, envelope: { status: 'draft' } });
  });

  it('refuses a record that declares a different format', () => {
    const result = migrateEnvelope({ ...envelopeV1, format: 'other-app' }, wrap);
    expect(result).toMatchObject({ ok: false, code: 'unknown-format' });
  });

  it('refuses an envelope-like record with no version field', () => {
    const { version: _omit, ...noVersion } = envelopeV1;
    void _omit;
    const result = migrateEnvelope(noVersion, wrap);
    expect(result).toMatchObject({ ok: false, code: 'invalid-version' });
  });

  it('refuses a newer version as unsupported and names the readable versions', () => {
    const result = migrateEnvelope({ ...envelopeV1, version: 2 }, wrap);
    expect(result).toMatchObject({ ok: false, code: 'unsupported-version' });
    if (!result.ok) {
      expect(result.message).toContain('1');
    }
  });

  it('still refuses values that are neither envelope nor tree', () => {
    expect(migrateEnvelope([tree], wrap)).toMatchObject({ ok: false, code: 'not-a-tree' });
    expect(migrateEnvelope(null, wrap)).toMatchObject({ ok: false, code: 'not-a-tree' });
  });
});

describe('parseEnvelope version policy', () => {
  it('reports a missing version as invalid-version', () => {
    const { version: _omit, ...noVersion } = envelopeV1;
    void _omit;
    const result = parseEnvelope(noVersion);
    expect(result.envelope).toBeNull();
    expect(result.issues.map((issue) => issue.code)).toContain('invalid-version');
  });

  it('reports a newer version as unsupported-version', () => {
    const result = parseEnvelope({ ...envelopeV1, version: 2 });
    expect(result.envelope).toBeNull();
    expect(result.issues.map((issue) => issue.code)).toContain('unsupported-version');
  });
});
