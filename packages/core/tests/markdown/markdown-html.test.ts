import { describe, expect, it } from 'vitest';
import type { MdBlock, MdInline, MdRoot } from '../../src/markdown/ast.ts';
import {
  MARKDOWN_HTML_MAX_DEPTH,
  markdownTreeToHtml,
  markdownTreeToMarkup,
} from '../../src/markdown-html/index.ts';
import { item, p, root, t, unsafeParts } from './helpers.ts';

const html = (tree: MdRoot, options = {}) => markdownTreeToHtml(tree, options).html;

describe('markdownTreeToHtml: blocks', () => {
  it('writes paragraphs, headings and breaks in the CommonMark reference layout', () => {
    expect(
      html(
        root(
          { type: 'heading', depth: 1, children: [t('Title')] },
          p(t('one\ntwo')),
          { type: 'thematicBreak' },
          { type: 'heading', depth: 6, children: [t('six')] }
        )
      )
    ).toBe('<h1>Title</h1>\n<p>one\ntwo</p>\n<hr>\n<h6>six</h6>\n');
  });

  it('clamps a heading depth outside 1–6', () => {
    const odd = { type: 'heading', depth: 9, children: [t('x')] } as unknown as MdBlock;
    expect(html(root(odd))).toBe('<h6>x</h6>\n');
  });

  it('writes blockquotes and nested blocks', () => {
    expect(html(root({ type: 'blockquote', children: [p(t('q'))] }))).toBe(
      '<blockquote>\n<p>q</p>\n</blockquote>\n'
    );
  });

  it('writes tight lists without paragraphs and loose lists with them', () => {
    const tight: MdBlock = {
      type: 'list',
      ordered: false,
      spread: false,
      children: [item([p(t('a'))]), item([p(t('b'))])],
    };
    expect(html(root(tight))).toBe('<ul>\n<li>a</li>\n<li>b</li>\n</ul>\n');
    const loose: MdBlock = { ...tight, spread: true } as MdBlock;
    expect(html(root(loose))).toBe('<ul>\n<li>\n<p>a</p>\n</li>\n<li>\n<p>b</p>\n</li>\n</ul>\n');
  });

  it('writes the start of an ordered list only when it is not 1', () => {
    const list = (start: number): MdBlock => ({
      type: 'list',
      ordered: true,
      start,
      spread: false,
      children: [item([p(t('x'))])],
    });
    expect(html(root(list(1)))).toBe('<ol>\n<li>x</li>\n</ol>\n');
    expect(html(root(list(7)))).toBe('<ol start="7">\n<li>x</li>\n</ol>\n');
  });

  it('writes a nested list in a tight item on its own line', () => {
    const nested: MdBlock = {
      type: 'list',
      ordered: false,
      spread: false,
      children: [
        item([
          p(t('a')),
          { type: 'list', ordered: false, spread: false, children: [item([p(t('b'))])] },
        ]),
      ],
    };
    expect(html(root(nested))).toBe('<ul>\n<li>a\n<ul>\n<li>b</li>\n</ul>\n</li>\n</ul>\n');
  });

  it('marks task items with data-task and a visible marker', () => {
    const tasks: MdBlock = {
      type: 'list',
      ordered: false,
      spread: false,
      children: [item([p(t('done'))], true), item([p(t('todo'))], false)],
    };
    expect(html(root(tasks))).toBe(
      '<ul>\n<li class="task-list-item" data-task="checked"><span class="task-list-marker">☑</span> done</li>\n' +
        '<li class="task-list-item" data-task="unchecked"><span class="task-list-marker">☐</span> todo</li>\n</ul>\n'
    );
  });

  it('writes code blocks with an escaped body and a checked language class', () => {
    expect(html(root({ type: 'code', lang: 'ts', value: 'a < b && c', fenced: true }))).toBe(
      '<pre><code class="language-ts">a &lt; b &amp;&amp; c\n</code></pre>\n'
    );
    expect(html(root({ type: 'code', lang: 'x" onclick="y', value: 'z', fenced: true }))).toBe(
      '<pre><code>z\n</code></pre>\n'
    );
    expect(html(root({ type: 'code', value: '', fenced: false }))).toBe(
      '<pre><code></code></pre>\n'
    );
  });

  it('writes tables with a header row and column alignment', () => {
    const table: MdBlock = {
      type: 'table',
      align: ['left', 'center', null],
      children: [
        {
          type: 'tableRow',
          children: [
            { type: 'tableCell', children: [t('a')] },
            { type: 'tableCell', children: [t('b')] },
            { type: 'tableCell', children: [t('c')] },
          ],
        },
        {
          type: 'tableRow',
          children: [
            { type: 'tableCell', children: [t('1')] },
            { type: 'tableCell', children: [t('2')] },
            { type: 'tableCell', children: [t('3')] },
          ],
        },
      ],
    };
    expect(html(root(table))).toBe(
      '<table>\n<thead>\n<tr>\n<th align="left">a</th>\n<th align="center">b</th>\n<th>c</th>\n</tr>\n</thead>\n' +
        '<tbody>\n<tr>\n<td align="left">1</td>\n<td align="center">2</td>\n<td>3</td>\n</tr>\n</tbody>\n</table>\n'
    );
  });

  it('does not render link reference definitions', () => {
    expect(html(root({ type: 'definition', label: 'a', url: 'https://example.com' }))).toBe('');
  });
});

