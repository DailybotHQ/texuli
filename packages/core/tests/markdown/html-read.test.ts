import { describe, expect, it } from 'vitest';
import {
  decodeHtmlEntities,
  HTML_TOKEN_LIMITS,
  htmlToMarkdownTree,
  tokenizeHtml,
} from '../../src/html/index.ts';
import type { MdBlock } from '../../src/markdown/ast.ts';
import { item, p, root, t } from './helpers.ts';

const read = (html: string, options = {}) => htmlToMarkdownTree(html, options);
const blocks = (html: string, options = {}) => read(html, options).tree.children;

describe('decodeHtmlEntities', () => {
  it('decodes numeric and named references', () => {
    expect(decodeHtmlEntities('&lt;&#60;&#x3c;&#X3C;&amp;&copy;&colon;&Tab;')).toBe('<<<<&©:\t');
  });

  it('decodes the legacy names without a semicolon, and no others', () => {
    expect(decodeHtmlEntities('&amp &lt &copy &colon &hellip')).toBe('& < © &colon &hellip');
  });

  it('turns zero, surrogates and out-of-range code points into U+FFFD', () => {
    expect(decodeHtmlEntities('&#0;&#xD800;&#x110000;')).toBe('���');
  });

  it('maps the C1 range as browsers do', () => {
    expect(decodeHtmlEntities('&#128;&#x93;')).toBe('€“');
  });

  it('keeps unknown names literal', () => {
    expect(decodeHtmlEntities('&bogus; & &;')).toBe('&bogus; & &;');
  });
});

describe('tokenizeHtml', () => {
  it('reads tags, kept attributes and text', () => {
    const tokens = tokenizeHtml('<a HREF="https://example.com" onclick="x()" class=y>hi</a>');
    expect(tokens.map((token) => token.kind)).toEqual(['start', 'text', 'end']);
    const start = tokens[0];
    expect(start?.kind === 'start' && start.attributes).toEqual({
      href: 'https://example.com',
      class: 'y',
    });
  });

  it('keeps the first of two equal attributes, as browsers do', () => {
    const [start] = tokenizeHtml('<a href="https://example.com/1" href="javascript:x">');
    expect(start?.kind === 'start' && start.attributes.href).toBe('https://example.com/1');
  });

  it('skips comments, doctypes, CDATA and processing instructions', () => {
    const tokens = tokenizeHtml(
      '<!doctype html><!-- c --><![CDATA[x]]><?php echo ?>a<!-->b<!--->c'
    );
    // `<![CDATA[x]]>` is a bogus comment up to its first `>` in HTML content.
    expect(
      tokens.filter((tk) => tk.kind === 'text').map((tk) => tk.kind === 'text' && tk.value)
    ).toEqual(['a', 'b', 'c']);
  });

  it('drops raw-text elements with their content', () => {
    const tokens = tokenizeHtml('a<script>alert("<b>")</script>b<style>p{}</style>c');
    expect(tokens.map((tk) => tk.kind)).toEqual(['text', 'dropped', 'text', 'dropped', 'text']);
  });

  it('reads a lone < as text and normalizes CRLF', () => {
    const tokens = tokenizeHtml('1 < 2\r\n3 <= 4 </ x> <');
    expect(tokens.map((tk) => (tk.kind === 'text' ? tk.value : tk.kind)).join('')).toBe(
      '1 < 2\n3 <= 4  <'
    );
  });

  it('drops an attribute value past the limit', () => {
    const long = `https://example.com/${'a'.repeat(HTML_TOKEN_LIMITS.attributeValue)}`;
    const [start] = tokenizeHtml(`<a href="${long}">`);
    expect(start?.kind === 'start' && start.attributes.href).toBeUndefined();
  });

  it('never throws on a non-string', () => {
    expect(tokenizeHtml(42 as unknown as string)).toEqual([]);
  });
});

