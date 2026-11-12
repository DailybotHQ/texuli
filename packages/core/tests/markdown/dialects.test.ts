import { describe, expect, it } from 'vitest';
import { MARKDOWN_AST_VERSION, type MdRoot } from '../../src/markdown/ast.ts';
import {
  convertMarkdownDialect,
  MARKDOWN_DIALECTS,
  readMarkdownDialect,
  writeMarkdownDialect,
} from '../../src/markdown-dialects/index.ts';

const tree: MdRoot = {
  type: 'root',
  version: MARKDOWN_AST_VERSION,
  children: [
    { type: 'heading', depth: 2, children: [{ type: 'text', value: 'Title' }] },
    {
      type: 'paragraph',
      children: [
        { type: 'strong', children: [{ type: 'text', value: 'bold' }] },
        { type: 'text', value: ' and ' },
        {
          type: 'link',
          url: 'https://example.com/a_(b)',
          children: [{ type: 'text', value: 'link' }],
        },
        { type: 'text', value: ' ' },
        { type: 'mention', kind: 'user', id: 'U123', label: 'Ari' },
      ],
    },
    {
      type: 'list',
      ordered: false,
      spread: false,
      children: [
        {
          type: 'listItem',
          spread: false,
          children: [{ type: 'paragraph', children: [{ type: 'text', value: 'one' }] }],
        },
      ],
    },
  ],
};

describe('chat Markdown dialects', () => {
  it('reads dialect mentions into MdMention and platform emphasis', () => {
    const slack = readMarkdownDialect('*bold* <@U123> <#C9|general>', 'slack').tree;
    const inlines = slack.children[0]?.type === 'paragraph' ? slack.children[0].children : [];
    expect(inlines[0]).toMatchObject({ type: 'strong' });
    expect(inlines[1]).toMatchObject({ type: 'text', value: ' ' });
    expect(inlines[2]).toMatchObject({ type: 'mention', kind: 'user', id: 'U123' });
    expect(inlines[4]).toMatchObject({
      type: 'mention',
      kind: 'channel',
      id: 'C9',
      label: 'general',
    });
    const discord = readMarkdownDialect('<@&R9>', 'discord').tree.children[0];
    expect(discord).toMatchObject({ children: [{ type: 'mention', kind: 'role', id: 'R9' }] });
    expect(readMarkdownDialect('&lt;@U123&gt;', 'slack').tree.children[0]).toMatchObject({
      type: 'paragraph',
      children: [{ type: 'text', value: '<@U123>' }],
    });
    expect(readMarkdownDialect('@ari', 'whatsapp').tree.children[0]).toMatchObject({
      children: [{ type: 'mention', kind: 'user', label: 'ari' }],
    });
    expect(readMarkdownDialect('\\*literal\\*', 'discord').tree.children[0]).toMatchObject({
      children: [{ type: 'text', value: '*literal*' }],
    });
  });

  it('applies Telegram MarkdownV2 reserved-character escaping', () => {
    const result = writeMarkdownDialect(
      {
        ...tree,
        children: [
          { type: 'paragraph', children: [{ type: 'text', value: '_*[]()~`>#+-=|{}.!\\' }] },
        ],
      },
      'telegram-markdown-v2'
    );
    expect(result.value).toBe('\\_\\*\\[\\]\\(\\)\\~\\`\\>\\#\\+\\-\\=\\|\\{\\}\\.\\!\\\\');
    expect(result.diagnostics).toEqual([]);
    expect(
      readMarkdownDialect('\\_literal\\*', 'telegram-markdown-v2').tree.children[0]
    ).toMatchObject({
      type: 'paragraph',
      children: [{ type: 'text', value: '_literal*' }],
    });
  });

  it('escapes text in Telegram HTML and never treats unknown tags as markup', () => {
    const written = writeMarkdownDialect(
      { ...tree, children: [{ type: 'paragraph', children: [{ type: 'text', value: '<b>&"' }] }] },
      'telegram-html'
    );
    expect(written.value).toBe('&lt;b&gt;&amp;"');
    const read = readMarkdownDialect('<script>x</script> <b>ok</b>', 'telegram-html').tree;
    expect(read.children[0]?.type).toBe('paragraph');
    const children = read.children[0]?.type === 'paragraph' ? read.children[0].children : [];
    expect(
      children
        .filter((node) => node.type === 'text')
        .map((node) => (node.type === 'text' ? node.value : ''))
        .join('')
    ).toBe('<script>x</script> ');
    expect(children.at(-1)?.type).toBe('strong');
    const attribute = writeMarkdownDialect(
      {
        ...tree,
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'link',
                url: 'https://example.com/?q="x"',
                children: [{ type: 'text', value: 'x' }],
              },
            ],
          },
        ],
      },
      'telegram-html'
    );
    expect(attribute.value).toContain('q=&quot;x&quot;');
  });

  it('reports losses when the destination cannot preserve source constructs', () => {
    const result = writeMarkdownDialect(tree, 'plain-text');
    expect(result.value).toContain('Title');
    expect(
      result.diagnostics.some(
        (diagnostic) => diagnostic.code === 'dialect-loss' && diagnostic.message.includes('Heading')
      )
    ).toBe(true);
  });

  it('refuses unsafe link schemes at the default untrusted tier', () => {
    const result = writeMarkdownDialect(
      {
        ...tree,
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'link',
                url: 'javascript:alert(1)',
                children: [{ type: 'text', value: 'label' }],
              },
            ],
          },
        ],
      },
      'discord'
    );
    expect(result.value).toBe('label');
    expect(result.diagnostics[0]?.code).toBe('url-refused');
  });

  it('converts every dialect pair through the AST', () => {
    for (const from of MARKDOWN_DIALECTS) {
      for (const to of MARKDOWN_DIALECTS) {
        const result = convertMarkdownDialect('Hello *world*', from, to);
        expect(result.value).toContain('Hello');
        expect(Array.isArray(result.diagnostics)).toBe(true);
      }
    }
    expect(MARKDOWN_DIALECTS).toHaveLength(9);
  });

  it('reads and writes a native fixture for each dialect', () => {
    const fixtures = [
      ['slack', '*bold* <@U1>'],
      ['discord', '## heading\n||hidden||\n<@123>'],
      ['whatsapp', '*bold* _italic_'],
      ['telegram-markdown-v2', '*bold* [link](https://example.com)'],
      ['telegram-html', '<b>bold</b>\n<pre>code</pre>'],
      ['teams', '**bold** <at>Ari</at>'],
      ['google-chat', '**bold** <users/123>'],
      ['mattermost', '### heading\n~~deleted~~'],
      ['plain-text', 'literal *markers*'],
    ] as const;
    for (const [dialect, fixture] of fixtures) {
      const read = readMarkdownDialect(fixture, dialect);
      expect(read.tree.children.length, dialect).toBeGreaterThan(0);
      const write = writeMarkdownDialect(read.tree, dialect);
      expect(write.value, dialect).not.toBe('');
    }
  });

  it('bounds oversized source and reports truncation without throwing', () => {
    const result = readMarkdownDialect('a'.repeat(1_000_001), 'plain-text');
    expect(result.diagnostics[0]?.code).toBe('source-truncated');
    expect(result.tree.children).toHaveLength(1);
  });
});
