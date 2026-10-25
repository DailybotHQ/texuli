/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createEditorIds,
  type EditorBlock,
  type EditorDocument,
  editorCharCount,
  editorLeaves,
  validateEditorDocument,
} from '@texuli/core/editor-model';
import { safeHref } from '@texuli/core/url-policy';
import { describe, expect, it } from 'vitest';
import {
  decodeEntities,
  EDITOR_CLIPBOARD_TYPE,
  importEditorJson,
  importHtml,
  importPlainText,
  PASTE_LIMITS,
  readClipboard,
  tokenizeHtml,
} from '../src/paste/index.ts';

const newId = createEditorIds('p');
const html = (source: string) => importHtml(source, { newId });

/** A pasted fragment is valid when it is empty or a valid document. */
const fragmentIssues = (doc: EditorDocument) =>
  doc.blocks.length === 0 ? [] : validateEditorDocument(doc);

/** Every link href in a document. */
function hrefs(doc: EditorDocument): string[] {
  const out: string[] = [];
  for (const { block } of editorLeaves(doc)) {
    if (block.type !== 'paragraph' && block.type !== 'heading') continue;
    for (const run of block.content)
      if (run.type === 'text')
        for (const mark of run.marks) if (mark.type === 'link') out.push(mark.href);
  }
  return out;
}

const texts = (doc: EditorDocument) =>
  editorLeaves(doc).map(({ block }) =>
    block.type === 'paragraph' || block.type === 'heading'
      ? block.content.map((run) => (run.type === 'text' ? run.text : '\n')).join('')
      : block.type === 'code'
        ? block.text
        : `[${block.type}]`
  );

const depthOf = (blocks: readonly EditorBlock[]): number =>
  Math.max(
    0,
    ...blocks.map((block) =>
      block.type === 'quote'
        ? 1 + depthOf(block.blocks)
        : block.type === 'list'
          ? 1 + Math.max(0, ...block.items.map((item) => depthOf(item.blocks)))
          : 0
    )
  );

/** Every string in the shared hostile corpus. */
function corpusStrings(): string[] {
  const corpus = JSON.parse(
    readFileSync(join(import.meta.dirname, '../../../tests/fixtures/hostile/corpus.json'), 'utf8')
  );
  const out: string[] = [];
  const visit = (value: unknown) => {
    if (typeof value === 'string') out.push(value);
    else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') Object.values(value).forEach(visit);
  };
  visit(corpus);
  return out;
}

describe('HTML tokenizer', () => {
  it('reads tags, attributes and character references without a DOM', () => {
    expect(
      tokenizeHtml('<a href="https://example.com/?a=1&amp;b=2" onclick="x()">Hi &lt;3</a>')
    ).toEqual([
      {
        kind: 'open',
        name: 'a',
        attrs: { href: 'https://example.com/?a=1&b=2' },
        selfClosing: false,
      },
      { kind: 'text', text: 'Hi <3' },
      { kind: 'close', name: 'a' },
    ]);
    expect(decodeEntities('&#x1F600; &#128512; &#0; &#xD800; &bogus; &amp')).toBe(
      `${String.fromCodePoint(0x1f600)} ${String.fromCodePoint(0x1f600)} ${String.fromCharCode(0xfffd)} ${String.fromCharCode(0xfffd)} &bogus; &`
    );
  });

  it('drops scripts, styles, templates and comments with their content', () => {
    const tokens = tokenizeHtml(
      '<p>a<script>alert(1)</script>b<style>p{}</style>c<!-- <b>x</b> -->d<template><p>t</p></template>e</p>'
    );
    const text = tokens.flatMap((t) => (t.kind === 'text' ? [t.text] : [])).join('');
    expect(text).toBe('abcde');
  });

  it('treats a stray < as text and an unterminated tag as the end', () => {
    expect(texts(html('<p>1 < 2 and 3 > 2</p>').doc)).toEqual(['1 < 2 and 3 > 2']);
    expect(texts(html('<p>kept</p><b unterminated').doc)).toEqual(['kept']);
  });
});

