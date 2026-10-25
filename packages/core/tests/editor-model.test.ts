import { describe, expect, it } from 'vitest';
import {
  caret,
  clampSelection,
  cleanText,
  createEditorIds,
  EDITOR_LIMITS,
  type EditorBlock,
  type EditorDocument,
  type EditorInline,
  editorLeaves,
  editorPlainText,
  inheritedMarks,
  inlineFromTree,
  inlineToTree,
  loadEditorDocument,
  nextGrapheme,
  nextWord,
  normalizeDocument,
  normalizeInline,
  previousGrapheme,
  previousWord,
  selectAll,
  selectionRange,
  snapToGrapheme,
  textSelection,
  validateEditorDocument,
} from '../src/editor/model.ts';

const t = (text: string, ...marks: ('strong' | 'em' | 'strike' | 'code')[]): EditorInline => ({
  type: 'text',
  text,
  marks: marks.map((type) => ({ type })),
});

const depthOf = (doc: EditorDocument) =>
  Math.max(0, ...editorLeaves(doc).map((leaf) => leaf.depth));

describe('editor inline content', () => {
  it('merges equal neighbors, drops empty runs, sorts marks and keeps canonical input as is', () => {
    const content = normalizeInline([
      t('a', 'em', 'strong'),
      t('', 'strong'),
      t('b', 'strong', 'em'),
      { type: 'break' },
      t('c'),
    ]);
    expect(content).toEqual([
      { type: 'text', text: 'ab', marks: [{ type: 'strong' }, { type: 'em' }] },
      { type: 'break' },
      { type: 'text', text: 'c', marks: [] },
    ]);
    expect(normalizeInline(content)).toBe(content);
  });

  it('lets code exclude every mark but link', () => {
    const [run] = normalizeInline([
      {
        type: 'text',
        text: 'x',
        marks: [
          { type: 'strong' },
          { type: 'code' },
          { type: 'link', href: 'https://example.com' },
        ],
      },
    ]);
    expect(run).toEqual({
      type: 'text',
      text: 'x',
      marks: [{ type: 'link', href: 'https://example.com' }, { type: 'code' }],
    });
  });

  it('strips control and bidirectional override characters, keeping what code needs', () => {
    expect(cleanText('a\u202Eb\u0007c\u200Bd')).toEqual({ text: 'abcd', stripped: true });
    expect(cleanText('a\tb\nc', '\n\t')).toEqual({ text: 'a\tb\nc', stripped: false });
    expect(cleanText('a\r\nb\u2028c', '\n').text).toBe('a\nb\nc');
  });

  it('continues a link only strictly inside it', () => {
    const link = { type: 'link' as const, href: 'https://example.com' };
    const content: EditorInline[] = [
      { type: 'text', text: 'ab', marks: [link] },
      { type: 'text', text: 'c', marks: [] },
    ];
    expect(inheritedMarks(content, 1)).toEqual([link]);
    expect(inheritedMarks(content, 2)).toEqual([]);
    expect(inheritedMarks(content, 0)).toEqual([]);
  });
});

describe('editor graphemes and words', () => {
  const family = '👨‍👩‍👧';
  const text = `a${family}é b`;

  it('never splits a grapheme cluster', () => {
    expect(nextGrapheme(text, 1)).toBe(1 + family.length);
    expect(previousGrapheme(text, 1 + family.length)).toBe(1);
    expect(snapToGrapheme(text, 3)).toBe(1);
    const accent = 1 + family.length;
    expect(nextGrapheme(text, accent)).toBe(accent + 2);
  });

  it('moves by words, skipping spaces and punctuation', () => {
    const words = 'one, two  three';
    expect(previousWord(words, words.length)).toBe(10);
    expect(previousWord(words, 10)).toBe(5);
    expect(nextWord(words, 3)).toBe(8);
    expect(nextWord(words, 0)).toBe(3);
  });
});

