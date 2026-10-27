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

  // PLAN_006 P2-5: RFC 9110 §12.4.2 — a weight of 0 means "not acceptable".
  it('ignores an explicit text/markdown entry whose weight is zero', () => {
    expect(prefersMarkdown('text/markdown;q=0')).toBe(false);
    expect(prefersMarkdown('text/html, text/markdown; q=0')).toBe(false);
    expect(prefersMarkdown('text/markdown;Q=0.0')).toBe(false);
    expect(prefersMarkdown('text/markdown;charset=utf-8;q=0.000')).toBe(false);
    expect(prefersMarkdown('text/markdown;q=0.001')).toBe(true);
    expect(prefersMarkdown('text/markdown;charset=utf-8')).toBe(true);
    expect(prefersMarkdown('text/markdown;q=0, text/markdown;q=1')).toBe(true);
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

/**
 * PLAN_006 W11: the copy-page hint strip matched only `<p class="copy-page__hint">`,
 * but the build emits the Astro scope attribute after the class, so the hint
 * would have leaked into the Markdown. This is the real built markup
 * (from dist/guides/dark-mode/index.html, template body shortened).
 */
const BUILT_COPY_PAGE =
  '<div class="copy-page" data-copy-page="" data-astro-cid-xzk5d6la><p class="copy-page__hint" data-astro-cid-xzk5d6la>This page ships a Markdown twin for AI tools.</p><!--[--><!--[-1--><button class="tx-button tx-button--outline tx-button--sm" type="button" data-tx-button="true" data-variant="outline" data-size="sm" data-copy-page-button="" data-astro-cid-xzk5d6la="true"><!--[-1--><!--[-1-->Copy page<!----><!--]--><!--]--><!----></button><!--]--><!--]--><template data-page-markdown="" data-astro-cid-xzk5d6la># Dark mode</template><p class="copy-page__status" role="status" data-copy-page-status="" data-astro-cid-xzk5d6la></p></div>';

describe('htmlToMarkdown drops the copy-page hint (W11)', () => {
  it('strips the hint from the real built markup, scope attribute included', () => {
    const markdown = htmlToMarkdown(`${BUILT_COPY_PAGE}<h2>Setup</h2><p>Body text.</p>`);
    expect(markdown).not.toContain('Markdown twin');
    expect(markdown).not.toContain('Copy page');
    expect(markdown).toContain('## Setup');
    expect(markdown).toContain('Body text.');
  });

  it('strips it whatever the attribute order or extra classes', () => {
    const variants = [
      '<p data-astro-cid-abc class="copy-page__hint">Hint.</p>',
      '<p class="lead copy-page__hint" data-x="1">Hint.</p>',
      '<P CLASS="copy-page__hint">Hint.</P>',
    ];
    for (const html of variants) {
      expect(htmlToMarkdown(`${html}<p>Kept.</p>`).trim(), html).toBe('Kept.');
    }
  });

  it('keeps paragraphs whose class only resembles the hint', () => {
    expect(htmlToMarkdown('<p class="copy-page__hint-free">Kept.</p>').trim()).toBe('Kept.');
  });
});