describe('htmlToMarkdownTree: mapping', () => {
  it('maps blocks', () => {
    expect(blocks('<h2>T</h2><p>a</p><hr><blockquote><p>q</p></blockquote>')).toEqual([
      { type: 'heading', depth: 2, children: [t('T')] },
      p(t('a')),
      { type: 'thematicBreak' },
      { type: 'blockquote', children: [p(t('q'))] },
    ]);
  });

  it('maps inline marks, including the common aliases', () => {
    expect(
      blocks(
        '<p><b>b</b><strong>s</strong><i>i</i><em>e</em><s>x</s><del>d</del><strike>k</strike>' +
          '<u>u</u><ins>n</ins><kbd>k</kbd><code>c</code><tg-spoiler>t</tg-spoiler>' +
          '<span class="tg-spoiler">g</span><span data-spoiler>h</span>a<br>b</p>'
      )
    ).toEqual([
      p(
        { type: 'strong', children: [t('b')] },
        { type: 'strong', children: [t('s')] },
        { type: 'emphasis', children: [t('i')] },
        { type: 'emphasis', children: [t('e')] },
        { type: 'delete', children: [t('x')] },
        { type: 'delete', children: [t('d')] },
        { type: 'delete', children: [t('k')] },
        { type: 'underline', children: [t('u')] },
        { type: 'underline', children: [t('n')] },
        { type: 'inlineCode', value: 'k' },
        { type: 'inlineCode', value: 'c' },
        { type: 'spoiler', children: [t('t')] },
        { type: 'spoiler', children: [t('g')] },
        { type: 'spoiler', children: [t('h')] },
        t('a'),
        { type: 'break' },
        t('b')
      ),
    ]);
  });

  it('keeps the text of unknown and transparent elements and drops their tags', () => {
    expect(blocks('<div><custom-el x="1">a <font color=red>b</font></custom-el></div>')).toEqual([
      p(t('a b')),
    ]);
  });

  it('collapses whitespace like HTML, keeping line breaks as soft breaks', () => {
    expect(blocks('<p>\n  one   two\n   three  </p>')).toEqual([p(t('one two\nthree'))]);
    expect(blocks('<p> <b> x </b> y </p>')).toEqual([
      p({ type: 'strong', children: [t('x ')] }, t('y')),
    ]);
    expect(blocks('<p>a <i> b</i></p>')).toEqual([
      p(t('a '), { type: 'emphasis', children: [t('b')] }),
    ]);
  });

  it('wraps loose inline content into paragraphs and drops whitespace between blocks', () => {
    expect(blocks('text <b>bold</b>\n\n<p>para</p>\n tail')).toEqual([
      p(t('text '), { type: 'strong', children: [t('bold')] }),
      p(t('para')),
      p(t('tail')),
    ]);
  });

  it('reads tight and loose lists, start numbers and tasks', () => {
    expect(blocks('<ol start="3"><li>a<li>b</ol>')).toEqual([
      {
        type: 'list',
        ordered: true,
        start: 3,
        spread: false,
        children: [item([p(t('a'))]), item([p(t('b'))])],
      },
    ]);
    expect(blocks('<ul><li><p>a</p><p>b</p></li><li><p>c</p></li></ul>')).toEqual([
      {
        type: 'list',
        ordered: false,
        spread: true,
        children: [item([p(t('a')), p(t('b'))], undefined, true), item([p(t('c'))])],
      },
    ]);
    expect(
      blocks(
        '<ul><li><input type="checkbox" checked disabled> done</li><li><input type=checkbox> todo</li></ul>'
      )
    ).toEqual([
      {
        type: 'list',
        ordered: false,
        spread: false,
        children: [item([p(t('done'))], true), item([p(t('todo'))], false)],
      },
    ]);
  });

  it('reads code blocks with their language, keeping text exactly', () => {
    expect(blocks('<pre><code class="lang-js">\n  a &lt; b\n\n</code></pre>')).toEqual([
      { type: 'code', lang: 'js', value: '  a < b\n', fenced: true },
    ]);
    expect(blocks('<pre>x<br>y</pre>')).toEqual([{ type: 'code', value: 'x\ny', fenced: true }]);
  });

  it('reads tables: the first row is the header, align from align or text-align', () => {
    const table = blocks(
      '<table><caption>Cap</caption><tr><th style="text-align: right">a<td>b' +
        '<tr><td>1<td><p>2</p></table>'
    );
    expect(table).toEqual([
      p(t('Cap')),
      {
        type: 'table',
        align: ['right', null],
        children: [
          {
            type: 'tableRow',
            children: [
              { type: 'tableCell', children: [t('a')] },
              { type: 'tableCell', children: [t('b')] },
            ],
          },
          {
            type: 'tableRow',
            children: [
              { type: 'tableCell', children: [t('1')] },
              { type: 'tableCell', children: [t('2')] },
            ],
          },
        ],
      },
    ]);
  });

  it('flattens blocks inside a heading onto their own line', () => {
    expect(blocks('<h2>a<div>b</div>c</h2>')).toEqual([
      { type: 'heading', depth: 2, children: [t('a\nb\nc')] },
    ]);
  });

  it('closes a link at a block, as browsers do, and drops the empty link', () => {
    expect(blocks('<p><a href="https://example.com"><div>x</div></a></p>')).toEqual([p(t('x'))]);
  });

  it('reads mentions', () => {
    expect(
      blocks(
        '<p><span data-mention="user" data-mention-id="U1">@Ada</span>' +
          '<span data-mention="channel" data-mention-id="C1">#C1</span>' +
          '<span data-mention="here">@here</span><span data-mention="bogus">@x</span></p>'
      )
    ).toEqual([
      p(
        { type: 'mention', kind: 'user', id: 'U1', label: 'Ada' },
        { type: 'mention', kind: 'channel', id: 'C1' },
        { type: 'mention', kind: 'here' },
        { type: 'mention', kind: 'user', label: 'x' }
      ),
    ]);
  });
});

