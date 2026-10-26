// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { absolutizeMarkdownLinks, htmlToMarkdown } from '../src/components/docs/markdown.ts';
import { markdownTwinFor, prefersMarkdown } from '../src/components/docs/markdown-negotiation.ts';

describe('markdownTwinFor', () => {
  it('maps directory docs paths to a .md twin beside the HTML', () => {
    expect(markdownTwinFor('/guides/theming/')).toBe('/guides/theming.md');
    expect(markdownTwinFor('/skill/')).toBe('/skill.md');
    expect(markdownTwinFor('/component-pages/button/')).toBe('/component-pages/button.md');
  });

  it('gives nothing to the root and non-directory paths', () => {
    expect(markdownTwinFor('/')).toBeUndefined();
    expect(markdownTwinFor('/guides/theming.md')).toBeUndefined();
    expect(markdownTwinFor('guides/theming/')).toBeUndefined();
    expect(markdownTwinFor('')).toBeUndefined();
  });
});

describe('prefersMarkdown', () => {
  it('negotiates only on an explicit text/markdown entry', () => {
    expect(prefersMarkdown('text/markdown')).toBe(true);
    expect(prefersMarkdown('text/html, text/markdown;q=0.9')).toBe(true);
    expect(prefersMarkdown(' text/markdown ;q=0.8')).toBe(true);
    expect(prefersMarkdown('*/*')).toBe(false);
    expect(prefersMarkdown('text/html')).toBe(false);
    expect(prefersMarkdown('')).toBe(false);
    expect(prefersMarkdown(null)).toBe(false);
    expect(prefersMarkdown(undefined)).toBe(false);
  });
});

describe('absolutizeMarkdownLinks', () => {
  it('makes root-relative links absolute and leaves the rest alone', () => {
    expect(
      absolutizeMarkdownLinks(
        'See [Theming](/guides/theming/) and [the API](/skill/#api "The skill").\n[anchor](#x) stays.',
        'https://texuli.com'
      )
    ).toBe(
      'See [Theming](https://texuli.com/guides/theming/) and [the API](https://texuli.com/skill/#api "The skill").\n[anchor](#x) stays.'
    );
  });

  it('never touches fenced code', () => {
    const markdown = 'text\n\n```\n[link](/not/rewritten/)\n```\n\n[real](/guides/)\n';
    expect(absolutizeMarkdownLinks(markdown, 'https://texuli.com')).toBe(
      'text\n\n```\n[link](/not/rewritten/)\n```\n\n[real](https://texuli.com/guides/)\n'
    );
  });
});

describe('htmlToMarkdown tables', () => {
  it('renders a props table with exactly one separator row', () => {
    // Component pages mark every body row up with `th scope="row"`; the
    // converter must emit the separator once, after the header row only.
    const html =
      '<table><thead><tr><th>Name</th><th>Kind</th></tr></thead><tbody>' +
      '<tr><th scope="row">variant</th><td>enum</td></tr>' +
      '<tr><th scope="row">size</th><td>enum</td></tr>' +
      '</tbody></table>';
    expect(htmlToMarkdown(html)).toBe(
      '| Name | Kind |\n| --- | --- |\n| variant | enum |\n| size | enum |\n'
    );
  });
});
