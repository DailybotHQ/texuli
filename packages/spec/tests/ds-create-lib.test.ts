/**
 * ADR-032 library functions for consumers: `initLockedDesignSystem` (presets
 * over a catalog passed as data) and `approveDesignSystem` (validate, then
 * stamp the approval with its content hash), with stable error codes.
 */
import { describe, expect, it } from 'vitest';
import {
  APPROVAL_NOTE,
  approveDesignSystem,
  checkDesignSystemAllow,
  type DesignSystem,
  type DesignSystemAllowCatalog,
  designSystemContentHash,
  fullAllowEntry,
  initLockedDesignSystem,
  lockedAllowPreset,
  MINIMAL_LOCKED_COMPONENTS,
  validateDesignSystem,
} from '../src/design-system/index.ts';
import { json } from './helpers.ts';

/** The projected catalog the package ships (`catalog/components.json`). */
const catalog = json<DesignSystemAllowCatalog>('catalog/components.json');

/** A small catalog with axes, for exact assertions. */
const tiny: DesignSystemAllowCatalog = {
  components: [
    {
      id: 'button',
      axes: { variant: { values: ['default', 'outline'] }, size: { values: ['sm', 'md'] } },
      states: ['hover', 'disabled'],
    },
    { id: 'card' },
    { id: 'chart', axes: { tone: { values: Array.from({ length: 33 }, (_, i) => `t${i}`) } } },
    { id: 'table', axes: { density: { values: ['has space'] } } },
  ],
};

describe('initLockedDesignSystem', () => {
  it('creates a valid draft from the minimal preset over the real catalog', () => {
    const result = initLockedDesignSystem({ id: 'harborline', name: 'Harborline' }, catalog);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    const doc = result.document;
    expect(doc).toMatchObject({
      format: 'texuli/design-system',
      formatVersion: 1,
      id: 'harborline',
      name: 'Harborline',
      version: '0.1.0',
      approval: { status: 'draft', version: '0.1.0' },
    });
    const ids = catalog.components.map((c) => c.id);
    expect(MINIMAL_LOCKED_COMPONENTS.filter((id) => !ids.includes(id))).toEqual([]);
    expect(Object.keys(doc.allow ?? {}).sort()).toEqual([...MINIMAL_LOCKED_COMPONENTS].sort());
    expect(validateDesignSystem(doc)).toEqual({ ok: true, errors: [] });
    expect(checkDesignSystemAllow(doc, catalog).ok).toBe(true);
  });

  it('creates the all preset with every catalog component', () => {
    const result = initLockedDesignSystem(
      { id: 'everything', name: 'Everything', version: '1.0.0', preset: 'all' },
      catalog
    );
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(Object.keys(result.document.allow ?? {})).toHaveLength(catalog.components.length);
    expect(validateDesignSystem(result.document).ok).toBe(true);
  });

  it('lists full axes and states, and leaves out axes beyond the caps', () => {
    expect(lockedAllowPreset(tiny, 'all')).toEqual({
      button: {
        variants: ['default', 'outline'],
        sizes: ['sm', 'md'],
        states: ['hover', 'disabled'],
      },
      card: {},
      chart: {},
      table: {},
    });
    expect(lockedAllowPreset(tiny, 'minimal')).toEqual({
      button: lockedAllowPreset(tiny, 'all').button,
      card: {},
      table: {},
    });
    expect(fullAllowEntry({ id: 'x', states: ['pressed', 'hover', 'hover'] })).toEqual({
      states: ['hover'],
    });
  });

  it('accepts an explicit allow section and keeps a base document, dropping its approval', () => {
    const result = initLockedDesignSystem(
      {
        id: 'harborline',
        name: 'Harborline',
        preset: { button: { variants: ['outline'] } },
        base: {
          id: 'ignored',
          color: { brand: { seed: '#0e7490' } },
          shape: { radius: 12 },
          approval: { status: 'approved', version: '9.9.9' },
        },
      },
      tiny
    );
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.document).toMatchObject({
      id: 'harborline',
      color: { brand: { seed: '#0e7490' } },
      shape: { radius: 12 },
      allow: { button: { variants: ['outline'] } },
      approval: { status: 'draft', version: '0.1.0' },
    });
  });

  it('returns stable codes instead of throwing', () => {
    const codes = (result: ReturnType<typeof initLockedDesignSystem>) =>
      result.ok ? [] : result.errors.map((issue) => [issue.code, issue.path]);
    expect(codes(initLockedDesignSystem({ id: 'Bad Id', name: 'X' }, tiny))).toEqual([
      ['invalid-value', '$.id'],
    ]);
    expect(
      codes(
        initLockedDesignSystem(
          { id: 'x', name: 'X', preset: 'everything' as unknown as 'all' },
          tiny
        )
      )
    ).toEqual([['invalid-value', '$.allow']]);
    // Catalog membership: an id or a variant the catalog does not list.
    const unknown = initLockedDesignSystem(
      { id: 'x', name: 'X', preset: { nope: {}, button: { variants: ['ghost'] } } },
      tiny
    );
    expect(unknown.ok).toBe(false);
    if (!unknown.ok)
      expect(unknown.errors.map((issue) => issue.path)).toEqual(
        expect.arrayContaining(['$.allow.nope', '$.allow.button.variants[0]'])
      );
  });
});

