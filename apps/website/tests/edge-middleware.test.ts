// @vitest-environment node
/**
 * The edge middleware (functions/_middleware.ts) and the pure helpers it
 * composes: agent classification and the agent 404 (T-27), Markdown twin
 * negotiation with Vary (T-100 S-2, P2-5), the Markdown rendition the twins
 * and "Copy page" share (W11, the list regression of 08c5ebcf), the robots
 * rewrite for strict parsers (T-28), and the server-side bot and markdown
 * events (T-37: UA class and path only, off when unprovisioned).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequest } from '../../../functions/_middleware.ts';
import { absolutizeMarkdownLinks, htmlToMarkdown } from '../src/components/docs/markdown.ts';
import { markdownTwinFor, prefersMarkdown } from '../src/components/docs/markdown-negotiation.ts';
import { varyHeaderLine } from '../src/components/security/csp.ts';
import { buildRobots } from '../src/components/seo/seo.ts';
import { agentProblem, isAgentRequest } from '../src/lib/agent-request.ts';
import {
  botEventFor,
  buildBotEventBody,
  buildBotEventRequest,
  classifyBotUa,
} from '../src/lib/bot-events.ts';
import { markdownNotFound, negotiateTwin, prefersProblemJson } from '../src/lib/md-negotiate.ts';
import {
  isStrictParserAudit,
  stripDirectivesForStrictParsers,
} from '../src/lib/robots-variants.ts';

const CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const LIGHTHOUSE = `${CHROME} Chrome-Lighthouse`;
const CLAUDEBOT = 'Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)';

describe('user-agent classification', () => {
  it('isAgentRequest: crawlers and plain HTTP clients are agents; browsers and audit tools are not', () => {
    for (const userAgent of [
      'GPTBot/1.0 (+https://openai.com/gptbot)',
      CLAUDEBOT,
      'Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
      'Mozilla/5.0 (compatible; OAI-SearchBot/1.0)',
      'Mozilla/5.0 (compatible; Bytespider; spider-feedback@bytedance.com)',
      'Anthropic AI Client (anthropic-ai/1.0)',
      'curl/8.4.0',
      'Wget/1.21.3',
      'python-requests/2.31.0',
      'Go-http-client/2.0',
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    ]) {
      expect(isAgentRequest(userAgent), userAgent).toBe(true);
    }
    // Audit tools need browser-shaped output, never problem+json.
    for (const userAgent of [
      CHROME,
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      LIGHTHOUSE,
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/131.0.0.0 Safari/537.36 Chrome-Lighthouse',
      null,
      undefined,
      '',
    ]) {
      expect(isAgentRequest(userAgent), String(userAgent)).toBe(false);
    }
  });

  it('classifyBotUa sorts AI bots, plain agents, audit tools, unknown bots and humans', () => {
    const table: [string | null | undefined, string][] = [
      ['GPTBot/1.0 (+https://openai.com/gptbot)', 'ai_bot'],
      [CLAUDEBOT, 'ai_bot'],
      [
        'Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
        'ai_bot',
      ],
      ['Mozilla/5.0 (compatible; Bytespider; spider-feedback@bytedance.com)', 'ai_bot'],
      ['Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'plain_agent'],
      ['curl/8.4.0', 'plain_agent'],
      ['python-requests/2.31.0', 'plain_agent'],
      [LIGHTHOUSE, 'audit_tool'],
      ['Mozilla/5.0 Lighthouse/12 (audit)', 'audit_tool'],
      ['SiteMonitor 3.0 (uptime watcher)', 'unknown_bot'],
      ['SomeFetcher/1.0', 'unknown_bot'],
      ['Mozilla/5.0 (Macintosh) Chrome/131.0.0.0 Safari/537.36', 'human'],
      [
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) Version/18.0 Mobile/15E148 Safari/604.1',
        'human',
      ],
      [undefined, 'human'],
      [null, 'human'],
      ['', 'human'],
    ];
    for (const [userAgent, expected] of table) {
      expect(classifyBotUa(userAgent), String(userAgent)).toBe(expected);
    }
  });

  it('isStrictParserAudit recognizes the Lighthouse family only', () => {
    expect(isStrictParserAudit(LIGHTHOUSE)).toBe(true);
    expect(
      isStrictParserAudit('Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome Chrome-Lighthouse')
    ).toBe(true);
    for (const userAgent of [CHROME, 'Mozilla/5.0 (compatible; ClaudeBot/1.0)', null, '']) {
      expect(isStrictParserAudit(userAgent), String(userAgent)).toBe(false);
    }
  });
});

describe('Markdown twins: negotiation and rendition', () => {
  it('markdownTwinFor maps every page path to its .md twin, the root to /index.md, and nothing else (T-ar-twins)', () => {
    const table: [string, string][] = [
      ['/', '/index.md'],
      ['/index.html', '/index.md'],
      ['/guides/theming/', '/guides/theming.md'],
      ['/guides/theming/index.html', '/guides/theming.md'],
      ['/guides/theming', '/guides/theming.md'],
      ['/skill/', '/skill.md'],
      ['/theme-studio/', '/theme-studio.md'],
      ['/examples/preview/blocks-code/', '/examples/preview/blocks-code.md'],
      ['/component-pages/button/', '/component-pages/button.md'],
    ];
    for (const [path, twin] of table) expect(markdownTwinFor(path), path).toBe(twin);
    for (const path of [
      '/guides/theming.md',
      '/llms.txt',
      '/theme-css/aurora.css',
      '/catalog/catalog.json',
      '/api/umami/api/send',
      '/.well-known/api-catalog',
      '/mcp',
      '/_astro/app.js',
      '//evil.example/',
      '/a/../b/',
      'guides/theming/',
      '',
    ]) {
      expect(markdownTwinFor(path), path).toBeUndefined();
    }
  });

  it('prefersMarkdown negotiates only an explicit, non-zero text/markdown entry (P2-5)', () => {
    const table: [string | null | undefined, boolean][] = [
      ['text/markdown', true],
      ['text/html, text/markdown;q=0.9', true],
      [' text/markdown ;q=0.8', true],
      ['*/*', false],
      ['text/html', false],
      ['', false],
      [null, false],
      [undefined, false],
      // RFC 9110 §12.4.2: a weight of 0 means "not acceptable".
      ['text/markdown;q=0', false],
      ['text/html, text/markdown; q=0', false],
      ['text/markdown;Q=0.0', false],
      ['text/markdown;charset=utf-8;q=0.000', false],
      ['text/markdown;q=0.001', true],
      ['text/markdown;charset=utf-8', true],
      ['text/markdown;q=0, text/markdown;q=1', true],
    ];
    for (const [accept, expected] of table) {
      expect(prefersMarkdown(accept), String(accept)).toBe(expected);
    }
  });

  it('negotiateTwin answers with the twin and the negotiation headers, or passes through', () => {
    for (const [pathname, accept, twin] of [
      ['/guides/theming/', 'text/markdown', '/guides/theming.md'],
      ['/guides/theming/', 'text/html, text/markdown;q=0.9', '/guides/theming.md'],
      ['/component-pages/button/', ' text/markdown ;q=0.8', '/component-pages/button.md'],
      ['/primitives-page/accordion/', 'text/markdown', '/primitives-page/accordion.md'],
      ['/skill/', 'text/markdown', '/skill.md'],
      // PLAN_011 T-ar-twins: the root and non-docs pages negotiate too.
      ['/', 'text/markdown', '/index.md'],
      ['/examples/', 'text/markdown', '/examples.md'],
      ['/theme-studio/', 'text/markdown', '/theme-studio.md'],
    ] as const) {
      const decision = negotiateTwin(pathname, accept);
      expect(decision?.twin, `${pathname} ${accept}`).toBe(twin);
      expect(decision?.headers).toMatchObject({
        'content-type': 'text/markdown; charset=utf-8',
        vary: 'Accept',
        'x-content-negotiation': 'markdown',
      });
    }
    for (const [pathname, accept] of [
      ['/', 'text/html'],
      ['/', '*/*'],
      ['/guides/theming/', 'text/html'],
      ['/guides/theming/', '*/*'],
      ['/guides/theming/', null],
      ['/guides/theming/', ''],
      ['/guides/theming.md', 'text/markdown'],
      ['/llms.txt', 'text/markdown'],
      ['/api/umami/api/send', 'text/markdown'],
    ] as const) {
      expect(negotiateTwin(pathname, accept), `${pathname} ${accept}`).toBeNull();
    }
  });

  it('declares Vary: Accept in the _headers rule of every page whose twin was built (S-2, T-ar-twins)', () => {
    const built = new Set(['/guides/theming.md', '/index.md', '/theme-studio.md']);
    const exists = (path: string) => built.has(path);
    expect(varyHeaderLine('/guides/theming/', exists)).toBe('\n  Vary: Accept');
    expect(varyHeaderLine('/guides/theming/index.html', exists)).toBe('\n  Vary: Accept');
    expect(varyHeaderLine('/', exists)).toBe('\n  Vary: Accept');
    expect(varyHeaderLine('/theme-studio/', exists)).toBe('\n  Vary: Accept');
    // No twin built (the 404, a missing page): no Vary.
    expect(varyHeaderLine('/404.html', exists)).toBe('');
    expect(varyHeaderLine('/brand/', exists)).toBe('');
  });

  it('absolutizes root-relative links, leaving anchors and fenced code alone', () => {
    expect(
      absolutizeMarkdownLinks(
        'See [Theming](/guides/theming/) and [the API](/skill/#api "The skill").\n[anchor](#x) stays.',
        'https://texuli.com'
      )
    ).toBe(
      'See [Theming](https://texuli.com/guides/theming/) and [the API](https://texuli.com/skill/#api "The skill").\n[anchor](#x) stays.'
    );
    expect(
      absolutizeMarkdownLinks(
        'text\n\n```\n[link](/not/rewritten/)\n```\n\n[real](/guides/)\n',
        'https://texuli.com'
      )
    ).toBe('text\n\n```\n[link](/not/rewritten/)\n```\n\n[real](https://texuli.com/guides/)\n');
  });

  it('htmlToMarkdown renders lists one item per line and tables with one separator row', () => {
    // Commit 08c5ebcf dropped the <li> rule; lists ran together ("One**Two**").
    const list = htmlToMarkdown('<ul><li>One</li><li><strong>Two</strong></li></ul><p>After</p>');
    expect(list).toContain('- One\n- **Two**');
    expect(list).toContain('After');
    expect(htmlToMarkdown('<ol><li>First</li><li>Second</li></ol>')).toContain('- First\n- Second');
    // Component pages mark every body row up with `th scope="row"`.
    const table =
      '<table><thead><tr><th>Name</th><th>Kind</th></tr></thead><tbody>' +
      '<tr><th scope="row">variant</th><td>enum</td></tr>' +
      '<tr><th scope="row">size</th><td>enum</td></tr>' +
      '</tbody></table>';
    expect(htmlToMarkdown(table)).toBe(
      '| Name | Kind |\n| --- | --- |\n| variant | enum |\n| size | enum |\n'
    );
  });

  it('htmlToMarkdown drops the copy-page hint from built markup, whatever the attribute order (W11)', () => {
    // The real built markup (dist/guides/dark-mode/index.html, body shortened):
    // the Astro scope attribute follows the class.
    const built =
      '<div class="copy-page" data-copy-page="" data-astro-cid-xzk5d6la><p class="copy-page__hint" data-astro-cid-xzk5d6la>This page ships a Markdown twin for AI tools.</p><!--[--><!--[-1--><button class="tx-button tx-button--outline tx-button--sm" type="button" data-tx-button="true" data-variant="outline" data-size="sm" data-copy-page-button="" data-astro-cid-xzk5d6la="true"><!--[-1--><!--[-1-->Copy page<!----><!--]--><!--]--><!----></button><!--]--><!--]--><template data-page-markdown="" data-astro-cid-xzk5d6la># Dark mode</template><p class="copy-page__status" role="status" data-copy-page-status="" data-astro-cid-xzk5d6la></p></div>';
    const markdown = htmlToMarkdown(`${built}<h2>Setup</h2><p>Body text.</p>`);
    expect(markdown).not.toContain('Markdown twin');
    expect(markdown).not.toContain('Copy page');
    expect(markdown).toContain('## Setup');
    expect(markdown).toContain('Body text.');
    for (const html of [
      '<p data-astro-cid-abc class="copy-page__hint">Hint.</p>',
      '<p class="lead copy-page__hint" data-x="1">Hint.</p>',
      '<P CLASS="copy-page__hint">Hint.</P>',
    ]) {
      expect(htmlToMarkdown(`${html}<p>Kept.</p>`).trim(), html).toBe('Kept.');
    }
    expect(htmlToMarkdown('<p class="copy-page__hint-free">Kept.</p>').trim()).toBe('Kept.');
  });
});

