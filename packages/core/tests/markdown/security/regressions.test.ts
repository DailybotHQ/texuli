/**
 * Regressions for the findings T-md-security fixed: F1–F4 and F6 in `core/markdown-dialects`
 * (L6's module), F5 and the round-trip fixes in `core/markdown-html` and `core/html`, F7 in
 * `core/markup`. Each test fails on the code before its fix.
 */
import { describe, expect, it } from 'vitest';
import { htmlToMarkdownTree } from '../../../src/html/index.ts';
import type { MdInline, MdRoot } from '../../../src/markdown/ast.ts';
import { parseMarkdown } from '../../../src/markdown/index.ts';
import { MARKDOWN_DIALECTS, writeMarkdownDialect } from '../../../src/markdown-dialects/index.ts';
import { markdownTreeToHtml } from '../../../src/markdown-html/index.ts';
import { imageUrl, linkUrl } from '../../../src/markup/index.ts';
import { dialectProblems } from './check.ts';

const doc = (...children: MdInline[]): MdRoot => ({
  type: 'root',
  version: 'texuli-md/v1',
  children: [{ type: 'paragraph', children }],
});
const text = (value: string): MdInline => ({ type: 'text', value });

describe('F1: a refused link writes its label escaped, never raw', () => {
  const hostile = doc({
    type: 'link',
    url: 'javascript:alert(1)',
    children: [
      text(
        '[bank](https://evil.example) <!channel> @everyone <@&1> <a href="https://evil.example">b</a> '
      ),
      { type: 'link', url: 'javascript:inner()', children: [text('inner')] },
    ],
  });

  it.each(MARKDOWN_DIALECTS.map((d) => [d]))('%s', (dialect) => {
    const { value, diagnostics } = writeMarkdownDialect(hostile, dialect);
    expect(diagnostics.some((d) => d.code === 'url-refused')).toBe(true);
    // Before the fix the label came out raw: live masked links, pings and Telegram tags, and the
    // inner refused URL as text.
    expect(value).not.toContain('javascript:inner()');
    // `@everyone` pings in Discord, and in Slack with `link_names`.
    if (dialect === 'discord' || dialect === 'slack')
      expect(value).not.toMatch(/(?<![\\\u200b])@everyone/);
    expect(dialectProblems(value, dialect, 'untrusted')).toEqual([]);
    if (dialect === 'telegram-html') expect(value).not.toContain('<a ');
    if (dialect === 'slack') expect(value).not.toContain('<!channel>');
    if (dialect === 'discord') expect(value).not.toContain('<@&1>');
    if (['discord', 'teams', 'mattermost', 'telegram-markdown-v2'].includes(dialect))
      expect(value).not.toContain('[bank](');
  });
});

describe('F2: Slack text never carries a broadcast word Slack would link', () => {
  it('escapes @channel, @here and @everyone in text', () => {
    const { value } = writeMarkdownDialect(
      doc(text('hi @channel @here @Everyone @channels')),
      'slack'
    );
    expect(value).toBe('hi @\u200bchannel @\u200bhere @\u200bEveryone @channels');
  });

  it('still writes an opted-in broadcast mention', () => {
    const { value } = writeMarkdownDialect(doc({ type: 'mention', kind: 'here' }), 'slack', {
      allowBroadcastMentions: true,
    });
    expect(value).toBe('<!here>');
  });
});

describe('F3: a policy-checked URL cannot close its link and open another', () => {
  const tricky = doc({
    type: 'link',
    url: 'https://example.com/a)[x](javascript:alert(1)',
    children: [text('ok')],
  });

  it.each(['teams', 'discord', 'mattermost'] as const)(
    '%s percent-encodes the destination',
    (dialect) => {
      const { value } = writeMarkdownDialect(tricky, dialect);
      expect(value).toBe('[ok](https://example.com/a%29%5Bx%5D%28javascript:alert%281%29)');
      expect(dialectProblems(value, dialect, 'untrusted')).toEqual([]);
    }
  );

  it('keeps ordinary URLs readable', () => {
    const plainUrl = doc({
      type: 'link',
      url: 'https://example.com/a-b/c?d=1&e=2#f',
      children: [text('x')],
    });
    expect(writeMarkdownDialect(plainUrl, 'discord').value).toBe(
      '[x](https://example.com/a-b/c?d=1&e=2#f)'
    );
  });
});

