import { describe, expect, it } from 'vitest';
import type { SpecCatalog } from '../src/catalog.ts';
import { SPEC_LIMITS, SPEC_PROP_REFS, SPEC_REGEX } from '../src/contract.ts';
import type { Schema } from '../src/dialect.ts';
import { migrateBlueprint } from '../src/migrations/index.ts';
import { validateBlueprint } from '../src/validate.ts';
import { SPEC_VERSION } from '../src/version.ts';
import { json } from './helpers.ts';

/**
 * Spec 0.7.0 (ADR-011, ADR-012, ADR-014): the optional node `key`, the
 * `document` catalog id with its `$defs.document` shape, the `patchDocument`
 * edit op and the stamp-only 0.6.0 → 0.7.0 migration.
 */
const documents = {
  blueprintSchema: json<Schema>('schemas/blueprint.schema.json'),
  catalog: json<SpecCatalog>('catalog/components.json'),
};
const golden = json<Record<string, unknown>>('fixtures/golden/document-brief.json');
const codes = (input: unknown) =>
  validateBlueprint(input, documents).diagnostics.map((d) => d.code);
const withTree = (tree: unknown, extra: Record<string, unknown> = {}) => ({
  ...golden,
  ...extra,
  tree,
});
const doc = (golden.tree as { props: { doc: Record<string, unknown> } }).props.doc;

describe('spec 0.7.0: node keys', () => {
  it('accepts unique well-formed keys and refuses repeats and malformed keys', () => {
    // Spec 0.7.0 introduced keys; later minors keep them.
    expect(['0.7.0', '0.8.0', '0.9.0', '0.10.0']).toContain(SPEC_VERSION);
    const leaf = (key: string) => ({
      key,
      id: 'blocks-text',
      props: { block: { type: 'text', markdown: 'Shipped.' } },
    });
    const page = (...children: unknown[]) => ({
      key: 'page',
      id: 'layout-doc',
      props: { title: 'Week 43' },
      children,
    });
    expect(codes(withTree(page(leaf('a'), leaf('b.c:d_e-1'))))).toEqual([]);
    // A repeat anywhere in the tree, including the root's key.
    expect(codes(withTree(page(leaf('a'), leaf('a'))))).toEqual(['duplicate-key']);
    expect(codes(withTree(page(leaf('page'))))).toEqual(['duplicate-key']);
    for (const bad of ['', 'a b', 'x'.repeat(65), 'a/b', '<b>']) {
      expect(codes(withTree(page(leaf(bad)))), JSON.stringify(bad)).toEqual(['schema']);
      expect(SPEC_REGEX.nodeKey.test(bad)).toBe(false);
    }
    expect(codes(withTree(page({ ...leaf('a'), key: 7 })))).toEqual(['schema']);
  });

  it('checks a thousand keyed nodes in linear time', () => {
    const children = Array.from({ length: 64 }, (_, i) => ({
      key: `section-${i}`,
      id: 'layout-card',
      props: { title: `Section ${i}` },
      children: Array.from({ length: 15 }, (_, j) => ({
        key: `section-${i}-text-${j}`,
        id: 'blocks-text',
        props: { block: { type: 'text', markdown: 'Fictional text.' } },
      })),
    }));
    const started = performance.now();
    expect(
      codes(withTree({ key: 'root', id: 'layout-doc', props: { title: 'Big' }, children }))
    ).toEqual([]);
    expect(performance.now() - started).toBeLessThan(2_000);
  });
});

describe('spec 0.7.0: documents', () => {
  it('lists the agent-emittable document id with a doc prop that names the contract shape', () => {
    expect(SPEC_PROP_REFS).toContain('document');
    const entry = documents.catalog.components.find((c) => c.id === 'document');
    expect(entry?.emit).toEqual(['developer', 'untrusted']);
    const prop = entry?.props.find((p) => p.name === 'doc');
    expect(prop).toMatchObject({
      kind: 'object',
      required: true,
      schema: { $ref: '#/$defs/document' },
    });
    expect(codes(golden)).toEqual([]);
  });

  it('refuses a doc that is not a version 1 Texuli document, structurally', () => {
    const node = (value: unknown) => ({ key: 'notes', id: 'document', props: { doc: value } });
    expect(codes(withTree(node(doc)))).toEqual([]);
    for (const [label, value] of [
      ['another format', { ...doc, format: 'texuli-html' }],
      ['another version', { ...doc, formatVersion: 2 }],
      ['no meta', { ...doc, meta: undefined }],
      ['no blocks', { ...doc, blocks: undefined }],
      ['blocks not a list', { ...doc, blocks: { 0: {} } }],
      ['a block that is not an object', { ...doc, blocks: ['<script>'] }],
      ['an unknown member', { ...doc, script: 'alert(1)' }],
      [
        'too many blocks',
        { ...doc, blocks: Array.from({ length: SPEC_LIMITS.documentBlocks + 1 }, () => ({})) },
      ],
      ['a string', '{"format":"texuli-document"}'],
    ] as const) {
      const plain = JSON.parse(JSON.stringify(value)) as unknown;
      expect(codes(withTree(node(plain))), label).toEqual(['prop-type']);
    }
    expect(codes(withTree({ id: 'document', props: {} }))).toEqual(['missing-required']);
  });

  it('reads patchDocument edits with a bounded RFC 6902 patch', () => {
    const edit = (op: Record<string, unknown>) =>
      withTree(golden.tree, {
        provenance: [
          { at: '2026-10-29T09:05:00Z', actor: 'Harbor assistant', kind: 'apply', ops: [op] },
        ],
      });
    const replace = { op: 'replace', path: '/meta/title', value: 'Launch brief v2' };
    expect(
      codes(
        edit({
          op: 'patchDocument',
          key: 'brief',
          patch: [{ op: 'test', path: '/formatVersion', value: 1 }, replace],
        })
      )
    ).toEqual([]);
    expect(codes(edit({ op: 'patchDocument', path: [], patch: [replace] }))).toEqual([]);
    for (const [label, op] of [
      [
        'an unknown patch op',
        { op: 'patchDocument', key: 'brief', patch: [{ op: 'eval', path: '/' }] },
      ],
      [
        'an extra patch field',
        { op: 'patchDocument', key: 'brief', patch: [{ ...replace, script: 'x' }] },
      ],
      ['no path', { op: 'patchDocument', key: 'brief', patch: [{ op: 'remove' }] }],
      [
        'over 1,000 operations',
        { op: 'patchDocument', key: 'brief', patch: Array.from({ length: 1001 }, () => replace) },
      ],
      ['a malformed key', { op: 'patchDocument', key: 'a b', patch: [replace] }],
    ] as const) {
      expect(codes(edit(op)), label).toEqual(['schema']);
    }
  });

  it('migrates a 0.6.0 envelope by stamping spec only', () => {
    const input = { ...golden, spec: '0.6.0', tree: { id: 'layout-doc', props: { title: 'A' } } };
    const result = migrateBlueprint(input, '0.7.0');
    expect(result.applied).toEqual(['0.6.0->0.7.0']);
    expect(result.blueprint).toEqual({ ...input, spec: '0.7.0' });
    expect((result.blueprint as { tree: unknown }).tree).toBe(input.tree);
    expect(migrateBlueprint(result.blueprint, '0.7.0').applied).toEqual([]);
  });
});