describe('htmlToMarkdownTree: tolerance', () => {
  it('closes unclosed elements at the end of input', () => {
    expect(blocks('<p><b>bold <i>both')).toEqual([
      p({ type: 'strong', children: [t('bold '), { type: 'emphasis', children: [t('both')] }] }),
    ]);
  });

  it('closes a p when a block starts, and ignores stray end tags', () => {
    expect(blocks('<p>a<div>b</div></span></p>c</li>')).toEqual([p(t('a')), p(t('b')), p(t('c'))]);
  });

  it('reads </br> as a break and a stray li as a one-item list', () => {
    expect(blocks('a</br>b')).toEqual([p(t('a'), { type: 'break' }, t('b'))]);
    expect(blocks('<li>x</li>')).toEqual([
      { type: 'list', ordered: false, spread: false, children: [item([p(t('x'))])] },
    ]);
  });

  it('never lets an end tag escape a table cell', () => {
    expect(blocks('<table><tr><td><b>x</td><td>y</b></td></tr></table>')[0]).toMatchObject({
      type: 'table',
      children: [
        {
          children: [
            { children: [{ type: 'strong', children: [t('x')] }] },
            { children: [t('y')] },
          ],
        },
      ],
    });
  });

  it('cuts input past maxSource', () => {
    const result = read('<p>abcdef</p>', { maxSource: 6 });
    // The first six characters are `<p>abc`.
    expect(result.tree).toEqual(root(p(t('abc'))));
    expect(result.diagnostics.map((d) => d.code)).toEqual(['source-truncated']);
  });

  it('cannot raise maxSource past the global limit, and never throws on non-strings', () => {
    expect(() => read('x', { maxSource: Number.POSITIVE_INFINITY })).not.toThrow();
    const result = htmlToMarkdownTree(null as unknown as string);
    expect(result.tree.children).toEqual([]);
    expect(result.diagnostics[0]?.code).toBe('unsupported-construct');
  });

  it('reports dropped elements', () => {
    const result = read('<p>a</p><script>x</script><iframe src="https://example.com"></iframe>');
    expect(result.tree.children).toEqual([p(t('a'))] as MdBlock[]);
    expect(result.diagnostics.map((d) => d.code)).toEqual(['html-dropped', 'html-dropped']);
  });
});