describe('robots variants for strict parsers', () => {
  it('strips only the non-standard lines of the shipped policy and keeps its invariants', () => {
    const shipped = buildRobots('https://texuli.com/sitemap.xml');
    const stripped = stripDirectivesForStrictParsers(shipped);
    // PLAN_011 T-ar-discovery: the shipped policy now carries both directives.
    expect(shipped).toMatch(/^Content-Signal: /m);
    expect(shipped).toMatch(/^Agentmap: /m);
    expect(stripped).not.toMatch(/^(Content-Signal|Agentmap):/m);
    expect(
      stripped.split('\n').filter((line) => !/^(Content-Signal|Agentmap):/.test(line))
    ).toEqual(stripped.split('\n'));
    expect(stripped).toContain('User-agent: *\nAllow: /');
    expect(stripped).toMatch(/^Sitemap: /m);
    expect(stripped).toContain('User-agent: GPTBot\nAllow: /');
    expect(
      shipped
        .split('\n')
        .filter((line) => !/^(Content-Signal|Agentmap):/.test(line))
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
    ).toBe(stripped);
  });

  it('strips Content-Signal and Agentmap lines and collapses the gaps they leave', () => {
    const policy = [
      '# header',
      'User-agent: *',
      'Allow: /',
      'Content-Signal: ai-train=yes, search=yes, ai-input=yes',
      'Agentmap: /.well-known/ai-catalog.json',
      '',
      'Sitemap: https://texuli.com/sitemap.xml',
      '',
      'User-agent: GPTBot',
      'Allow: /',
    ].join('\n');
    expect(stripDirectivesForStrictParsers(policy)).toBe(
      [
        '# header',
        'User-agent: *',
        'Allow: /',
        '',
        'Sitemap: https://texuli.com/sitemap.xml',
        '',
        'User-agent: GPTBot',
        'Allow: /',
      ].join('\n')
    );
    expect(
      stripDirectivesForStrictParsers(
        'User-agent: *\nAllow: /\n\n\n\nContent-Signal: ai-train=yes\n\nSitemap: /sitemap.xml'
      )
    ).toBe('User-agent: *\nAllow: /\n\nSitemap: /sitemap.xml');
  });
});

