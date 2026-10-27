// @vitest-environment node
/// <reference types="node" />
import { expect, it } from 'vitest';
import type { SiteLlmsSection } from '../src/llms/site.ts';
import { formatSiteLlmsTxt } from '../src/llms/site.ts';

const section = (overrides: Partial<SiteLlmsSection> = {}): SiteLlmsSection => ({
  name: 'Guides',
  links: [{ title: 'Theming', href: 'https://texuli.com/guides/theming/' }],
  ...overrides,
});

it('formatSiteLlmsTxt renders the convention, descriptions, drops empty sections and keeps hrefs on one line', () => {
  // renders the convention: H1, blockquote summary, H2 sections, links
  {
    const body = formatSiteLlmsTxt({
      title: 'Texuli',
      summary: 'Small pieces. Infinite possibilities.',
      sections: [section()],
    });
    expect(body).toBe(
      `# Texuli\n\n> Small pieces. Infinite possibilities.\n\n## Guides\n\n- [Theming](https://texuli.com/guides/theming/)\n`
    );
  }
  // carries the intro paragraph, section descriptions and link descriptions
  {
    const body = formatSiteLlmsTxt({
      title: 'Texuli',
      summary: 's',
      intro: 'One paragraph of context.',
      sections: [
        section({
          description: 'Task-first guides.',
          links: [
            {
              title: 'Theming',
              href: 'https://texuli.com/guides/theming/',
              description: 'Design tokens end to end.',
            },
          ],
        }),
      ],
    });
    expect(body).toContain('\nOne paragraph of context.\n');
    expect(body).toContain('## Guides\n\nTask-first guides.\n');
    expect(body).toContain(
      '- [Theming](https://texuli.com/guides/theming/): Design tokens end to end.\n'
    );
  }
  // drops empty sections and collapses line breaks to single lines
  {
    const body = formatSiteLlmsTxt({
      title: 'Texuli',
      summary: 's',
      sections: [
        section({ name: 'Empty', links: [] }),
        section({
          name: 'Multi\nline',
          links: [
            {
              title: 'Broken\ntitle',
              href: 'https://texuli.com/a/',
              description: 'broken\ndescription',
            },
          ],
        }),
      ],
    });
    expect(body).not.toContain('Empty');
    expect(body).toContain('## Multi line');
    expect(body).toContain('- [Broken title](https://texuli.com/a/): broken description');
    expect(body.endsWith('\n')).toBe(true);
    expect(body.includes('\r')).toBe(false);
  }
  // percent-encodes whitespace, newlines and parentheses in hrefs so a list item stays one line
  {
    const body = formatSiteLlmsTxt({
      title: 'Texuli',
      summary: 's',
      sections: [
        section({
          links: [
            { title: 'Spaced', href: ' https://texuli.com/a b/ ' },
            {
              title: 'Broken',
              href: 'https://texuli.com/x\n## Injected\n- [y](https://evil.example/)',
            },
            { title: 'Paren', href: 'https://texuli.com/p)(q' },
          ],
        }),
      ],
    });
    expect(body).toContain('- [Spaced](https://texuli.com/a%20b/)\n');
    expect(body).toContain('- [Paren](https://texuli.com/p%29%28q)\n');
    expect(body).not.toMatch(/^## Injected/m);
    const lines = body.split('\n').filter((line) => line.startsWith('- '));
    expect(lines).toHaveLength(3);
    for (const line of lines) expect(line).toMatch(/^- \[[^\]]+\]\([^\s()]+\)$/);
  }
});