describe('editor documents', () => {
  it('normalizes containers and keeps unchanged blocks identical', () => {
    const kept: EditorBlock = { id: 'p1', type: 'paragraph', content: [t('kept')] };
    const doc = normalizeDocument(
      {
        version: 1,
        blocks: [
          kept,
          { id: 'q', type: 'quote', blocks: [] },
          {
            id: 'l',
            type: 'list',
            kind: 'bullet',
            start: 3,
            items: [
              {
                id: 'i1',
                checked: true,
                blocks: [{ id: 'h', type: 'heading', level: 2, content: [t('x')] }],
              },
              { id: 'i2', blocks: [{ id: 'd', type: 'divider' }] },
              { id: 'i3', blocks: [] },
            ],
          },
        ],
      },
      createEditorIds('n')
    );
    expect(doc.blocks[0]).toBe(kept);
    expect(doc.blocks).toHaveLength(2);
    expect(doc.blocks[1]).toEqual({
      id: 'l',
      type: 'list',
      kind: 'bullet',
      items: [
        { id: 'i1', blocks: [{ id: 'h', type: 'paragraph', content: [t('x')] }] },
        {
          id: 'i2',
          blocks: [
            { id: 'n1', type: 'paragraph', content: [] },
            { id: 'd', type: 'divider' },
          ],
        },
      ],
    });
    expect(validateEditorDocument(doc)).toEqual([]);
    expect(normalizeDocument(doc)).toBe(doc);
  });

  it('reports every broken invariant without throwing', () => {
    expect(validateEditorDocument(null)[0]?.code).toBe('invalid-shape');
    const codes = validateEditorDocument({
      version: 2,
      blocks: [
        { id: 'a', type: 'paragraph', content: [t('x'), t('y')] },
        { id: 'a', type: 'heading', level: 7, content: [] },
        { id: 'c', type: 'table' },
        {
          id: 'd',
          type: 'list',
          kind: 'todo',
          items: [{ id: 'e', blocks: [{ id: 'f', type: 'divider' }] }],
        },
        {
          id: 'g',
          type: 'paragraph',
          content: [{ type: 'text', text: 'bad\u202E', marks: [{ type: 'underline' }] }],
        },
      ],
    }).map((issue) => issue.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        'version-unsupported',
        'not-normalized',
        'duplicate-id',
        'invalid-shape',
        'unknown-node',
        'characters-stripped',
        'unknown-mark',
      ])
    );
  });

  it('flattens to plain text', () => {
    const { doc } = loadEditorDocument({
      version: 1,
      blocks: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'One' },
            { type: 'break' },
            { type: 'text', text: 'two' },
          ],
        },
        { type: 'media', ref: 'cover', alt: 'A cover' },
      ],
    });
    expect(editorPlainText(doc)).toBe('One\ntwo\n\nA cover');
  });
});

describe('loading untrusted documents', () => {
  it('keeps the vocabulary, refuses executable links and strips unsafe characters', () => {
    const { doc, diagnostics } = loadEditorDocument({
      version: 1,
      blocks: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'safe',
              marks: [{ type: 'link', href: 'https://example.com/a' }],
            },
            {
              type: 'text',
              text: ' evil',
              marks: [{ type: 'link', href: 'javascript:alert(1)' }, { type: 'underline' }],
            },
            { type: 'text', text: ' \u202Ehidden' },
          ],
        },
      ],
    });
    expect(validateEditorDocument(doc)).toEqual([]);
    expect(doc.blocks[0]).toMatchObject({
      type: 'paragraph',
      content: [
        { type: 'text', text: 'safe', marks: [{ type: 'link', href: 'https://example.com/a' }] },
        { type: 'text', text: ' evil hidden', marks: [] },
      ],
    });
    expect(diagnostics.map((d) => d.code)).toEqual([
      'link-rejected',
      'unknown-mark',
      'characters-stripped',
    ]);
  });

  it('honors the developer tier only when asked', () => {
    const input = {
      blocks: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'x', marks: [{ type: 'link', href: '/docs' }] }],
        },
      ],
    };
    const untrusted = loadEditorDocument(input).doc.blocks[0];
    const developer = loadEditorDocument(input, { trust: 'developer' }).doc.blocks[0];
    expect(JSON.stringify(untrusted)).not.toContain('/docs');
    expect(JSON.stringify(developer)).toContain('/docs');
  });

  it('degrades unknown blocks to their text and clamps headings', () => {
    const { doc, diagnostics } = loadEditorDocument({
      blocks: [
        { type: 'table', rows: [{ text: 'ignored key' }], content: [{ text: 'cell' }] },
        { type: 'heading', level: 6, content: 'Deep' },
        { type: 'heading', level: 'x', content: 'No level' },
        { type: 'media', ref: '', alt: 'no ref' },
        42,
      ],
    });
    expect(doc.blocks.map((b) => b.type)).toEqual(['paragraph', 'heading', 'paragraph']);
    expect(doc.blocks[1]).toMatchObject({ level: 4 });
    expect(diagnostics.map((d) => d.code)).toEqual([
      'unknown-node',
      'heading-clamped',
      'invalid-shape',
    ]);
  });

  it('refuses unknown versions and malformed roots', () => {
    expect(loadEditorDocument({ version: 9, blocks: [] }).diagnostics[0]?.code).toBe(
      'version-unsupported'
    );
    for (const input of [null, 'text', [], { blocks: 'no' }]) {
      const { doc } = loadEditorDocument(input);
      expect(validateEditorDocument(doc)).toEqual([]);
      expect(doc.blocks).toHaveLength(1);
    }
  });

  it('caps nesting: 10,000 nested quotes load at most 4 deep, without recursion blowups', () => {
    let node: Record<string, unknown> = { type: 'paragraph', content: 'core' };
    for (let i = 0; i < 10_000; i += 1) node = { type: 'quote', blocks: [node] };
    const { doc, diagnostics } = loadEditorDocument({ blocks: [node] });
    expect(validateEditorDocument(doc)).toEqual([]);
    expect(depthOf(doc)).toBeLessThanOrEqual(EDITOR_LIMITS.depth);
    expect(diagnostics.map((d) => d.code)).toContain('depth-capped');
  });

  it('caps size: blocks and characters past the limits are dropped', () => {
    const many = {
      blocks: Array.from({ length: 5_000 }, (_, i) => ({ type: 'paragraph', content: `p${i}` })),
    };
    const capped = loadEditorDocument(many);
    expect(capped.doc.blocks).toHaveLength(EDITOR_LIMITS.blocks);
    expect(capped.diagnostics.map((d) => d.code)).toContain('blocks-capped');

    const huge = loadEditorDocument({
      blocks: [{ type: 'paragraph', content: 'x'.repeat(300_000) }],
    });
    expect(editorPlainText(huge.doc)).toHaveLength(EDITOR_LIMITS.chars);
    expect(huge.diagnostics.map((d) => d.code)).toContain('text-truncated');

    const small = loadEditorDocument(many, { limits: { blocks: 3 } });
    expect(small.doc.blocks).toHaveLength(3);
  });

  it('survives cyclic and hostile shapes', () => {
    const cyclic: Record<string, unknown> = { type: 'quote' };
    cyclic.blocks = [cyclic];
    const odd = {
      type: 'list',
      kind: 'todo',
      items: [
        { checked: 'yes', blocks: [{ type: 'paragraph', content: [{ type: 'text', text: 7 }] }] },
        null,
      ],
    };
    const { doc } = loadEditorDocument({
      blocks: [cyclic, odd, { type: 'code', text: 'x\ty', lang: 'Not a lang!' }],
    });
    expect(validateEditorDocument(doc)).toEqual([]);
    expect(doc.blocks.at(-1)).toMatchObject({ type: 'code', text: 'x\ty' });
    expect(doc.blocks.at(-1)).not.toHaveProperty('lang');
  });
});