/** A context stub over an in-memory asset map, recording asset fetches. */
function makeContext(
  pathname: string,
  accept: string | null,
  assets: Record<string, number>,
  userAgent: string | null = 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/131 Safari/537.36',
  assetBodies: Record<string, string> = {}
) {
  const fetches: string[] = [];
  const next = vi.fn(async () => {
    if (assets['*404*'] !== undefined)
      return new Response('<!doctype html><html lang="en"><body>404</body></html>', {
        status: 404,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    return new Response('<!doctype html><html lang="en"><body>page</body></html>', {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  });
  const context = {
    request: new Request(`https://texuli.com${pathname}`, {
      headers: new Headers({
        ...(accept === null ? {} : { accept }),
        ...(userAgent === null ? {} : { 'user-agent': userAgent }),
      }),
    }),
    next,
    env: {
      ASSETS: {
        fetch: async (request: Request) => {
          const path = new URL(request.url).pathname;
          fetches.push(path);
          const body = assetBodies[path];
          if (body !== undefined) return new Response(body, { status: 200 });
          const bytes = assets[path];
          return bytes === undefined
            ? new Response('not found', { status: 404 })
            : new Response('# Twin\n'.repeat(bytes), { status: 200 });
        },
      },
    },
  };
  return { context, next, fetches };
}

describe('the middleware: twins, host headers, agent 404', () => {
  it('serves a built twin with the negotiation headers, and falls through when none was built', async () => {
    const served = makeContext('/guides/theming/', 'text/markdown', { '/guides/theming.md': 3 });
    const response = await onRequest(served.context);
    expect(served.next).not.toHaveBeenCalled();
    expect(served.fetches).toEqual(['/guides/theming.md']);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
    expect(response.headers.get('vary')).toBe('Accept');
    expect(response.headers.get('x-content-negotiation')).toBe('markdown');
    // A Function response gets no _headers rule, so the twin carries the
    // discovery Link itself (PLAN_011 T-ar-discovery), service-desc included
    // now that every build writes /openapi.json (T-ar-api).
    expect(response.headers.get('link')).toBe(
      '</.well-known/api-catalog>; rel="api-catalog", </openapi.json>; rel="service-desc", </llms.txt>; rel="describedby", </.well-known/ai-catalog.json>; rel="ai-catalog"'
    );
    expect(await response.text()).toBe('# Twin\n# Twin\n# Twin\n');

    const missing = makeContext('/guides/theming/', 'text/markdown', {});
    const fallback = await onRequest(missing.context);
    expect(missing.fetches).toEqual(['/guides/theming.md']);
    expect(missing.next).toHaveBeenCalledTimes(1);
    expect(fallback.headers.get('content-type')).toBe('text/html; charset=utf-8');
  });

  it('passes browsers through without an asset fetch', async () => {
    for (const path of ['/guides/theming/', '/', '/theme-studio/']) {
      const browser = makeContext(path, 'text/html,application/xhtml+xml,*/*;q=0.8', {
        '/index.md': 1,
      });
      const response = await onRequest(browser.context);
      expect(browser.next, path).toHaveBeenCalledTimes(1);
      expect(browser.fetches, path).toEqual([]);
      expect(response.headers.get('x-content-negotiation')).toBeNull();
    }
  });

  it('negotiates the root and non-docs pages to their twins, with Vary (T-ar-twins)', async () => {
    for (const [path, twin] of [
      ['/', '/index.md'],
      ['/theme-studio/', '/theme-studio.md'],
      ['/examples/blocks-code/', '/examples/blocks-code.md'],
      ['/showcase/kanban', '/showcase/kanban.md'],
    ] as const) {
      const served = makeContext(path, 'text/markdown', { [twin]: 2 }, 'curl/8.4.0');
      const response = await onRequest(served.context);
      expect(served.next, path).not.toHaveBeenCalled();
      expect(served.fetches, path).toEqual([twin]);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
      expect(response.headers.get('vary')).toBe('Accept');
      expect(response.headers.get('x-content-negotiation')).toBe('markdown');
      expect(await response.text()).toBe('# Twin\n# Twin\n');
    }
    // The query string never reaches the asset fetch.
    const query = makeContext('/?utm=x', 'text/markdown', { '/index.md': 1 });
    await onRequest(query.context);
    expect(query.fetches).toEqual(['/index.md']);
  });

  it('serves a .md URL directly as text/markdown with UTF-8, and counts nothing extra on a miss', async () => {
    const direct = makeContext('/index.md', null, {});
    direct.next.mockImplementationOnce(
      async () =>
        new Response('# Home\n', {
          status: 200,
          headers: { 'content-type': 'application/octet-stream', etag: '"abc"' },
        })
    );
    const response = await onRequest(direct.context);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('etag')).toBe('"abc"');
    expect(response.headers.get('link')).toContain('rel="api-catalog"');
    expect(await response.text()).toBe('# Home\n');
    expect(direct.fetches).toEqual([]);

    // A 304 for a cached twin passes through untouched.
    const cached = makeContext('/guides/theming.md', null, {});
    const notModified = new Response(null, { status: 304 });
    cached.next.mockImplementationOnce(async () => notModified);
    expect(await onRequest(cached.context)).toBe(notModified);
  });

  // Cloudflare Pages applies `_headers` (the per-page CSP) only to the asset
  // response itself: a Function that rebuilds the response drops the CSP.
  it('returns the pipeline HTML response itself, never a rebuilt copy (T-100 S-2)', async () => {
    for (const path of ['/guides/theming/', '/web-and-native/', '/']) {
      const { context, next } = makeContext(path, 'text/html', {});
      const piped = new Response('<!doctype html><html lang="en"><body>page</body></html>', {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
      next.mockImplementationOnce(async () => piped);
      expect(await onRequest(context), path).toBe(piped);
    }
  });

  it('answers a non-browser miss with a Markdown body (T-ar-twins)', async () => {
    for (const [userAgent, accept] of [
      [CLAUDEBOT, 'text/html'],
      ['curl/8.4.0', '*/*'],
      ['GPTBot/1.0', null],
      // Any client that asks for Markdown is not a browser page view.
      ['Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/131 Safari/537.36', 'text/markdown'],
    ] as const) {
      const miss = makeContext('/no/such/page/', accept, { '*404*': 1 }, userAgent);
      const response = await onRequest(miss.context);
      expect(response.status, userAgent).toBe(404);
      expect(response.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
      expect(response.headers.get('vary')).toBe('Accept');
      const body = await response.text();
      expect(body).toMatch(/^# Not found\n/);
      expect(body).toContain('`/no/such/page/`');
      expect(body).toContain('https://texuli.com/llms.txt');
      expect(body).toContain('https://texuli.com/index.md');
    }
    // A negotiated twin that does not exist ends in the Markdown 404 too.
    const ghost = makeContext('/ghost/', 'text/markdown', { '*404*': 1 }, 'curl/8.4.0');
    const ghostResponse = await onRequest(ghost.context);
    expect(ghost.fetches).toEqual(['/ghost.md']);
    expect(ghostResponse.status).toBe(404);
    expect(ghostResponse.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
  });

  it('echoes a hostile missed path only as inert, capped code text', async () => {
    const hostile = `/${'x'.repeat(400)}\`<script>alert(1)</script>`;
    const body = markdownNotFound(hostile, 'https://texuli.com');
    const shown = /There is no page at `([^`]*)`/.exec(body)?.[1] ?? '';
    expect(shown.length).toBeLessThanOrEqual(200);
    expect(body.split('`').length % 2).toBe(1);
    expect(markdownNotFound('/a\u0000b\nc`d/', 'https://texuli.com')).toContain('`/abcd/`');
    expect(prefersProblemJson('/api/x', 'text/markdown')).toBe(true);
    expect(prefersProblemJson('/x/', 'application/json, text/markdown')).toBe(false);
    expect(prefersProblemJson('/x/', 'text/html')).toBe(false);
    expect(prefersProblemJson('/x/', null)).toBe(false);
  });

  it('answers an /api/ or JSON miss with problem+json and keeps the HTML 404 for humans and Lighthouse (T-27)', async () => {
    const problem = {
      type: 'about:blank',
      title: 'Not found',
      status: 404,
      instance: '/no/such/page/',
      guide: 'https://texuli.com/llms.txt',
    };
    expect(agentProblem('/no/such/page/', 'https://texuli.com')).toEqual(problem);

    // problem+json stays for /api/ paths (now the API envelope's typed
    // problem, for every client, PLAN_011 T-ar-api) and for JSON clients.
    for (const userAgent of [CLAUDEBOT, 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/131']) {
      const api = makeContext('/api/no-such', 'text/html', { '*404*': 1 }, userAgent);
      const apiResponse = await onRequest(api.context);
      expect(apiResponse.status).toBe(404);
      expect(apiResponse.headers.get('content-type')).toBe('application/problem+json');
      expect(await apiResponse.json()).toMatchObject({
        status: 404,
        instance: '/api/no-such',
        error: { code: 'resource_not_found' },
      });
      expect(api.next).not.toHaveBeenCalled();
    }
    for (const accept of ['application/json', 'application/problem+json, */*;q=0.1']) {
      const json = makeContext('/no/such/page/', accept, { '*404*': 1 }, 'curl/8.4.0');
      const jsonResponse = await onRequest(json.context);
      expect(jsonResponse.headers.get('content-type'), accept).toBe('application/problem+json');
      expect(await jsonResponse.json()).toMatchObject(problem);
    }

    for (const userAgent of [
      'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/131 Safari/537.36',
      'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Chrome-Lighthouse',
    ]) {
      const { context } = makeContext('/no/such/page/', 'text/html', { '*404*': 1 }, userAgent);
      const response = await onRequest(context);
      expect(response.status, userAgent).toBe(404);
      expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
      expect(await response.text()).toContain('404');
    }

    const hit = makeContext(
      '/guides/theming/',
      'text/html',
      {},
      'GPTBot/1.0 (+https://openai.com/gptbot)'
    );
    const hitResponse = await onRequest(hit.context);
    expect(hitResponse.status).toBe(200);
    expect(hitResponse.headers.get('content-type')).toBe('text/html; charset=utf-8');
  });
});

describe('the middleware robots rewrite (T-28)', () => {
  const POLICY = [
    '# robots.txt for Texuli',
    'User-agent: *',
    'Allow: /',
    'Content-Signal: ai-train=yes',
    'Agentmap: /.well-known/ai-catalog.json',
    '',
    'Sitemap: https://texuli.com/sitemap.xml',
  ].join('\n');

  function robotsContext(userAgent: string | null, assetBodies?: Record<string, string>) {
    return makeContext(
      '/robots.txt',
      null,
      assetBodies === undefined ? { '*404*': 1 } : {},
      userAgent,
      assetBodies ?? {}
    );
  }

  it('serves Lighthouse the stripped variant, and falls through when the asset is missing', async () => {
    const served = robotsContext(LIGHTHOUSE, { '/robots.txt': POLICY });
    const response = await onRequest(served.context);
    expect(served.next).not.toHaveBeenCalled();
    expect(served.fetches).toEqual(['/robots.txt']);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    const body = await response.text();
    expect(body).not.toContain('Content-Signal:');
    expect(body).not.toContain('Agentmap:');
    expect(body).toContain('Sitemap: https://texuli.com/sitemap.xml');
    expect(body).toContain('User-agent: *');

    const missing = robotsContext(LIGHTHOUSE);
    const fallback = await onRequest(missing.context);
    expect(missing.fetches).toEqual(['/robots.txt']);
    expect(missing.next).toHaveBeenCalledTimes(1);
    expect(fallback.status).toBe(404);
  });

  it('never touches the asset pipeline for anyone else', async () => {
    for (const userAgent of [
      'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/131 Safari/537.36',
      CLAUDEBOT,
      'GPTBot/1.0',
      null,
    ]) {
      const { context, next, fetches } = robotsContext(userAgent, { '/robots.txt': POLICY });
      const response = await onRequest(context);
      expect(fetches, String(userAgent)).toEqual([]);
      expect(next).toHaveBeenCalledTimes(1);
      expect(await response.text()).not.toContain('User-agent: *');
    }
  });
});

describe('server-side bot and markdown events (T-37)', () => {
  it('botEventFor counts twins always, AI and unknown bots on page hits, nothing else', () => {
    expect(botEventFor('Mozilla/5.0 Chrome/131', true)).toBe('markdown_request');
    expect(botEventFor('curl/8.4.0', true)).toBe('markdown_request');
    expect(botEventFor('GPTBot/1.0', false)).toBe('ai_bot_visit');
    expect(botEventFor('SiteMonitor 3.0', false)).toBe('unknown_bot_visit');
    for (const userAgent of [
      'curl/8.4.0',
      'Mozilla/5.0 Lighthouse/12',
      'Mozilla/5.0 Chrome/131',
      undefined,
    ]) {
      expect(botEventFor(userAgent, false), String(userAgent)).toBeNull();
    }
  });

  it('buildBotEventBody carries UA class and a capped, scrubbed path only; null when unprovisioned', () => {
    expect(buildBotEventBody('ai_bot_visit', '/guides/', undefined, 'texuli.com')).toBeNull();
    expect(buildBotEventBody('ai_bot_visit', '/guides/', '', 'texuli.com')).toBeNull();

    const body = buildBotEventBody('ai_bot_visit', '/guides/theming/', 'site-id', 'texuli.com');
    expect(JSON.parse(body as string)).toEqual({
      type: 'event',
      payload: {
        website: 'site-id',
        name: 'ai_bot_visit',
        hostname: 'texuli.com',
        data: { path: '/guides/theming/' },
        userAgent: 'bot',
      },
    });
    expect(body).not.toContain('GPTBot');
    expect(body).not.toContain('Mozilla');

    const long = `/${'a'.repeat(5000)}`;
    const capped = JSON.parse(
      buildBotEventBody('ai_bot_visit', long, 'site-id', 'texuli.com') as string
    );
    expect(capped.payload.data.path).toBe(long.slice(0, 256));

    const scrubbed = JSON.parse(
      buildBotEventBody(
        'unknown_bot_visit',
        '/people/alice@example.com/profile/',
        'site-id',
        'texuli.com'
      ) as string
    );
    expect(scrubbed.payload.data.path).toBe('/people/[redacted]/profile/');

    const twin = JSON.parse(
      buildBotEventBody('markdown_request', '/guides/', 'site-id', 'texuli.com') as string
    );
    expect(twin.payload.userAgent).toBe('markdown-client');

    const request = buildBotEventRequest('{"x":1}', 'https://texuli.com');
    expect(request.method).toBe('POST');
    expect(request.url).toBe('https://texuli.com/api/umami/api/send');
    expect(request.headers.get('content-type')).toBe('application/json');
    expect(request.headers.get('user-agent')).toBe('texuli-edge/1.0 (server-side event)');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  interface SentRequest {
    url: string;
    init: RequestInit;
  }

  async function run(opts: {
    userAgent?: string;
    path?: string;
    accept?: string;
    env: Record<string, string | undefined>;
    next?: () => Promise<Response>;
    assets?: () => Promise<Response>;
  }): Promise<{ sent: SentRequest[]; waited: Promise<unknown>[]; response: Response }> {
    const sent: SentRequest[] = [];
    const waited: Promise<unknown>[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (typeof input === 'string' || input instanceof URL) {
          sent.push({ url: String(input), init: init ?? {} });
        } else {
          const body = await input.text();
          sent.push({
            url: input.url,
            init: { method: input.method, headers: input.headers, body },
          });
        }
        return new Response('{}', { status: 200 });
      })
    );
    const response = await onRequest({
      request: new Request(`https://texuli.com${opts.path ?? '/guides/theming/'}`, {
        headers: {
          ...(opts.userAgent ? { 'user-agent': opts.userAgent } : {}),
          ...(opts.accept ? { accept: opts.accept } : {}),
        },
      }),
      next:
        opts.next ??
        (async () =>
          new Response('<!doctype html><html></html>', {
            headers: { 'content-type': 'text/html; charset=utf-8' },
          })),
      env: {
        ASSETS: { fetch: opts.assets ?? (async () => new Response('missing', { status: 404 })) },
        ...opts.env,
      },
      waitUntil: (promise) => {
        waited.push(promise);
      },
    });
    await Promise.all(waited);
    return { sent, waited, response };
  }

  const PROVISIONED = { PUBLIC_UMAMI_WEBSITE_ID: 'site-id' };

  it('sends ai_bot_visit for a bot page hit through the proxy via waitUntil, path capped', async () => {
    const { sent, waited, response } = await run({ userAgent: 'GPTBot/1.0', env: PROVISIONED });
    expect(response.status).toBe(200);
    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe('https://texuli.com/api/umami/api/send');
    expect(sent[0].init.method).toBe('POST');
    expect(String(sent[0].init.body)).toContain('"name":"ai_bot_visit"');
    expect(waited).toHaveLength(1);

    const long = await run({
      userAgent: 'GPTBot/1.0',
      path: `/${'b'.repeat(3000)}/`,
      env: PROVISIONED,
    });
    expect(JSON.parse(String(long.sent[0].init.body)).payload.data.path).toHaveLength(256);
  });

  it('sends nothing for 404s with invented paths, non-200 answers, humans, or when unprovisioned', async () => {
    const invented = await run({
      userAgent: 'GPTBot/1.0',
      path: '/attacker-chosen/alice@example.com/',
      env: PROVISIONED,
      next: async () =>
        new Response('<!doctype html><title>Not found</title>', {
          status: 404,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        }),
    });
    expect(invented.response.status).toBe(404);
    expect(invented.sent).toHaveLength(0);

    for (const status of [301, 304, 500]) {
      const { sent } = await run({
        userAgent: 'SiteMonitor 3.0',
        env: PROVISIONED,
        next: async () =>
          new Response(status === 304 ? null : '<!doctype html>', {
            status,
            headers: { 'content-type': 'text/html; charset=utf-8' },
          }),
      });
      expect(sent, `status ${status}`).toHaveLength(0);
    }

    expect((await run({ userAgent: 'GPTBot/1.0', env: {} })).sent).toHaveLength(0);

    for (const userAgent of [
      'Mozilla/5.0 (Macintosh) Chrome/131.0.0.0 Safari/537.36',
      'curl/8.4.0',
      'Mozilla/5.0 (X11) Chrome/131.0.0.0 Safari/537.36 Chrome-Lighthouse',
    ]) {
      expect((await run({ userAgent, env: PROVISIONED })).sent, userAgent).toHaveLength(0);
    }
  });

  it('sends markdown_request, under its own UA, only when a twin is actually served', async () => {
    const served = await run({
      userAgent: 'curl/8.4.0',
      accept: 'text/markdown',
      env: PROVISIONED,
      assets: async () => new Response('# Theming\n', { status: 200 }),
    });
    expect(served.sent).toHaveLength(1);
    expect(String(served.sent[0].init.body)).toContain('"name":"markdown_request"');
    expect((served.sent[0].init.headers as Headers).get('user-agent')).toBe(
      'texuli-edge/1.0 (server-side event)'
    );

    const missing = await run({
      userAgent: 'curl/8.4.0',
      accept: 'text/markdown',
      env: PROVISIONED,
      assets: async () => new Response('missing', { status: 404 }),
    });
    expect(missing.sent).toHaveLength(0);
  });

  it('sends markdown_request for a .md URL fetched directly, only when it is served (T-ar-twins)', async () => {
    const direct = await run({
      userAgent: 'GPTBot/1.0',
      path: '/index.md',
      env: PROVISIONED,
      next: async () => new Response('# Home\n', { status: 200 }),
    });
    expect(direct.response.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
    expect(direct.sent).toHaveLength(1);
    const body = JSON.parse(String(direct.sent[0].init.body));
    expect(body.payload.name).toBe('markdown_request');
    expect(body.payload.data.path).toBe('/index.md');

    const miss = await run({
      userAgent: 'GPTBot/1.0',
      path: '/nothing.md',
      env: PROVISIONED,
      next: async () => new Response('gone', { status: 404 }),
    });
    expect(miss.sent).toHaveLength(0);
    expect(miss.response.status).toBe(404);
  });
});