describe('markdownTreeToHtml: inlines', () => {
  it('writes every inline mark', () => {
    const inline: MdInline[] = [
      { type: 'emphasis', children: [t('em')] },
      { type: 'strong', children: [t('st')] },
      { type: 'delete', children: [t('del')] },
      { type: 'underline', children: [t('u')] },
      { type: 'spoiler', children: [t('sp')] },
      { type: 'inlineCode', value: '<x>' },
      { type: 'break' },
    ];
    expect(html(root(p(...inline)))).toBe(
      '<p><em>em</em><strong>st</strong><del>del</del><u>u</u>' +
        '<span class="spoiler" data-spoiler>sp</span><code>&lt;x&gt;</code><br>\n</p>\n'
    );
  });

  it('escapes text, so text never becomes markup', () => {
    expect(html(root(p(t('<img src=x onerror=alert(1)> & "q"'))))).toBe(
      '<p>&lt;img src=x onerror=alert(1)&gt; &amp; "q"</p>\n'
    );
  });

  it('writes links with title and the untrusted rel, and drops refused ones to their label', () => {
    const result = markdownTreeToHtml(
      root(
        p(
          { type: 'link', url: 'https://example.com/a', title: 'T', children: [t('ok')] },
          { type: 'link', url: 'javascript:alert(1)', children: [t('bad')] }
        )
      )
    );
    expect(result.html).toBe(
      '<p><a href="https://example.com/a" title="T" rel="nofollow noopener noreferrer">ok</a>bad</p>\n'
    );
    expect(result.diagnostics.map((d) => d.code)).toEqual(['url-refused']);
  });

  it('follows the trust tier: relative and http links pass only at the developer tier', () => {
    const tree = root(p({ type: 'link', url: '/docs/', children: [t('docs')] }));
    expect(html(tree)).toBe('<p>docs</p>\n');
    expect(html(tree, { trust: 'developer' })).toBe('<p><a href="/docs/">docs</a></p>\n');
    // Any value other than 'developer' is untrusted.
    expect(html(tree, { trust: 'admin' as never })).toBe('<p>docs</p>\n');
  });

  it('honors linkRel', () => {
    const tree = root(p({ type: 'link', url: 'https://example.com', children: [t('x')] }));
    expect(html(tree, { linkRel: false })).toBe('<p><a href="https://example.com">x</a></p>\n');
    expect(html(tree, { linkRel: 'ugc' })).toBe(
      '<p><a href="https://example.com" rel="ugc">x</a></p>\n'
    );
  });

  it('writes images through the image policy, and refused images as their alt text', () => {
    const tree = root(
      p(
        { type: 'image', url: 'https://example.com/a.png', alt: 'A', title: 'T' },
        { type: 'image', url: 'data:image/png;base64,AAAA', alt: 'inline' }
      )
    );
    const untrusted = markdownTreeToHtml(tree);
    expect(untrusted.html).toBe(
      '<p><img src="https://example.com/a.png" alt="A" title="T">inline</p>\n'
    );
    expect(untrusted.diagnostics.map((d) => d.code)).toEqual(['url-refused']);
    expect(html(tree, { trust: 'developer' })).toContain('src="data:image/png;base64,AAAA"');
  });

  it('writes mentions as labelled spans', () => {
    const tree = root(
      p(
        { type: 'mention', kind: 'user', id: 'U1', label: 'Ada' },
        t(' '),
        { type: 'mention', kind: 'channel', id: 'C1' },
        t(' '),
        { type: 'mention', kind: 'everyone' }
      )
    );
    expect(html(tree)).toBe(
      '<p><span data-mention="user" data-mention-id="U1">@Ada</span> ' +
        '<span data-mention="channel" data-mention-id="C1">#C1</span> ' +
        '<span data-mention="everyone">@everyone</span></p>\n'
    );
  });
});

