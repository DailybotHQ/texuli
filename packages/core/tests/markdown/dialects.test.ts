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

  it('round-trips the supported inline subset for every dialect', () => {
    for (const dialect of MARKDOWN_DIALECTS) {
      const source =
        dialect === 'telegram-html'
          ? '<b>bold</b> plain'
          : dialect === 'slack' || dialect === 'whatsapp'
            ? '*bold* plain'
            : dialect === 'plain-text'
              ? 'plain text'
              : '**bold** plain';
      const read = readMarkdownDialect(source, dialect).tree;
      const written = writeMarkdownDialect(read, dialect).value;
      const reread = readMarkdownDialect(written, dialect).tree;
      expect(reread.children).toEqual(read.children);
    }
  });

  it('prevents text-node mention and line-start injection in output', () => {
    const content = [
      '@everyone look',
      '<@&123>',
      '# heading',
      '> quote',
      '- list',
      '1. ordered',
    ].join('\n');
    const result = writeMarkdownDialect(
      {
        ...tree,
        children: [{ type: 'paragraph', children: [{ type: 'text', value: content }] }],
      },
      'discord'
    );
    expect(result.value).toContain('@\u200beveryone');
    expect(result.value).toContain('<\u200b@&123>');
    expect(result.value).toContain('\u200b# heading');
    expect(result.value).toContain('\u200b> quote');
    expect(result.value).toContain('\u200b- list');
    expect(result.value).toContain('\u200b1. ordered');

    const mattermost = writeMarkdownDialect(
      {
        ...tree,
        children: [
          { type: 'paragraph', children: [{ type: 'text', value: '@channel @all @here' }] },
        ],
      },
      'mattermost'
    );
    expect(mattermost.value).toBe('@\u200bchannel @\u200ball @\u200bhere');
    const plain = writeMarkdownDialect(
      {
        ...tree,
        children: [{ type: 'paragraph', children: [{ type: 'text', value: '@everyone <@&123>' }] }],
      },
      'plain-text'
    );
    expect(plain.value).toBe('@\u200beveryone <\u200b@&123>');
    for (const dialect of ['whatsapp', 'telegram-markdown-v2', 'telegram-html'] as const) {
      const output = writeMarkdownDialect(
        { ...tree, children: [{ type: 'paragraph', children: [{ type: 'text', value: '@ari' }] }] },
        dialect
      ).value;
      expect(output).toBe('@\u200bari');
    }
  });

  it('downgrades broadcast mentions unless the writer opts in', () => {
    const broadcast: MdRoot = {
      ...tree,
      children: [{ type: 'paragraph', children: [{ type: 'mention', kind: 'everyone' }] }],
    };
    const safe = writeMarkdownDialect(broadcast, 'discord');
    expect(safe.value).toBe('@\u200beveryone');
    expect(safe.diagnostics[0]?.code).toBe('dialect-loss');
    expect(writeMarkdownDialect(broadcast, 'discord', { allowBroadcastMentions: true }).value).toBe(
      '@everyone'
    );
    expect(convertMarkdownDialect('hey <!everyone>', 'slack', 'discord').value).toContain(
      '@\u200beveryone'
    );
  });

  it('keeps text link syntax inert and applies URL policy to parsed links', () => {
    const literal: MdRoot = {
      ...tree,
      children: [
        { type: 'paragraph', children: [{ type: 'text', value: '[bank](https://evil.example)' }] },
      ],
    };
    for (const dialect of ['discord', 'teams', 'mattermost', 'telegram-markdown-v2'] as const) {
      const output = writeMarkdownDialect(literal, dialect).value;
      expect(output).toContain('\\[');
      expect(readMarkdownDialect(output, dialect).tree.children[0]).toMatchObject({
        type: 'paragraph',
        children: [{ type: 'text', value: '[bank](https://evil.example)' }],
      });
      const converted = convertMarkdownDialect('[bank](javascript:alert1)', dialect, dialect);
      expect(converted.value).not.toContain('](javascript:');
      expect(converted.diagnostics.some((diagnostic) => diagnostic.code === 'url-refused')).toBe(
        true
      );
    }
    const hostileHrefs = ['javascript:alert1', 'data:text/html,x', 'javascript&#58;alert1'];
    for (const dialect of MARKDOWN_DIALECTS) {
      for (const href of hostileHrefs) {
        const converted = writeMarkdownDialect(
          {
            ...tree,
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'link', url: href, children: [{ type: 'text', value: 'x' }] }],
              },
            ],
          },
          dialect
        );
        expect(converted.value).not.toContain(href);
        expect(converted.diagnostics.some((diagnostic) => diagnostic.code === 'url-refused')).toBe(
          true
        );
      }
    }
    const hostileSyntax = [
      ['[bank](javascript:alert1)', 'discord'],
      ['[bank](data:text/html,x)', 'teams'],
      ['[bank](javascript&#58;alert1)', 'mattermost'],
      ['[bank](javascript:alert1)', 'telegram-markdown-v2'],
      ['<a href="javascript:alert1">bank</a>', 'telegram-html'],
    ] as const;
    for (const [source, from] of hostileSyntax) {
      const converted = convertMarkdownDialect(source, from, from);
      expect(converted.diagnostics.some((diagnostic) => diagnostic.code === 'url-refused')).toBe(
        true
      );
      expect(converted.value).not.toMatch(/(?:javascript|data)(?:&#58;|:)/i);
    }
  });

  it('prevents inline and block code delimiter breakout without backslash escaping code', () => {
    const codeTree: MdRoot = {
      ...tree,
      children: [
        { type: 'paragraph', children: [{ type: 'inlineCode', value: 'a_b\\c`d' }] },
        { type: 'code', value: 'line\n```\n@everyone', fenced: true },
      ],
    };
    const discord = writeMarkdownDialect(codeTree, 'discord');
    expect(discord.value).toContain('``a_b\\c`d``');
    expect(discord.value).toContain('````\nline\n```\n@everyone\n````');
    expect(discord.value).not.toContain('a\\_b');
    const fenced = writeMarkdownDialect(codeTree, 'slack');
    expect(fenced.value).toContain('``\u200d`');
    expect(fenced.diagnostics.some((diagnostic) => diagnostic.code === 'dialect-loss')).toBe(true);
    const telegram = writeMarkdownDialect(codeTree, 'telegram-markdown-v2');
    expect(telegram.value).toContain('a_b\\\\c\\`d');
    const html = writeMarkdownDialect(codeTree, 'telegram-html');
    expect(html.value).toContain('<code>a_b\\c`d</code>');
    expect(html.value).toContain('<pre>line\n```\n@everyone</pre>');
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

  it('is an exported core subpath with a page documenting every public symbol', async () => {
    const { readFileSync } = await import('node:fs');
    const exportsMap = JSON.parse(readFileSync('packages/core/package.json', 'utf8')).exports;
    expect(exportsMap['./markdown-dialects']).toBe('./src/markdown-dialects/index.ts');
    const doc = readFileSync('packages/core/docs/core-markdown-dialects.md', 'utf8');
    for (const name of [
      'MARKDOWN_DIALECTS',
      'MarkdownDialect',
      'MarkdownDialectWriteResult',
      'MarkdownDialectWriteOptions',
      'readMarkdownDialect',
      'writeMarkdownDialect',
      'convertMarkdownDialect',
    ])
      expect(doc).toContain(name);
    expect(readFileSync('packages/core/README.md', 'utf8')).toContain('core-markdown-dialects.md');
  });

  it('bounds oversized source and reports truncation without throwing', () => {
    const result = readMarkdownDialect('a'.repeat(1_000_001), 'plain-text');
    expect(result.diagnostics[0]?.code).toBe('source-truncated');
    expect(result.tree.children).toHaveLength(1);
  });

  it('stays within the reader timing budget on hostile delimiter runs', () => {
    const cases = [
      ['[ × 300k', '['.repeat(300_000), 'discord'],
      ['<b> × 100k', '<b>'.repeat(100_000), 'telegram-html'],
      ['x** × 300k', 'x**'.repeat(300_000), 'discord'],
      ['`a × 300k', '`a'.repeat(300_000), 'discord'],
      ['<@ × 200k', '<@'.repeat(200_000), 'slack'],
      ['_ × 300k', '_'.repeat(300_000), 'mattermost'],
      ['~~ × 150k', '~~'.repeat(150_000), 'mattermost'],
      ['|| × 150k', '||'.repeat(150_000), 'discord'],
    ] as const;
    for (const [label, source, dialect] of cases) {
      const started = performance.now();
      const result = readMarkdownDialect(source, dialect);
      expect(performance.now() - started, label).toBeLessThan(500);
      if (label.startsWith('x**'))
        expect(result.diagnostics.some((diagnostic) => diagnostic.code === 'node-limit')).toBe(
          true
        );
    }
  });
});