describe('HTML import maps the allowlist onto the vocabulary', () => {
  it('imports paragraphs, headings, marks, lists, todos, quotes, code and dividers', () => {
    const { doc, diagnostics, source } = html(
      [
        '<h1>Title</h1><h6>Deep</h6>',
        '<p>Some <b>bold</b>, <em>em</em>, <del>gone</del> and <code>x()</code><br>next</p>',
        '<ul><li>one</li><li>two<ol><li>nested</li></ol></li></ul>',
        '<ul><li><input type="checkbox" checked> done</li><li><input type="checkbox"> open</li></ul>',
        '<blockquote><p>quoted</p></blockquote>',
        '<pre><code>let a = 1;\n  a += 1;</code></pre>',
        '<hr>',
        '<div>Plain <span style="color:red">div</span> <img src="x.png" alt="an image"></div>',
      ].join('')
    );
    expect(source).toBe('html');
    expect(validateEditorDocument(doc)).toEqual([]);
    expect(doc.blocks.map((b) => b.type)).toEqual([
      'heading',
      'heading',
      'paragraph',
      'list',
      'list',
      'quote',
      'code',
      'divider',
      'paragraph',
    ]);
    const [h1, h6, para, bullets, todos] = doc.blocks;
    expect(h1?.type === 'heading' && h1.level).toBe(1);
    expect(h6?.type === 'heading' && h6.level).toBe(4);
    expect(diagnostics.map((d) => d.code)).toContain('heading-clamped');
    if (para?.type !== 'paragraph') throw new Error('paragraph');
    expect(para.content).toEqual([
      { type: 'text', text: 'Some ', marks: [] },
      { type: 'text', text: 'bold', marks: [{ type: 'strong' }] },
      { type: 'text', text: ', ', marks: [] },
      { type: 'text', text: 'em', marks: [{ type: 'em' }] },
      { type: 'text', text: ', ', marks: [] },
      { type: 'text', text: 'gone', marks: [{ type: 'strike' }] },
      { type: 'text', text: ' and ', marks: [] },
      { type: 'text', text: 'x()', marks: [{ type: 'code' }] },
      { type: 'break' },
      { type: 'text', text: 'next', marks: [] },
    ]);
    expect(bullets?.type === 'list' && bullets.kind).toBe('bullet');
    expect(bullets?.type === 'list' && bullets.items[1]?.blocks[1]?.type).toBe('list');
    expect(todos?.type === 'list' && todos.kind).toBe('todo');
    expect(todos?.type === 'list' && todos.items.map((i) => i.checked)).toEqual([true, false]);
    expect(texts(doc).slice(-4)).toEqual([
      'quoted',
      'let a = 1;\n  a += 1;',
      '[divider]',
      'Plain div an image',
    ]);
  });

  it('collapses whitespace outside pre and keeps it inside', () => {
    expect(texts(html('<p>\n  a   b \n</p><pre>\n  x  y\n</pre>').doc)).toEqual([
      'a b',
      '  x  y\n',
    ]);
  });
});