describe('markdownTreeToHtml: raw HTML, footnotes and ids', () => {
  const raw = root(
    { type: 'html', value: '<div onclick="x()">block</div>\n' },
    p(t('a '), { type: 'html', value: '<b>' }, t('b'))
  );

  it('drops raw HTML by default and reports it', () => {
    const result = markdownTreeToHtml(raw);
    expect(result.html).toBe('<p>a b</p>\n');
    expect(result.diagnostics.map((d) => d.code)).toEqual(['html-dropped', 'html-dropped']);
  });

  it('escapes raw HTML as text when asked, never as markup', () => {
    expect(html(raw, { rawHtml: 'escape' })).toBe(
      '<p>&lt;div onclick="x()"&gt;block&lt;/div&gt;</p>\n<p>a &lt;b&gt;b</p>\n'
    );
  });

  const notes = root(
    p(
      t('x'),
      { type: 'footnoteReference', label: 'a b' },
      { type: 'footnoteReference', label: 'missing' }
    ),
    { type: 'footnoteDefinition', label: 'a b', children: [p(t('note'))] }
  );

  it('numbers footnotes, moves definitions to one section and prefixes every id', () => {
    expect(html(notes)).toBe(
      '<p>x<sup><a href="#user-content-fn-a%20b" id="user-content-fnref-a%20b" data-footnote-ref>1</a></sup>[^missing]</p>\n' +
        '<section data-footnotes class="footnotes">\n<ol>\n<li id="user-content-fn-a%20b">\n<p>note</p>\n' +
        '<a href="#user-content-fnref-a%20b" data-footnote-backref aria-label="Back to reference">↩</a></li>\n</ol>\n</section>\n'
    );
  });

  it('reduces idPrefix to safe characters', () => {
    const out = html(notes, { idPrefix: 'My "Prefix"<-' });
    expect(out).toContain('id="myprefix-fnref-a%20b"');
    expect(out).not.toContain('"Prefix"');
  });
});

describe('markdownTreeToHtml: hostile trees', () => {
  it('never throws on malformed trees', () => {
    const bad = [
      null,
      42,
      'root',
      {},
      { type: 'root' },
      { type: 'root', children: 'x' },
      { type: 'root', children: [null, 1, { type: 'paragraph', children: [{ type: 'text' }] }] },
      { type: 'root', children: [{ type: 'mystery', children: [] }] },
      {
        type: 'root',
        children: [{ type: 'list', ordered: true, start: Number.NaN, children: [{}] }],
      },
      { type: 'root', children: [{ type: 'table', align: 'x', children: [{ type: 'tableRow' }] }] },
      {
        type: 'root',
        children: [{ type: 'paragraph', children: [{ type: 'link', url: {}, children: [] }] }],
      },
    ];
    for (const tree of bad) {
      expect(() => markdownTreeToHtml(tree as unknown as MdRoot)).not.toThrow();
    }
    expect(
      markdownTreeToHtml({ type: 'root', children: [{ type: 'mystery' }] } as unknown as MdRoot)
        .diagnostics[0]?.code
    ).toBe('unsupported-construct');
  });

  it('writes content past the depth cut as plain text without overflowing the stack', () => {
    let inline: MdInline = t('deep <b>');
    for (let i = 0; i < 20_000; i += 1) inline = { type: 'emphasis', children: [inline] };
    let block: MdBlock = p(inline);
    for (let i = 0; i < 20_000; i += 1) block = { type: 'blockquote', children: [block] };
    const result = markdownTreeToHtml(root(block));
    expect(result.diagnostics.some((d) => d.code === 'depth-limit')).toBe(true);
    expect(result.html).toContain('deep &lt;b&gt;');
    expect(result.html.split('<blockquote>').length - 1).toBeLessThanOrEqual(
      MARKDOWN_HTML_MAX_DEPTH
    );
    expect(unsafeParts(result.html)).toEqual([]);
  });

  it('stops at the node limit', () => {
    const many = Array.from({ length: 200_005 }, () => t('x'));
    const result = markdownTreeToHtml(root({ type: 'paragraph', children: many }));
    expect(result.diagnostics.map((d) => d.code)).toContain('node-limit');
  });

  it('refuses a hand-built URL object: only the policy makes URLs', () => {
    const forged = root(
      p({
        type: 'link',
        url: { kind: 'url', value: 'javascript:x' } as unknown as string,
        children: [t('f')],
      })
    );
    expect(html(forged)).toBe('<p>f</p>\n');
  });

  it('returns markup nodes for embedding', () => {
    const { nodes } = markdownTreeToMarkup(root(p(t('a'))));
    expect(nodes.map((n) => n.kind)).toEqual(['element', 'text']);
  });
});