describe('F4: Slack and Google Chat escape control characters inside code', () => {
  const code: MdRoot = {
    type: 'root',
    version: 'texuli-md/v1',
    children: [
      {
        type: 'paragraph',
        children: [{ type: 'inlineCode', value: '<!everyone> <https://evil.example|bank> &amp;' }],
      },
      { type: 'code', value: '<@U1> <!here>', fenced: true },
    ],
  };

  it.each(['slack', 'google-chat'] as const)('%s', (dialect) => {
    const { value } = writeMarkdownDialect(code, dialect);
    expect(value).not.toMatch(/<[!@#h]/);
    expect(value).toContain('&lt;!everyone&gt;');
    expect(value).toContain('&amp;amp;');
    expect(dialectProblems(value, dialect, 'untrusted')).toEqual([]);
  });
});

describe('F5: a footnote label with a lone surrogate never throws', () => {
  it('writes U+FFFD in its ids', () => {
    const tree: MdRoot = {
      type: 'root',
      version: 'texuli-md/v1',
      children: [
        { type: 'paragraph', children: [{ type: 'footnoteReference', label: 'a\ud83d' }] },
        { type: 'footnoteDefinition', label: 'a\ud83d', children: [] },
      ],
    };
    expect(() => markdownTreeToHtml(tree)).not.toThrow();
    expect(markdownTreeToHtml(tree).html).toContain('id="user-content-fnref-a%EF%BF%BD"');
  });
});

describe('F6: inline code content never escapes its code span', () => {
  const code = (...values: string[]): MdRoot =>
    doc(...values.map((value): MdInline => ({ type: 'inlineCode', value })));
  const leaks = (value: string) =>
    JSON.stringify(parseMarkdown(value).tree).includes('"url":"javascript:alert(1)"');

  it.each(['discord', 'teams', 'mattermost', 'google-chat'] as const)('%s', (dialect) => {
    for (const tree of [
      code('', '[x](javascript:alert(1))'),
      code('`[x](javascript:alert(1))'),
      code('[x](javascript:alert(1))`'),
      code('a', '[x](javascript:alert(1))'),
    ]) {
      const { value } = writeMarkdownDialect(tree, dialect);
      expect(leaks(value), value).toBe(false);
    }
  });

  it('pads content that starts or ends with a backtick, so readers get it back', () => {
    const { value } = writeMarkdownDialect(code('`x`'), 'discord');
    expect(value).toBe('`` `x` ``');
    expect(parseMarkdown(value).tree.children[0]).toEqual({
      type: 'paragraph',
      children: [{ type: 'inlineCode', value: '`x`' }],
    });
  });

  it('drops an empty code span with a loss', () => {
    const { value, diagnostics } = writeMarkdownDialect(code(''), 'discord');
    expect(value).toBe('');
    expect(diagnostics.map((d) => d.code)).toContain('dialect-loss');
  });
});

describe('F7: the URL the policy checks is the URL the writers emit', () => {
  const sneaky = '\ud83djavascript:alert(1)';

  it('core/markup refuses a URL that becomes javascript: once unpaired surrogates are dropped', () => {
    expect(linkUrl(sneaky, 'developer')).toBeNull();
    expect(imageUrl(sneaky, 'developer')).toBeNull();
    expect(linkUrl('java\ud800script:alert(1)', 'developer')).toBeNull();
  });

  it('markdownTreeToHtml writes no href for it at any tier', () => {
    for (const trust of ['developer', 'untrusted'] as const) {
      const { html } = markdownTreeToHtml(
        doc({ type: 'link', url: sneaky, children: [text('x')] }),
        {
          trust,
        }
      );
      expect(html).toBe('<p>x</p>\n');
    }
  });

  it('dialect writers refuse it too', () => {
    for (const dialect of MARKDOWN_DIALECTS) {
      const { value } = writeMarkdownDialect(
        doc({ type: 'link', url: sneaky, children: [text('x')] }),
        dialect,
        { trust: 'developer' }
      );
      expect(value).not.toMatch(/javascript:/);
    }
  });
});

describe('HTML round trips settle after one pass (found by the fuzz test)', () => {
  const stable = (tree: MdRoot) => {
    const once = markdownTreeToHtml(tree).html;
    const twice = markdownTreeToHtml(htmlToMarkdownTree(once).tree).html;
    expect(markdownTreeToHtml(htmlToMarkdownTree(twice).tree).html).toBe(twice);
    return once;
  };

  it('writes no empty paragraph, so a list does not turn loose on read', () => {
    const once = stable({
      type: 'root',
      version: 'texuli-md/v1',
      children: [
        {
          type: 'list',
          ordered: false,
          spread: true,
          children: [
            {
              type: 'listItem',
              spread: false,
              checked: true,
              children: [{ type: 'paragraph', children: [{ type: 'html', value: '<b>' }] }],
            },
          ],
        },
      ],
    });
    expect(once).not.toContain('<p></p>');
  });

  it('keeps a code block that starts with a newline', () => {
    const tree: MdRoot = {
      type: 'root',
      version: 'texuli-md/v1',
      children: [{ type: 'code', value: '\nfirst line blank', fenced: true }],
    };
    expect(htmlToMarkdownTree(markdownTreeToHtml(tree).html).tree).toEqual(tree);
  });

  it('trims a cell edge behind an empty formatting element', () => {
    expect(htmlToMarkdownTree('<p><del>a </del><del></del></p>').tree.children).toEqual([
      { type: 'paragraph', children: [{ type: 'delete', children: [text('a')] }] },
    ]);
  });

  it('reads a mention whose id holds whitespace without inventing a label', () => {
    const read = (html: string) => htmlToMarkdownTree(html).tree.children[0];
    // The shown text is whitespace-collapsed; the id is compared the same way.
    expect(read('<p><span data-mention="user" data-mention-id="a  b">@a b</span></p>')).toEqual({
      type: 'paragraph',
      children: [{ type: 'mention', kind: 'user', id: 'a  b' }],
    });
    expect(read('<p><span data-mention="user" data-mention-id="x">@ x</span></p>')).toEqual({
      type: 'paragraph',
      children: [{ type: 'mention', kind: 'user', id: 'x' }],
    });
  });
});