describe('hostile paste degrades, never throws, never renders raw', () => {
  it('refuses executable and unsafe links but keeps their text (fails without the URL policy)', () => {
    const { doc, diagnostics, linksRemoved } = html(
      [
        '<a href="javascript:alert(1)">js</a>',
        '<a href=" JaVaScRiPt:alert(1)">spaced</a>',
        '<a href="data:text/html,<script>x</script>">data</a>',
        '<a href="vbscript:msgbox(1)">vb</a>',
        '<a href="http://example.com">plain http</a>',
        '<a href="https://user:pw@example.com">credentials</a>',
        '<a href="https://example.com/ok">ok</a>',
      ].join(' ')
    );
    expect(hrefs(doc)).toEqual(['https://example.com/ok']);
    expect(texts(doc)).toEqual(['js spaced data vb plain http credentials ok']);
    expect(diagnostics.map((d) => d.code)).toContain('link-rejected');
    expect(linksRemoved).toBe(6);
  });

  it('never reads event handlers, styles or image sources', () => {
    const { doc } = html(
      '<img src="x" onerror="alert(1)" alt="pic"><p onclick="alert(1)" style="background:url(javascript:x)">t</p>'
    );
    expect(JSON.stringify(doc)).not.toMatch(/onerror|onclick|alert|style|src/);
    expect(texts(doc)).toEqual(['pic', 't']);
  });

  it('keeps markup-looking text as literal text', () => {
    const { doc } = html('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
    expect(texts(doc)).toEqual(['<script>alert(1)</script>']);
    expect(hrefs(doc)).toEqual([]);
  });

  it('strips control and bidirectional override characters, also from character references', () => {
    const rlo = String.fromCharCode(0x202e);
    const { doc, diagnostics } = html(`<p>a${rlo}b&#x202E;c&#8238;d&#7;e</p>`);
    expect(texts(doc)).toEqual(['abcde']);
    expect(diagnostics.map((d) => d.code)).toContain('characters-stripped');
  });

  it('caps deep nesting (lists and quotes) at the document depth', () => {
    const deep = `${'<ul><li>x'.repeat(5_000)}${'</li></ul>'.repeat(5_000)}`;
    const quotes = `${'<blockquote>'.repeat(5_000)}q${'</blockquote>'.repeat(5_000)}`;
    for (const source of [deep, quotes]) {
      const { doc } = html(source);
      expect(fragmentIssues(doc)).toEqual([]);
      expect(texts(doc).join('')).toContain(source === deep ? 'x' : 'q');
      expect(depthOf(doc.blocks)).toBeLessThanOrEqual(4);
    }
  });

  it('survives HTML bombs: floods of tags, marks and empty elements', () => {
    const bombs = [
      '<div>'.repeat(200_000),
      `${'<b><i><s><a href="https://example.com">'.repeat(30_000)}x`,
      '<p></p>'.repeat(150_000),
      '<hr>'.repeat(100_000),
      `<a href="${'https://example.com/'.padEnd(500_000, 'a')}">long</a>`,
      `<p title="${'"'.repeat(10)}${'<'.repeat(300_000)}`,
    ];
    for (const source of bombs) {
      const started = performance.now();
      const { doc } = html(source);
      expect(performance.now() - started).toBeLessThan(5_000);
      expect(fragmentIssues(doc)).toEqual([]);
      expect(doc.blocks.length).toBeLessThanOrEqual(2_000);
    }
  });

  it('cuts oversized clipboards to the source and document caps', () => {
    const huge = 'word '.repeat(400_000);
    for (const result of [importPlainText(huge), html(`<p>${huge}</p>`)]) {
      expect(editorCharCount(result.doc)).toBeLessThanOrEqual(200_000);
      expect(result.diagnostics.map((d) => d.code)).toContain('text-truncated');
    }
    const paragraphs = importPlainText('para\n\n'.repeat(10_000));
    expect(paragraphs.doc.blocks.length).toBe(2_000);
    expect(paragraphs.diagnostics.map((d) => d.code)).toContain('blocks-capped');
    expect(PASTE_LIMITS.source).toBe(1_000_000);
  });

  it('handles every string of the shared hostile corpus as HTML, text and link', () => {
    for (const value of corpusStrings()) {
      const attr = value.replace(/"/g, '&quot;');
      for (const result of [
        html(value),
        importPlainText(value),
        html(`<a href="${attr}">link</a>`),
        importEditorJson(value),
      ]) {
        expect(fragmentIssues(result.doc)).toEqual([]);
        for (const href of hrefs(result.doc)) expect(safeHref(href, 'untrusted')).toBe(href);
      }
    }
  });
});

describe('clipboard formats', () => {
  it('prefers the editor JSON, then HTML, then plain text, and re-checks the JSON', () => {
    const own = JSON.stringify({
      version: 1,
      blocks: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'mine', marks: [{ type: 'link', href: 'javascript:alert(1)' }] },
          ],
        },
      ],
    });
    const data = (types: Record<string, string>) => ({
      getData: (type: string) => types[type] ?? '',
    });
    const fromOwn = readClipboard(data({ [EDITOR_CLIPBOARD_TYPE]: own, 'text/html': '<p>h</p>' }));
    expect(fromOwn.source).toBe('editor');
    expect(texts(fromOwn.doc)).toEqual(['mine']);
    expect(hrefs(fromOwn.doc)).toEqual([]);
    expect(readClipboard(data({ 'text/html': '<p>h</p>', 'text/plain': 'p' })).source).toBe('html');
    expect(
      readClipboard(data({ 'text/html': '<script>x</script>', 'text/plain': 'p' })).source
    ).toBe('text');
    expect(readClipboard(data({})).source).toBe('empty');
    expect(
      readClipboard({
        getData: () => {
          throw new Error('denied');
        },
      }).source
    ).toBe('empty');
    expect(importEditorJson('{not json').source).toBe('empty');
  });

  it('splits plain text on blank lines and keeps single newlines as breaks, without Markdown', () => {
    const { doc } = importPlainText('# not a heading\nline two\n\n**not bold**');
    expect(doc.blocks.map((b) => b.type)).toEqual(['paragraph', 'paragraph']);
    expect(texts(doc)).toEqual(['# not a heading\nline two', '**not bold**']);
  });
});
