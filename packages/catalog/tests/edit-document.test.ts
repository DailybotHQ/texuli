// @vitest-environment node
import { readFileSync } from 'node:fs';
import { safeParseBlock } from '@texuli/blocks/core';
import { describe, expect, it } from 'vitest';
import { buildCatalog } from '../src/build/build.ts';
import { discoverManifestGroups } from '../src/build/node.ts';
import {
  applyEditOps,
  createEditHistory,
  type EditOp,
  findNodeKey,
  isDocumentPatch,
  MAX_DOCUMENT_PATCH_OPS,
  parseEditOp,
  parseEditOps,
} from '../src/edit/index.ts';
import { parseEnvelope } from '../src/envelope/index.ts';
import { renderCatalogFromBuild } from '../src/render/renderer/index.ts';
import type { CatalogTreeInput } from '../src/render/renderer/types.ts';
import { draftCommitGate, validateDraft } from '../src/validate/index.ts';
import { checkDocument, patchDocument } from './document-check.ts';

/**
 * Agents edit documents with patches (spec 0.7.0, ADR-011): a
 * `patchDocument` edit op carries a bounded RFC 6902 patch for the `doc` of
 * a `document` node addressed by path or by its stable key. The host's
 * patcher (`@texuli/document/ops`) applies it all or none and validates the
 * result; the commit gate validates the whole draft again.
 */

const golden = JSON.parse(
  readFileSync(new URL('../../spec/fixtures/golden/document-brief.json', import.meta.url), 'utf8')
) as { tree: CatalogTreeInput };
const tree = golden.tree;
const page: CatalogTreeInput = { id: 'layout-page', props: { title: 'Hub' }, children: [tree] };
const doc = (value: CatalogTreeInput | undefined) =>
  value?.props?.doc as { meta: { title: string }; blocks: { id: string }[] };

const retitle = [
  { op: 'test', path: '/meta/title', value: 'Launch brief' },
  { op: 'replace', path: '/meta/title', value: 'Launch brief, revised' },
] as const;