describe('editor selection', () => {
  const doc: EditorDocument = {
    version: 1,
    blocks: [
      { id: 'a', type: 'paragraph', content: [t('one')] },
      { id: 'd', type: 'divider' },
      { id: 'b', type: 'paragraph', content: [t('a👨‍👩‍👧b')] },
    ],
  };

  it('orders a backward selection and clamps offsets to graphemes', () => {
    const range = selectionRange(
      doc,
      textSelection({ block: 'b', offset: 1 }, { block: 'a', offset: 2 })
    );
    expect(range?.from).toEqual({ block: 'a', offset: 2, index: 0 });
    expect(range?.to).toEqual({ block: 'b', offset: 1, index: 2 });
    expect(clampSelection(doc, caret('b', 3))).toEqual(caret('b', 1));
    expect(clampSelection(doc, caret('b', 99))).toEqual(caret('b', 10));
    expect(clampSelection(doc, caret('missing', 1))).toEqual(caret('a', 0));
    expect(clampSelection(doc, caret('d'))).toEqual(caret('a', 0));
    expect(selectAll(doc)).toEqual(
      textSelection({ block: 'a', offset: 0 }, { block: 'b', offset: 10 })
    );
  });
});

describe('inline tree interchange', () => {
  it('folds runs into nested nodes and back', () => {
    const link = { type: 'link' as const, href: 'https://example.com' };
    const content: EditorInline[] = [
      { type: 'text', text: 'a', marks: [link, { type: 'strong' }] },
      { type: 'text', text: 'b', marks: [link, { type: 'strong' }, { type: 'em' }] },
      { type: 'text', text: 'c', marks: [link, { type: 'code' }] },
      { type: 'break' },
      { type: 'text', text: 'd', marks: [{ type: 'strike' }] },
    ];
    const tree = inlineToTree(content);
    expect(tree).toEqual([
      {
        type: 'link',
        href: 'https://example.com',
        children: [
          {
            type: 'strong',
            children: [
              { type: 'text', text: 'a' },
              { type: 'em', children: [{ type: 'text', text: 'b' }] },
            ],
          },
          { type: 'code', text: 'c' },
        ],
      },
      { type: 'break' },
      { type: 'strike', children: [{ type: 'text', text: 'd' }] },
    ]);
    expect(inlineFromTree(tree).content).toEqual(content);
  });

  it('reads catalog and blocks shapes and degrades hostile trees', () => {
    const catalog = [
      { type: 'em', children: [{ type: 'text', value: 'hi' }] },
      { type: 'del', children: [{ type: 'text', text: 'x' }] },
    ];
    expect(inlineFromTree(catalog).content).toEqual([
      { type: 'text', text: 'hi', marks: [{ type: 'em' }] },
      { type: 'text', text: 'x', marks: [{ type: 'strike' }] },
    ]);
    let deep: Record<string, unknown> = { type: 'text', text: 'core' };
    for (let i = 0; i < 50_000; i += 1) deep = { type: 'strong', children: [deep] };
    const hostile = inlineFromTree([
      deep,
      { type: 'link', href: 'javascript:alert(1)', children: [{ type: 'text', text: 'click' }] },
    ]);
    expect(
      hostile.content.map((n) => (n.type === 'text' ? n.marks.length : -1)).every((n) => n <= 1)
    ).toBe(true);
    expect(hostile.diagnostics.map((d) => d.code)).toEqual(['depth-capped', 'link-rejected']);
  });
});
