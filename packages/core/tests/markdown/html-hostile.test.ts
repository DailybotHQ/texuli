/**
 * Hostile input (AC-md-html): XSS vectors (scheme tricks, entity-obfuscated schemes, event
 * handlers, mutation-XSS nesting, raw-text escapes, unclosed tags) through both directions, and
 * nesting and size bombs that must stay bounded and linear. T-md-security widens this corpus.
 */
import { describe, expect, it } from 'vitest';
import { HTML_MAX_ELEMENT_DEPTH, htmlToMarkdownTree } from '../../src/html/index.ts';
import type { MdNode, MdRoot } from '../../src/markdown/ast.ts';
import { markdownTreeToHtml } from '../../src/markdown-html/index.ts';
import { p, root, t, unsafeParts } from './helpers.ts';

const XSS_HTML = [
  '<script>alert(1)</script>',
  '<SCRIPT SRC=https://example.com/x.js></SCRIPT>',
  '<img src=x onerror=alert(1)>',
  '<img src="javascript:alert(1)">',
  '<img src="https://example.com/a.png" srcset="javascript:alert(1) 1x" onload="alert(1)">',
  '<a href="javascript:alert(1)">x</a>',
  '<a href="JaVaScRiPt:alert(1)">x</a>',
  '<a href="  javascript:alert(1)">x</a>',
  '<a href="java&#x09;script:alert(1)">x</a>',
  '<a href="java&#9;script:alert(1)">x</a>',
  '<a href="jav&Tab;ascript:alert(1)">x</a>',
  '<a href="java&NewLine;script:alert(1)">x</a>',
  '<a href="&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;&#58;alert(1)">x</a>',
  '<a href="&#x6A&#x61&#x76&#x61&#x73&#x63&#x72&#x69&#x70&#x74&#x3A;alert(1)">x</a>',
  '<a href="&#0000106&#0000097&#0000118&#0000097&#0000115&#0000099&#0000114&#0000105&#0000112&#0000116&#0000058alert(1)">x</a>',
  '<a href="javascript&colon;alert(1)">x</a>',
  '<a href="ja\u0000vascript:alert(1)">x</a>',
  '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">x</a>',
  '<a href="vbscript:msgbox(1)">x</a>',
  '<a href="//evil.example/">x</a>',
  '<a href="\\\\evil.example/">x</a>',
  '<a href="https://bank.example@evil.example/">x</a>',
  '<a href="https://ex\u200bample.com/">x</a>',
  '<a href="https://example.com" onclick="alert(1)" style="x:expression(alert(1))">ok</a>',
  '<svg onload=alert(1)>',
  '<svg><script>alert(1)</script></svg>',
  '<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>',
  '<noscript><p title="</noscript><img src=x onerror=alert(1)>">',
  '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
  '<form><button formaction=javascript:alert(1)>x</button></form>',
  '<details open ontoggle=alert(1)>x</details>',
  '<body onload=alert(1)>x',
  '<div style="background:url(javascript:alert(1))">x</div>',
  '<p title="&quot;><script>alert(1)</script>">x</p>',
  '<<script>alert(1)//<</script>',
  '<scr<script>ipt>alert(1)</script>',
  '<!--<img src=x onerror=alert(1)>-->',
  '<!--><img src=x onerror=alert(1)>-->',
  '<xmp><img src=x onerror=alert(1)></xmp>',
  '<textarea><img src=x onerror=alert(1)></textarea>',
  '<template><img src=x onerror=alert(1)></template>',
  '<plaintext><img src=x onerror=alert(1)>',
  '<object data="javascript:alert(1)"></object>',
  '<embed src="javascript:alert(1)">',
  '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">',
  '<base href="javascript:alert(1)//">',
  '<video><source onerror=alert(1)></video>',
  '<input onfocus=alert(1) autofocus>',
  '<marquee onstart=alert(1)>x</marquee>',
  '<a href="https://example.com/"><img src=x onerror=alert(1)>link',
  '<b><i><u><a href="javascript:alert(1)">unclosed',
  '<a href="https://example.com/x" title="x" onmouseover="alert(1)"',
  '<img src="https://example.com/a.png" alt="&lt;script&gt;alert(1)&lt;/script&gt;">',
  '<span data-mention="user" data-mention-id="&quot; onclick=&quot;alert(1)">@x</span>',
  '<pre><code class="language-x&quot; onclick=&quot;alert(1)">y</code></pre>',
  '<li id="user-content-fn-x" onclick="alert(1)">x</li>',
];

/** Every link and image URL in a tree, for a direct check of what the reader kept. */
function urls(tree: MdRoot): string[] {
  const out: string[] = [];
  const stack: MdNode[] = [tree];
  while (stack.length > 0) {
    const node = stack.pop() as MdNode;
    if (node.type === 'link' || node.type === 'image') out.push(node.url);
    if ('children' in node) stack.push(...(node.children as MdNode[]));
  }
  return out;
}

const DANGEROUS = /^(?:javascript|vbscript|data):|^(?:\/\/|\\)/i;
// biome-ignore lint/suspicious/noControlCharactersInRegex: browsers strip these in URLs.
const compact = (url: string) => url.replace(/[\u0000- \u007f]/g, '');

