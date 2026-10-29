// @vitest-environment node
import { readFileSync } from 'node:fs';
import { safeParseBlock } from '@texuli/blocks/core';
import { describe, expect, it } from 'vitest';
import { documentJsonSchema } from '../../document/src/schema/index.ts';
import { buildCatalog } from '../src/build/build.ts';
import { discoverManifestGroups } from '../src/build/node.ts';
import { renderCatalogFromBuild } from '../src/render/renderer/index.ts';
import {
  DRAFT_FRAME_IDS,
  type DraftValidation,
  MAX_DOCUMENT_FINDINGS,
  validateDraft,
  validateStreamNode,
} from '../src/validate/index.ts';
import { checkDocument } from './document-check.ts';

/**
 * Documents in blueprints (spec 0.7.0, ADR-011): a `document` node is
 * checked by the host's document validator at the draft's tier, and what
 * the document borrows from the catalog (wrapped blocks, component embeds)
 * is checked as catalog nodes at the same tier. Nothing is weakened: no
 * validator, no document.
 */

const build = await buildCatalog(await discoverManifestGroups());
const catalog = renderCatalogFromBuild(build.catalog);
const options = { catalog, checkBlock: safeParseBlock, checkDocument };

const golden = JSON.parse(
  readFileSync(new URL('../../spec/fixtures/golden/document-brief.json', import.meta.url), 'utf8')
) as { tree: { props: { doc: { blocks: unknown[] } & Record<string, unknown> } } };
const baseDoc = golden.tree.props.doc;

const paragraph = (id: string, text: string, marks: unknown[] = []) => ({
  id,
  type: 'paragraph',
  content: [{ type: 'text', text, marks }],
});
const withBlocks = (...blocks: unknown[]) => ({
  key: 'notes',
  id: 'document',
  props: { doc: { ...baseDoc, blocks: [...baseDoc.blocks, ...blocks] } },
});
const codes = (result: DraftValidation) =>
  result.diagnostics.filter((d) => d.severity === 'error').map((d) => `${d.check}:${d.code}`);

