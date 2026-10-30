// @vitest-environment node
/**
 * Markdown twins for every page (PLAN_011 T-ar-twins): the twin path of a
 * route and the allowlist, the header block and its parser, the page
 * rendition (content, title, links, image alt text, layout tables) and the
 * "For agents" notes of interactive pages. The built twins are checked by
 * `scripts/check-md-parity.ts --strict` and `tests/e2e/site-twins.spec.ts`.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { texuliOps } from '@texuli/tools/ops';
import { describe, expect, it } from 'vitest';
import { htmlToMarkdown } from '../src/components/docs/markdown.ts';
import { agentNoteMarkdown, TWIN_NOTES, twinNoteFor } from '../src/components/docs/twin-notes.ts';
import {
  isRedirectStub,
  markdownAccessLine,
  pageContentHtml,
  pageLanguage,
  pageTitle,
  parseTwinHeader,
  renderTwin,
  TWIN_EXEMPTIONS,
  TWIN_INDEX_MAX_HEADINGS,
  twinExemption,
  twinHeader,
  twinIndexEntry,
  twinPathFor,
} from '../src/components/docs/twins.ts';

const ORIGIN = 'https://texuli.com';
const EDGE_OPS = texuliOps.list({ runtimes: ['edge'] }).map(({ name, title }) => ({ name, title }));

describe('twin paths and the allowlist', () => {
  it('names a twin for every page route, the root included', () => {
    const table: [string, string][] = [
      ['/', '/index.md'],
      ['/guides/theming/', '/guides/theming.md'],
      ['/theme-studio/', '/theme-studio.md'],
      ['/examples/preview/blocks-code/', '/examples/preview/blocks-code.md'],
      ['/showcase/kanban/', '/showcase/kanban.md'],
      ['/guides/theming/index.html', '/guides/theming.md'],
    ];
    for (const [route, twin] of table) expect(twinPathFor(route), route).toBe(twin);
  });

  it('exempts only the error document, with a reason', () => {
    expect(TWIN_EXEMPTIONS).toHaveLength(1);
    for (const route of ['/404.html', '/404/', '/404']) {
      expect(twinExemption(route)?.reason, route).toMatch(/Markdown 404/);
      expect(twinPathFor(route), route).toBeUndefined();
    }
    for (const route of ['/', '/404-guide/', '/guides/404/', '/examples/404/'])
      expect(twinExemption(route), route).toBeUndefined();
  });

  it('detects a redirect stub, and only a small one', () => {
    expect(
      isRedirectStub(
        '<!doctype html><title>Redirecting</title><meta http-equiv="refresh" content="0;url=/guides/">'
      )
    ).toBe(true);
    expect(isRedirectStub('<!doctype html><title>Page</title><p>Body</p>')).toBe(false);
    expect(
      isRedirectStub(`<meta http-equiv="refresh" content="5">${'<p>long page</p>'.repeat(400)}`)
    ).toBe(false);
  });
});

describe('the header block', () => {
  const header = twinHeader({
    title: 'Theming',
    description: 'Pick a library\ntheme.',
    language: 'en',
    canonical: `${ORIGIN}/guides/theming/`,
    twinUrl: `${ORIGIN}/guides/theming.md`,
    origin: ORIGIN,
    lastUpdated: '2026-10-30',
  });

  it('opens with the title, the description and the four fields, then a rule', () => {
    expect(header).toBe(
      [
        '# Theming',
        '',
        '> Pick a library theme.',
        '',
        'Language: en',
        `Canonical: ${ORIGIN}/guides/theming/`,
        markdownAccessLine(`${ORIGIN}/guides/theming.md`, ORIGIN),
        'Last Updated: 2026-10-30',
        '',
        '---',
        '',
        '',
      ].join('\n')
    );
  });

  it('the access line names the twin, the .md rule, the root twin and Accept negotiation', () => {
    const line = markdownAccessLine(`${ORIGIN}/brand.md`, ORIGIN);
    expect(line).toMatch(/^Markdown: https:\/\/texuli\.com\/brand\.md \(this page\)\./);
    expect(line).toContain('`.md`');
    expect(line).toContain(`${ORIGIN}/index.md`);
    expect(line).toContain('`Accept: text/markdown`');
  });

  it('parses back, and reports every missing or malformed part', () => {
    const parsed = parseTwinHeader(`${header}Body text.\n`);
    expect(parsed).toEqual({
      ok: true,
      header: {
        title: 'Theming',
        language: 'en',
        canonical: `${ORIGIN}/guides/theming/`,
        markdown: markdownAccessLine(`${ORIGIN}/guides/theming.md`, ORIGIN).slice(
          'Markdown: '.length
        ),
        lastUpdated: '2026-10-30',
        body: 'Body text.',
      },
    });
    const broken = parseTwinHeader('Theming\n\nLanguage: en\nLast Updated: 30/10/2026\n');
    expect(broken.ok).toBe(false);
    const problems = broken.ok ? [] : broken.problems;
    expect(problems).toEqual(
      expect.arrayContaining([
        'does not open with a "# Title" line',
        'has no "---" rule after the header block',
        'has no "Canonical:" line',
        'has no "Markdown:" line',
        'has an invalid Last Updated date "30/10/2026"',
      ])
    );
    const empty = parseTwinHeader(header);
    expect(empty.ok ? [] : empty.problems).toContain('has no content after the header block');
    const noHint = parseTwinHeader(header.replace(/`Accept: text\/markdown`/, 'negotiation'));
    expect(noHint.ok ? [] : noHint.problems).toContain(
      'has a Markdown line that does not explain `Accept: text/markdown`'
    );
    const badLanguage = parseTwinHeader(`${header.replace('Language: en', 'Language: E N')}x\n`);
    expect(badLanguage.ok).toBe(false);
  });
});

describe('the page rendition', () => {
  const page = (body: string, head = '') =>
    `<!doctype html><html lang="en"><head><title>Brand · Texuli</title>${head}</head><body><nav>Site nav</nav><main id="main"><!--tx-page-body-->${body}<!--/tx-page-body--><nav>Pager</nav></main><footer>Footer</footer></body></html>`;

  it('takes the marked content, its h1 as the title, absolute links and the note', () => {
    const twin = renderTwin({
      route: '/brand/',
      html: page(
        '<p class="eyebrow">Brand</p><h1>The Texuli brand</h1><p>Read <a href="/guides/">the guides</a>.</p><img src="/brand/texuli-logo-light.png" alt="The Texuli logo: three stacked texels"><img src="/x.png" alt=""><svg aria-hidden="true"><path d=""/></svg>'
      ),
      facts: { title: 'Brand · Texuli', description: 'The brand story.', language: 'en' },
      origin: ORIGIN,
      lastUpdated: '2026-10-30',
      note: '## For agents\n\nA [link](/llms.txt).',
    });
    const parsed = parseTwinHeader(twin);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.header.title).toBe('The Texuli brand');
    expect(parsed.header.canonical).toBe(`${ORIGIN}/brand/`);
    expect(parsed.header.markdown).toContain(`${ORIGIN}/brand.md`);
    // The h1 moved into the header: it is not repeated in the body.
    expect(twin.match(/^# /gm)).toHaveLength(1);
    expect(twin).toContain(`Read [the guides](${ORIGIN}/guides/).`);
    // No fact lives only in an image: the alt text is text, the decorative ones vanish.
    expect(twin).toContain(
      `![The Texuli logo: three stacked texels](${ORIGIN}/brand/texuli-logo-light.png)`
    );
    expect(twin).not.toContain('/x.png');
    expect(twin).not.toMatch(/Site nav|Pager|Footer/);
    expect(twin.trimEnd().endsWith(`A [link](${ORIGIN}/llms.txt).`)).toBe(true);
  });

  it('falls back to the document title when the page has no h1', () => {
    const twin = renderTwin({
      route: '/brand/',
      html: page('<h2>Section</h2><p>Text.</p>'),
      facts: { title: 'Brand · Texuli', description: '', language: 'en' },
      origin: ORIGIN,
      lastUpdated: '2026-10-30',
    });
    expect(twin.startsWith('# Brand\n\nLanguage: en\n')).toBe(true);
    expect(twin).toContain('## Section');
  });

  it('refuses an exempt route', () => {
    expect(() =>
      renderTwin({
        route: '/404.html',
        html: page('<h1>Not found</h1>'),
        facts: { title: 'Not found', description: '', language: 'en' },
        origin: ORIGIN,
        lastUpdated: '2026-10-30',
      })
    ).toThrow(/no twin/);
  });

  it('reads content from the markers, else <main>, else <body>', () => {
    expect(pageContentHtml(page('<p>Marked</p>'))).toBe('<p>Marked</p>');
    expect(pageContentHtml('<body><nav>n</nav><main class="m"><p>Main</p></main></body>')).toBe(
      '<p>Main</p>'
    );
    expect(pageContentHtml('<html><body class="b"><p>Body</p></body></html>')).toBe('<p>Body</p>');
    expect(pageLanguage('<html lang="es" dir="ltr">')).toBe('es');
    expect(pageLanguage('<html>')).toBe('en');
    expect(pageTitle('Theming · Texuli')).toBe('Theming');
    expect(pageTitle('Code blocks · preview')).toBe('Code blocks');
    expect(pageTitle('Texuli')).toBe('Texuli');
  });

  it('htmlToMarkdown keeps labelled SVG and alt text, drops data URIs, and unwraps layout tables', () => {
    expect(
      htmlToMarkdown('<svg role="img" aria-label="Orders rose 12%"><path d="M0"/></svg>')
    ).toBe('Orders rose 12%\n');
    expect(htmlToMarkdown('<p><img src="data:image/png;base64,AAAA" alt="A [chart]"></p>')).toBe(
      'A chart\n'
    );
    expect(htmlToMarkdown('<img src="/a.png" alt="Logo" aria-hidden="true">')).toBe('\n');
    const email =
      '<table role="presentation"><tr><td><h1>Digest</h1><table><tr><th>Region</th><th>Orders</th></tr><tr><td>East</td><td>512</td></tr></table><p>After</p></td></tr></table>';
    expect(htmlToMarkdown(email)).toBe(
      '# Digest\n\n| Region | Orders |\n| --- | --- |\n| East | 512 |\n\nAfter\n'
    );
  });
});

describe('"For agents" notes', () => {
  it('name only operations the remote MCP serves and package READMEs that exist', () => {
    const served = new Set(EDGE_OPS.map((operation) => operation.name));
    for (const note of TWIN_NOTES) {
      for (const name of note.operations)
        expect(served.has(name), `${note.route} ${name}`).toBe(true);
      for (const name of note.packages)
        expect(existsSync(resolve(`packages/${name}/README.md`)), name).toBe(true);
      for (const link of note.links ?? [])
        expect(link.href.startsWith('/') || link.href.startsWith('https://')).toBe(true);
    }
  });

  it('cover the interactive pages and not the reading pages', () => {
    for (const route of [
      '/',
      '/theme-studio/',
      '/builder/',
      '/playground/',
      '/slides-page/',
      '/documents-page/',
      '/component-pages/button/',
      '/component-pages/',
      '/examples/blocks-code/',
      '/examples/preview/blocks-code/',
      '/gallery-components/preview/',
      '/output-page/preview/',
      '/showcase/kanban/',
      '/workflows-page/json/',
    ])
      expect(twinNoteFor(route), route).toBeDefined();
    for (const route of ['/guides/theming/', '/primitives-page/dialog/', '/perf/', '/changelog/'])
      expect(twinNoteFor(route), route).toBeUndefined();
  });

  it('print the operations with their titles, the component id and the example page', () => {
    const button = agentNoteMarkdown('/component-pages/button/', EDGE_OPS, ORIGIN) ?? '';
    expect(button).toMatch(/^## For agents\n/);
    expect(button).toContain(`${ORIGIN}/mcp`);
    expect(button).toContain(
      '- `component.get`: Read a component manifest with `{"id":"button"}`.'
    );
    expect(button).toContain('(/llms/components/button.md)');
    const preview = agentNoteMarkdown('/examples/preview/blocks-code/', EDGE_OPS, ORIGIN) ?? '';
    expect(preview).toContain('(/examples/blocks-code.md)');
    expect(agentNoteMarkdown('/guides/theming/', EDGE_OPS, ORIGIN)).toBeUndefined();
    expect(() => agentNoteMarkdown('/builder/', [], ORIGIN)).toThrow(/unknown operation/);
  });
});

describe('the twin manifest pages index (T-ar-site-mcp)', () => {
  it('lists title, description and plain h2/h3 headings outside code fences', () => {
    const markdown = renderTwin({
      route: '/guides/theming/',
      html: '<main><h1>Theming</h1><h2>CSS <a href="/x/">layers</a></h2><p>Text.</p><pre><code>## not a heading</code></pre><h3>Dark <code>mode</code></h3><h4>Too deep</h4></main>',
      facts: { title: 'Theming · Texuli', description: '  Pick a\n theme. ', language: 'en' },
      origin: ORIGIN,
      lastUpdated: '2026-10-30',
    });
    expect(
      twinIndexEntry('/guides/theming/', '/guides/theming.md', markdown, '  Pick a\n theme. ')
    ).toEqual({
      path: '/guides/theming/',
      twin: '/guides/theming.md',
      title: 'Theming',
      description: 'Pick a theme.',
      headings: ['CSS layers', 'Dark mode'],
    });
    const fenced = '# T\n\n```md\n## inside\n```\n\n## outside\n';
    expect(twinIndexEntry('/t/', '/t.md', fenced, '').headings).toEqual(['outside']);
  });

  it('caps the headings of one page', () => {
    const many = `# Many\n\n${Array.from({ length: 100 }, (_, i) => `## H${i}`).join('\n\n')}\n`;
    const entry = twinIndexEntry('/many/', '/many.md', many, '');
    expect(entry.headings).toHaveLength(TWIN_INDEX_MAX_HEADINGS);
    expect(entry.title).toBe('Many');
  });
});