describe('hostile HTML in, safe tree and HTML out', () => {
  for (const vector of XSS_HTML) {
    it(`neutralizes ${JSON.stringify(vector).slice(0, 90)}`, () => {
      const { tree } = htmlToMarkdownTree(vector);
      for (const url of urls(tree)) expect(compact(url)).not.toMatch(DANGEROUS);
      for (const trust of ['untrusted', 'developer'] as const) {
        const out = markdownTreeToHtml(htmlToMarkdownTree(vector, { trust }).tree, { trust }).html;
        expect(unsafeParts(out, trust)).toEqual([]);
        expect(out).not.toMatch(
          /<(?:script|style|iframe|svg|math|object|embed|base|meta|form|input|button|textarea|template|noscript|xmp|plaintext)\b/i
        );
        // A real attribute is `name="`; inside an escaped value a quote is `&quot;`.
        expect(out).not.toMatch(/\son[a-z]+="/i);
      }
    });
  }

  it('keeps an https link whose scheme was written with a character reference', () => {
    const { tree } = htmlToMarkdownTree('<a href="https&#58;//example.com/">ok</a>');
    expect(urls(tree)).toEqual(['https://example.com/']);
  });

  it('reads script text as nothing at all, not as visible text', () => {
    const { tree } = htmlToMarkdownTree('a<script>document.write("x")</script>b');
    expect(tree).toEqual(root(p(t('ab'))));
  });
});

describe('hostile trees in, safe HTML out', () => {
  const vectors = [
    'javascript:alert(1)',
    ' JAVASCRIPT:alert(1)',
    'java\tscript:alert(1)',
    'java\nscript:alert(1)',
    'vbscript:x',
    'data:text/html,<script>alert(1)</script>',
    '//evil.example',
    '\\\\evil.example',
    'https://user:pass@evil.example',
    '" onmouseover="alert(1)',
    'javascript&colon;alert(1)',
  ];
  for (const url of vectors) {
    it(`writes no dangerous URL for ${JSON.stringify(url)}`, () => {
      const tree = root(
        p(
          { type: 'link', url, title: '" onclick="x', children: [t('<b>label</b>')] },
          { type: 'image', url, alt: '"><script>alert(1)</script>' }
        )
      );
      for (const trust of ['untrusted', 'developer'] as const) {
        const out = markdownTreeToHtml(tree, { trust }).html;
        expect(unsafeParts(out, trust)).toEqual([]);
        expect(out).not.toMatch(/<script/i);
        expect(out).not.toMatch(/\son[a-z]+="/i);
      }
    });
  }

  it('never writes a raw html node as markup', () => {
    const tree = root(
      { type: 'html', value: '<script>alert(1)</script>' },
      p({ type: 'html', value: '<img src=x onerror=alert(1)>' })
    );
    for (const rawHtml of ['drop', 'escape'] as const) {
      const out = markdownTreeToHtml(tree, { rawHtml }).html;
      expect(unsafeParts(out)).toEqual([]);
      expect(out).not.toMatch(/<script|<img/i);
    }
  });
});

describe('bombs stay bounded and linear', () => {
  const BUDGET_MS = 4000;
  const timed = (input: string) => {
    const started = performance.now();
    const result = htmlToMarkdownTree(input);
    const html = markdownTreeToHtml(result.tree).html;
    return { result, html, ms: performance.now() - started };
  };

  const bombs: Record<string, string> = {
    'nested divs': '<div>'.repeat(200_000),
    'nested inline marks': '<b><i>'.repeat(100_000),
    'nested lists': '<ul><li>'.repeat(100_000),
    'nested blockquotes': '<blockquote>'.repeat(200_000),
    'unclosed comments': '<!--'.repeat(200_000),
    'stray end tags': '</a'.repeat(300_000),
    'bare end-tag openers': '</'.repeat(300_000),
    'unclosed scripts': '<script>'.repeat(100_000),
    'many attributes': `<a ${'x=y '.repeat(200_000)}href="https://example.com">x</a>`,
    'unclosed attribute quote': `<a href="${'a'.repeat(500_000)}`,
    'entity soup': '&#'.repeat(150_000) + '&amp'.repeat(100_000),
    'many cells': `<table><tr>${'<td>x'.repeat(100_000)}`,
    'many items': `<ul>${'<li>x'.repeat(100_000)}`,
    'many breaks': 'x<br>'.repeat(150_000),
    'lone angle brackets': '< '.repeat(400_000),
  };

  for (const [name, input] of Object.entries(bombs)) {
    it(`handles ${name} without throwing, in time`, () => {
      const { html, ms } = timed(input);
      expect(ms).toBeLessThan(BUDGET_MS);
      expect(unsafeParts(html)).toEqual([]);
    });
  }

  it('caps element depth and reports it', () => {
    const { result } = timed(`${'<div>'.repeat(HTML_MAX_ELEMENT_DEPTH + 10)}deep`);
    expect(result.diagnostics.map((d) => d.code)).toContain('depth-limit');
    expect(result.tree).toEqual(root(p(t('deep'))));
  });

  it('flattens deep inline nesting to text and reports it', () => {
    const { result } = timed(`<p>${'<b>'.repeat(40)}deep</p>`);
    expect(result.diagnostics.map((d) => d.code)).toContain('depth-limit');
    expect(JSON.stringify(result.tree)).toContain('"deep"');
  });

  it('cuts the source at the limit', () => {
    const { result } = timed('x'.repeat(1_000_100));
    expect(result.diagnostics.map((d) => d.code)).toContain('source-truncated');
  });
});