describe('documents in validateDraft', () => {
  it('accepts the golden document as a frame root at the untrusted tier', () => {
    expect(DRAFT_FRAME_IDS).toContain('document');
    const result = validateDraft(golden, options);
    expect(codes(result)).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.checks.documents).toBe('pass');
    expect(result.roots[0]).toMatchObject({ kind: 'component', id: 'document', key: 'brief' });
  });

  it('refuses every document without the host validator (document-unchecked)', () => {
    const result = validateDraft(golden, { catalog, checkBlock: safeParseBlock });
    expect(codes(result)).toEqual(['documents:document-unchecked']);
    expect(result.checks.documents).toBe('fail');
    // Inside another tree too.
    const nested = validateDraft(
      { id: 'layout-page', props: { title: 'Page' }, children: [golden.tree] },
      { catalog }
    );
    expect(codes(nested)).toContain('documents:document-unchecked');
  });

  it('refuses hostile documents with the document, sink or catalog check that owns the rule', () => {
    const cases: [string, unknown, string][] = [
      [
        'a javascript: link',
        withBlocks(paragraph('x', 'Open', [{ type: 'link', href: 'javascript:alert(1)' }])),
        'documents:document-schema',
      ],
      [
        'a data: link',
        withBlocks(paragraph('x', 'Open', [{ type: 'link', href: 'data:text/html,<b>x</b>' }])),
        'documents:document-schema',
      ],
      ['an HTML string', withBlocks(paragraph('x', '<img src=x onerror=alert(1)>')), 'sinks:sink'],
      ['a bidi override', withBlocks(paragraph('x', 'evil\u202Etxt.exe')), 'documents:document-schema'],
      [
        'an unknown block type',
        withBlocks({ id: 'x', type: 'script', text: 'alert(1)' }),
        'documents:document-schema',
      ],
      [
        'a duplicate block id',
        withBlocks(paragraph('title', 'Again')),
        'documents:document-schema',
      ],
      [
        'an event handler key',
        withBlocks({ ...paragraph('x', 'Hi'), onclick: 'alert(1)' }),
        'sinks:sink',
      ],
      [
        'a wrapped block that is not a stat',
        withBlocks({
          id: 'x',
          type: 'block',
          family: 'data',
          block: 'stat',
          props: { items: 'many' },
        }),
        'documents:document-block',
      ],
      [
        'a component embed of app chrome',
        withBlocks({
          id: 'x',
          type: 'embed',
          kind: 'component',
          inline: { id: 'dialog', props: { open: true } },
        }),
        'documents:document-embed',
      ],
      [
        'a component embed of an unknown id',
        withBlocks({
          id: 'x',
          type: 'embed',
          kind: 'component',
          inline: { id: 'iframe', props: {} },
        }),
        'documents:document-embed',
      ],
      [
        'a component embed with a script URL',
        withBlocks({
          id: 'x',
          type: 'embed',
          kind: 'component',
          inline: { id: 'media-image', props: { src: 'javascript:alert(1)', alt: 'x' } },
        }),
        'sinks:sink',
      ],
      [
        'a document inside a document',
        withBlocks({
          id: 'x',
          type: 'embed',
          kind: 'component',
          inline: { id: 'document', props: {} },
        }),
        'documents:document-nested',
      ],
      [
        'another format',
        { id: 'document', props: { doc: { ...baseDoc, format: 'html' } } },
        'documents:document-schema',
      ],
      ['no doc', { id: 'document', props: {} }, 'render:schema-failure'],
    ];
    for (const [label, tree, expected] of cases) {
      const result = validateDraft(tree, options);
      expect(result.ok, label).toBe(false);
      expect(codes(result), label).toContain(expected);
    }
  });

  it('checks URLs at the host tier, never the tier a draft claims', () => {
    for (const href of ['/docs/start', 'http://example.com/']) {
      const tree = withBlocks(paragraph('x', 'Docs', [{ type: 'link', href }]));
      // The untrusted tier refuses relative and plain http links; a developer-tier host may allow them.
      expect(validateDraft(tree, options).ok, href).toBe(false);
      expect(validateDraft(tree, { ...options, tier: 'developer' }).ok, href).toBe(true);
    }
    // A draft cannot raise its own tier.
    const claimed = {
      ...golden,
      tier: 'developer',
      tree: withBlocks(paragraph('x', 'Docs', [{ type: 'link', href: '/docs' }])),
    };
    expect(validateDraft(claimed, options).ok).toBe(false);
  });

  it('caps the findings of one document and stays linear on a hostile one', () => {
    const many = Array.from({ length: 1500 }, (_, i) => ({
      id: `e${i}`,
      type: 'embed',
      kind: 'component',
      inline: { id: 'dialog', props: {} },
    }));
    const started = performance.now();
    const result = validateDraft(withBlocks(...many), {
      ...options,
      limits: { maxBytes: 1_000_000 },
    });
    const elapsed = performance.now() - started;
    expect(result.diagnostics.filter((d) => d.check === 'documents').length).toBe(
      MAX_DOCUMENT_FINDINGS
    );
    expect(elapsed).toBeLessThan(2_000);
    // A long, valid document validates in linear time too.
    const long = Array.from({ length: 1900 }, (_, i) =>
      paragraph(`p${i}`, 'Fictional text. '.repeat(4))
    );
    const t0 = performance.now();
    expect(
      validateDraft(withBlocks(...long), { ...options, limits: { maxBytes: 1_000_000 } }).ok
    ).toBe(true);
    expect(performance.now() - t0).toBeLessThan(2_000);
  });

  it('never throws on a throwing host validator, and refuses', () => {
    const result = validateDraft(golden, {
      ...options,
      checkDocument: () => {
        throw new Error('boom');
      },
    });
    expect(result.ok).toBe(false);
    expect(codes(result)).toEqual(['documents:document-schema']);
  });

  it('streams: a document shell is checked like the whole draft, and a repeated key is refused', () => {
    const shell = golden.tree as unknown as Record<string, unknown>;
    expect(
      validateStreamNode({ header: null, ancestors: [], shell, index: 0, admitted: 0 }, options).ok
    ).toBe(true);
    const hostile = withBlocks(
      paragraph('x', 'Open', [{ type: 'link', href: 'javascript:alert(1)' }])
    );
    expect(
      validateStreamNode(
        { header: null, ancestors: [], shell: hostile, index: 0, admitted: 0 },
        options
      ).ok
    ).toBe(false);
    expect(
      validateStreamNode({ header: null, ancestors: [], shell, index: 0, admitted: 0 }, { catalog })
        .ok
    ).toBe(false);
    const repeated = validateStreamNode(
      {
        header: null,
        ancestors: [],
        shell,
        index: 0,
        admitted: 1,
        admittedKeys: new Set(['brief']),
      },
      options
    );
    expect(repeated.ok).toBe(false);
    expect(repeated.diagnostics[0]?.code).toBe('duplicate-key');
  });
});

describe('node keys in validateDraft (spec 0.7.0)', () => {
  const page = (...children: unknown[]) => ({
    key: 'page',
    id: 'layout-doc',
    props: { title: 'Week 43' },
    children,
  });
  const text = (key: unknown) => ({
    key,
    id: 'blocks-text',
    props: { block: { type: 'text', markdown: 'Hi.' } },
  });

  it('keeps well-formed unique keys on the draft and the render tree', () => {
    const result = validateDraft(page(text('a'), text('b')), options);
    expect(result.ok).toBe(true);
    expect(
      (result.draft as unknown as { children: { key: string }[] }).children.map((c) => c.key)
    ).toEqual(['a', 'b']);
    const root = result.roots[0];
    expect(
      root?.kind === 'component' &&
        root.children.map((c) => (c.kind === 'component' ? c.key : null))
    ).toEqual(['a', 'b']);
  });

  it('refuses malformed and repeated keys', () => {
    expect(codes(validateDraft(page(text('a'), text('a')), options))).toEqual([
      'structure:duplicate-key',
    ]);
    expect(codes(validateDraft(page(text('page')), options))).toEqual(['structure:duplicate-key']);
    for (const bad of ['', 'a b', 'x'.repeat(65), 3, '__proto__/x']) {
      expect(codes(validateDraft(page(text(bad)), options)), String(bad)).toEqual([
        'structure:invalid-key',
      ]);
    }
  });
});

describe('the pinned document schema', () => {
  it('packages/spec/schemas/document.schema.json equals @texuli/document documentJsonSchema()', () => {
    const pinned = JSON.parse(
      readFileSync(new URL('../../spec/schemas/document.schema.json', import.meta.url), 'utf8')
    ) as unknown;
    expect(pinned).toEqual(JSON.parse(JSON.stringify(documentJsonSchema())));
  });
});