const draft = (): DesignSystem => {
  const result = initLockedDesignSystem(
    {
      id: 'harborline',
      name: 'Harborline',
      version: '1.0.0',
      base: {
        color: { brand: { seed: '#0e7490' } },
        library: [
          {
            id: 'pricing-card',
            name: 'Pricing card',
            purpose: 'One plan.',
            version: '0.1.0',
            status: 'draft',
            composes: ['card', 'button'],
          },
        ],
      },
    },
    tiny
  );
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.document;
};

describe('approveDesignSystem', () => {
  const at = '2026-11-09T14:30:00Z';

  it('stamps an approval whose hash verifies, without mutating its input', () => {
    const doc = draft();
    const before = structuredClone(doc);
    const result = approveDesignSystem(doc, { by: '  Design reviewer ', at });
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(doc).toEqual(before);
    expect(result.document.approval).toEqual({
      status: 'approved',
      approvedBy: 'Design reviewer',
      approvedAt: at,
      version: '1.0.0',
      contentHash: result.contentHash,
    });
    expect(result.contentHash).toBe(designSystemContentHash(result.document));
    // The hash covers the document without its approval: the draft has the same one.
    expect(result.contentHash).toBe(designSystemContentHash(doc));
    expect(validateDesignSystem(result.document).ok).toBe(true);
    expect(APPROVAL_NOTE).toMatch(/cannot prove it/u);
  });

  it('takes a Date, and moves the document to an approved version', () => {
    const result = approveDesignSystem(draft(), {
      by: 'Design reviewer',
      at: new Date(at),
      version: '1.1.0',
    });
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.document.version).toBe('1.1.0');
    expect(result.document.approval).toMatchObject({
      version: '1.1.0',
      approvedAt: '2026-11-09T14:30:00.000Z',
    });
    expect(result.contentHash).not.toBe(designSystemContentHash(draft()));
  });

  it('refuses an invalid document and bad stamps with stable codes and paths', () => {
    const codes = (result: ReturnType<typeof approveDesignSystem>) =>
      result.ok ? [] : result.errors.map((issue) => [issue.code, issue.path]);
    expect(codes(approveDesignSystem({ ...draft(), extra: 1 }, { by: 'A', at }))).toEqual([
      ['unknown-key', '$.extra'],
    ]);
    expect(codes(approveDesignSystem(null, { by: 'A', at }))).toEqual([['invalid-type', '$']]);
    expect(codes(approveDesignSystem(draft(), { by: '  ', at }))).toEqual([
      ['invalid-value', '$.approval.approvedBy'],
    ]);
    expect(codes(approveDesignSystem(draft(), { by: 'evil‮name', at }))).toEqual([
      ['invalid-value', '$.approval.approvedBy'],
    ]);
    expect(codes(approveDesignSystem(draft(), { by: 'A', at: '09/11/2026' }))).toEqual([
      ['invalid-value', '$.approval.approvedAt'],
    ]);
    expect(codes(approveDesignSystem(draft(), { by: 'A', at: new Date('nope') }))).toEqual([
      ['invalid-value', '$.approval.approvedAt'],
    ]);
    expect(codes(approveDesignSystem(draft(), { by: 'A', at, version: '^2' }))).toEqual([
      ['invalid-value', '$.version'],
      ['invalid-value', '$.approval.version'],
    ]);
  });
});