describe('patchDocument edit ops', () => {
  it('parses a closed, bounded shape: exactly one of path and key, closed patch ops', () => {
    expect(parseEditOp({ op: 'patchDocument', key: 'brief', patch: retitle }).ok).toBe(true);
    expect(parseEditOp({ op: 'patchDocument', path: [0], patch: [] }).ok).toBe(true);
    const refused: [string, unknown][] = [
      ['no address', { op: 'patchDocument', patch: retitle }],
      ['both addresses', { op: 'patchDocument', key: 'brief', path: [], patch: retitle }],
      ['a malformed key', { op: 'patchDocument', key: 'a b', patch: retitle }],
      [
        'an unknown patch op',
        { op: 'patchDocument', key: 'brief', patch: [{ op: 'eval', path: '/' }] },
      ],
      [
        'an extra patch field',
        { op: 'patchDocument', key: 'brief', patch: [{ op: 'remove', path: '/x', why: 1 }] },
      ],
      [
        'a non-JSON value',
        { op: 'patchDocument', key: 'brief', patch: [{ op: 'add', path: '/x', value: () => 1 }] },
      ],
      [
        'a long pointer',
        {
          op: 'patchDocument',
          key: 'brief',
          patch: [{ op: 'remove', path: `/${'a'.repeat(2048)}` }],
        },
      ],
      [
        'too many operations',
        {
          op: 'patchDocument',
          key: 'brief',
          patch: Array.from({ length: MAX_DOCUMENT_PATCH_OPS + 1 }, () => retitle[0]),
        },
      ],
      ['an extra field', { op: 'patchDocument', key: 'brief', patch: retitle, tree: {} }],
    ];
    for (const [label, op] of refused) expect(parseEditOp(op).ok, label).toBe(false);
    expect(isDocumentPatch(retitle)).toBe(true);
    expect(isDocumentPatch({})).toBe(false);
    // A provenance entry carrying a hostile patch is refused when the envelope is read.
    const envelope = parseEnvelope({
      ...golden,
      provenance: [
        {
          at: '2026-10-29T09:05:00Z',
          actor: 'Harbor assistant',
          kind: 'apply',
          ops: [{ op: 'patchDocument', key: 'brief', patch: [{ op: 'eval', path: '/' }] }],
        },
      ],
    });
    expect(envelope.issues.map((issue) => issue.code)).toContain('invalid-ops');
  });

  it('applies a patch by key or by path, and its inverse restores the tree exactly', () => {
    expect(findNodeKey(page, 'brief')).toEqual([0]);
    expect(findNodeKey(page, 'missing')).toBeUndefined();
    for (const op of [
      { op: 'patchDocument', key: 'brief', patch: retitle },
      { op: 'patchDocument', path: [0], patch: retitle },
    ] as EditOp[]) {
      const result = applyEditOps(page, [op], { patchDocument });
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(doc(result.tree.children?.[0]).meta.title).toBe('Launch brief, revised');
      // The input tree is never mutated.
      expect(doc(page.children?.[0]).meta.title).toBe('Launch brief');
      const undone = applyEditOps(result.tree, result.inverse, { patchDocument });
      expect(undone.ok && undone.tree).toEqual(page);
    }
  });

  it('refuses without a patcher, off a document, on a failed test and on an invalid result', () => {
    const op = (patch: unknown, address: Record<string, unknown> = { key: 'brief' }) =>
      ({ op: 'patchDocument', ...address, patch }) as EditOp;
    const code = (ops: EditOp[], withPatcher = true) => {
      const result = applyEditOps(page, ops, withPatcher ? { patchDocument } : {});
      return result.ok ? 'ok' : result.error.code;
    };
    expect(code([op(retitle)], false)).toBe('invalid-op');
    expect(code([op(retitle, { path: [] })])).toBe('invalid-op');
    expect(code([op(retitle, { key: 'missing' })])).toBe('path-not-found');
    expect(code([op([{ op: 'test', path: '/meta/title', value: 'Other' }])])).toBe('invalid-value');
    // The result must stay a valid document: a script link is refused by the patcher.
    const hostile = [
      {
        op: 'add',
        path: '/blocks/-',
        value: {
          id: 'evil',
          type: 'paragraph',
          content: [
            { type: 'text', text: 'x', marks: [{ type: 'link', href: 'javascript:alert(1)' }] },
          ],
        },
      },
    ];
    expect(code([op(hostile)])).toBe('invalid-value');
    for (const path of ['/__proto__/polluted', '/constructor/prototype/x', '/meta/~2']) {
      expect(code([op([{ op: 'add', path, value: 1 }])]), path).toBe('invalid-value');
    }
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    // All or none: a failing second op leaves nothing applied.
    const batch = applyEditOps(page, [op(retitle), op([{ op: 'remove', path: '/nope' }])], {
      patchDocument,
    });
    expect(batch.ok).toBe(false);
    expect(doc(page.children?.[0]).meta.title).toBe('Launch brief');
  });

  it('commits through the full draft gate in an edit history, with undo and redo', async () => {
    const catalog = renderCatalogFromBuild(
      (await buildCatalog(await discoverManifestGroups())).catalog
    );
    const history = createEditHistory(tree, {
      patchDocument,
      validate: draftCommitGate({ catalog, checkBlock: safeParseBlock, checkDocument }),
    });
    const ok = history.apply({ op: 'patchDocument', key: 'brief', patch: retitle });
    expect(ok.ok).toBe(true);
    expect(doc(history.tree).meta.title).toBe('Launch brief, revised');
    // A patch the document engine accepts but the catalog refuses: an embed of app chrome.
    const chrome = history.apply({
      op: 'patchDocument',
      key: 'brief',
      patch: [
        {
          op: 'add',
          path: '/blocks/-',
          value: {
            id: 'chrome',
            type: 'embed',
            kind: 'component',
            inline: { id: 'dialog', props: {} },
          },
        },
      ],
    });
    expect(chrome.ok).toBe(false);
    expect(!chrome.ok && chrome.error.code).toBe('validation-failed');
    expect(history.undo()).toBe(true);
    expect(history.tree).toEqual(tree);
    expect(history.redo()).toBe(true);
    expect(validateDraft(history.tree, { catalog, checkDocument }).ok).toBe(true);
  });

  it('patches a large document in linear time', () => {
    const blocks = Array.from({ length: 1500 }, (_, i) => ({
      id: `p${i}`,
      type: 'paragraph',
      content: [{ type: 'text', text: 'Fictional text.', marks: [] }],
    }));
    const big: CatalogTreeInput = { ...tree, props: { doc: { ...doc(tree), blocks } } };
    const patch = Array.from({ length: 1000 }, (_, i) => ({
      op: 'replace',
      path: `/blocks/${i}/content/0/text`,
      value: `Edited ${i}.`,
    }));
    expect(parseEditOps([{ op: 'patchDocument', key: 'brief', patch }]).ok).toBe(true);
    const started = performance.now();
    const result = applyEditOps(big, [{ op: 'patchDocument', key: 'brief', patch } as EditOp], {
      patchDocument,
    });
    expect(result.ok).toBe(true);
    expect(performance.now() - started).toBeLessThan(3_000);
  });
});
