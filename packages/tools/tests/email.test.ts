// @vitest-environment node
import { readFileSync } from 'node:fs';
import type { Theme } from '@texuli/tokens/build';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EMAIL_PALETTE,
  EMAIL_BLOCK_TYPES,
  EMAIL_COMPONENT_IDS,
  EMAIL_STYLE_PROPERTIES,
  emailImage,
  emailLink,
  renderEmail,
  resolveEmailPalette,
  serializeEmailStyle,
  toSrgbHex,
} from '../src/email/index.ts';

const text = (markdown: string) => ({
  id: 'blocks-text',
  props: { block: { type: 'text', markdown } },
});
const block = (id: string, value: Record<string, unknown>) => ({ id, props: { block: value } });

const REPORT = {
  id: 'layout-page',
  props: { title: 'Weekly report' },
  children: [
    block('blocks-text', { type: 'heading', level: 2, text: 'Highlights', eyebrow: 'Week 42' }),
    text(
      'Orders grew **12%**; see [the dashboard](https://example.com/dash).\n\n- Shipped faster\n- Fewer returns'
    ),
    block('blocks-text', {
      type: 'callout',
      title: 'Heads up',
      body: 'Inventory is *low* on two SKUs.',
    }),
    block('blocks-text', {
      type: 'quote',
      quote: 'Best week yet.',
      cite: 'Ana Example',
      role: 'Ops',
    }),
    block('blocks-structure', { type: 'divider' }),
    block('blocks-data', {
      type: 'table',
      caption: 'Orders by region',
      columns: [
        { id: 'region', label: 'Region' },
        { id: 'orders', label: 'Orders' },
      ],
      rows: [
        { region: 'North', orders: 120 },
        { region: 'South', orders: 98 },
      ],
    }),
    block('blocks-data', {
      type: 'stat',
      items: [{ label: 'Revenue', value: '$12k', delta: '+4%' }],
    }),
    block('blocks-structure', {
      type: 'cta',
      actions: [
        { label: 'Open the report', href: 'https://example.com/report' },
        { label: 'Reply', href: 'mailto:team@example.com' },
      ],
    }),
    block('blocks-code', { type: 'code', lang: 'ts', code: 'const a = 1 < 2 && "ok";' }),
    block('blocks-media', {
      type: 'image',
      src: 'img/chart.png',
      alt: 'Orders chart',
      width: 1200,
      height: 600,
    }),
    block('blocks-data', {
      type: 'chart',
      kind: 'bar',
      title: 'Orders',
      description: 'Orders per day.',
      series: [{ id: 'o', label: 'Orders', points: [{ x: 'Mon', y: 3 }] }],
    }),
  ],
};

/** Every element name the output uses. */
function tagNames(html: string): Set<string> {
  return new Set([...html.matchAll(/<([a-z][a-z0-9]*)/g)].map((match) => match[1] as string));
}

const EMAIL_SAFE_TAGS = new Set(
  'html head meta title body div p h1 h2 h3 h4 h5 h6 table caption thead tbody tr th td a img strong em del code pre ul ol li blockquote hr br span'.split(
    ' '
  )
);

describe('tools/email: validated blueprint to email-safe HTML', () => {
  it('renders the email subset as tables with inline styles, plus a plain-text part', () => {
    const result = renderEmail(REPORT, {
      preheader: 'Your week in numbers',
      baseUrl: 'https://example.com/assets/',
    });
    expect(result.ok).toBe(true);
    expect(result.html.startsWith('<!doctype html><html lang="en" dir="ltr">')).toBe(true);
    expect(result.html).toContain('<title>Weekly report</title>');
    expect(result.html).toContain('role="presentation"');
    expect(result.html).toContain('<strong>12%</strong>');
    expect(result.html).toContain('href="https://example.com/report"');
    expect(result.html).toContain('href="mailto:team@example.com"');
    expect(result.html).toContain('<th scope="col"');
    expect(result.html).toContain('src="https://example.com/assets/img/chart.png"');
    // Images scale down to the content width (600 - 48) with the same ratio.
    expect(result.html).toContain('width="552" height="276"');
    expect(result.html).toContain('const a = 1 &lt; 2 &amp;&amp; "ok";');
    for (const tag of tagNames(result.html)) expect(EMAIL_SAFE_TAGS.has(tag), tag).toBe(true);
    // The chart has no email form: its text stays and a warning says so.
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'email-unsupported', severity: 'warning', id: 'blocks-data' })
    );
    expect(result.text).toContain('Weekly report\n=============');
    expect(result.text).toContain('Orders grew 12%; see the dashboard (https://example.com/dash).');
    expect(result.text).toContain('Open the report: https://example.com/report');
    expect(result.text).toContain('North | 120');
    expect(result.text.startsWith('Your week in numbers')).toBe(true);
    expect(EMAIL_COMPONENT_IDS).toContain('blocks-text');
    expect(EMAIL_BLOCK_TYPES).toContain('cta');
  });

  it('takes a blueprint envelope, validated at the untrusted tier', () => {
    const envelope = JSON.parse(
      readFileSync('packages/spec/fixtures/golden/report-on-demand.json', 'utf8')
    );
    const result = renderEmail(envelope);
    expect(result.ok).toBe(true);
    expect(result.html).toContain('<h1');
    // An envelope may not raise its own tier: a developer-only id stays refused.
    const raised = renderEmail({
      ...envelope,
      tier: 'developer',
      tree: { id: 'layout-host', props: {} },
    });
    expect(raised.ok).toBe(false);
  });

  it('refuses hostile drafts before mapping: no HTML is produced', () => {
    const hostile = [
      text('<script>alert(1)</script>'),
      text('<style>body{display:none}</style>'),
      text('a </td></table><form action="https://evil.example"> b'),
      text('" onmouseover="alert(1)'),
      text('<img src=x onerror=alert(1)>'),
      text('[x](javascript:alert(1))'),
      block('blocks-structure', {
        type: 'cta',
        actions: [{ label: 'Go', href: 'javascript:alert(1)' }],
      }),
      block('blocks-structure', {
        type: 'cta',
        actions: [{ label: 'Go', href: 'data:text/html,<b>x</b>' }],
      }),
      block('blocks-structure', {
        type: 'cta',
        actions: [{ label: 'Go', href: 'https://bank.example@evil.example' }],
      }),
      { id: 'layout-page', props: { title: 'Hi', style: 'color:red', onclick: 'alert(1)' } },
      { id: 'not-a-component', props: {} },
      '{"id": "blocks-text", "props": {"block": {"type": "text", "markdown": "<iframe src=x>"}}}',
      'not json',
      null,
    ];
    for (const draft of hostile) {
      const result = renderEmail(draft);
      expect(result.ok, JSON.stringify(draft)).toBe(false);
      expect(result.html).toBe('');
      expect(result.text).toBe('');
      expect(result.diagnostics.some((d) => d.severity === 'error')).toBe(true);
    }
  });

  it('escapes every character that could open markup or close an attribute', () => {
    const result = renderEmail(
      // biome-ignore lint/suspicious/noTemplateCurlyInString: a literal `${…}` is the hostile input.
      text('5 < 6 & 7 > 3 "double" \'single\' `code` {{template}} ${expr}')
    );
    expect(result.ok).toBe(true);
    expect(result.html).toContain('5 &lt; 6 &amp; 7 &gt; 3 "double" \'single\'');
    expect(result.html).not.toMatch(
      /<(?:script|style|iframe|object|embed|form|input|link|svg|math|base)\b/i
    );
    expect(result.html).not.toMatch(/\son[a-z]+=/i);
    // Every attribute value is quoted and never broken open.
    expect(result.html).not.toMatch(/="[^"]*"[^\s>/]/);
  });

  it('passes links and images through the untrusted URL policy, absolute https (or mailto) only', () => {
    const base = { base: 'https://example.com/base/' };
    const none = { base: null };
    expect(emailLink('https://example.com/a', none)?.value).toBe('https://example.com/a');
    expect(emailLink('mailto:team@example.com', none)?.value).toBe('mailto:team@example.com');
    expect(emailLink('docs/a', base)?.value).toBe('https://example.com/base/docs/a');
    expect(emailLink('/root', base)?.value).toBe('https://example.com/root');
    for (const refused of [
      'docs/a',
      'http://example.com',
      'javascript:alert(1)',
      ' JaVaScRiPt:alert(1)',
      'vbscript:x',
      'data:text/html,x',
      'https://bank.example@evil.example',
      'https://exa​mple.com',
      '#section',
      'ftp://example.com/file',
    ]) {
      expect(emailLink(refused, none), refused).toBeNull();
    }
    for (const refused of ['//evil.example/x', '\\\\evil.example', '/\\evil.example', '#top']) {
      expect(emailLink(refused, base), refused).toBeNull();
    }
    expect(emailImage('https://example.com/a.png', none)?.value).toBe('https://example.com/a.png');
    expect(emailImage('img/a.png', base)?.value).toBe('https://example.com/base/img/a.png');
    for (const refused of [
      'img/a.png',
      'http://example.com/a.png',
      'data:image/png;base64,AAAA',
      'blob:https://example.com/x',
    ]) {
      expect(emailImage(refused, none), refused).toBeNull();
    }
    // A relative image without a base keeps its alt text and warns; with a base it resolves.
    const draft = block('blocks-media', {
      type: 'image',
      src: 'img/chart.png',
      alt: 'Chart',
      width: 400,
      height: 200,
    });
    const without = renderEmail(draft);
    expect(without.ok).toBe(true);
    expect(without.html).not.toContain('<img');
    expect(without.html).toContain('[Chart]');
    expect(without.diagnostics.map((d) => d.code)).toContain('email-image-refused');
    const withBase = renderEmail(draft, { baseUrl: 'https://example.com/assets/' });
    expect(withBase.html).toContain('src="https://example.com/assets/img/chart.png"');
    // The base itself must be absolute https.
    const badBase = renderEmail(draft, { baseUrl: 'http://example.com/' });
    expect(badBase.diagnostics.map((d) => d.code)).toContain('email-base-refused');
    expect(badBase.html).not.toContain('<img');
  });

  it('resolves theme tokens to concrete sRGB and follows the writing direction', () => {
    expect(toSrgbHex('#ABC')).toBe('#aabbcc');
    expect(toSrgbHex('rgb(255, 0, 10)')).toBe('#ff000a');
    expect(toSrgbHex('oklch(0.628 0.2577 29.23)')).toMatch(/^#[0-9a-f]{6}$/);
    expect(toSrgbHex('oklch(62.8% 0.2577 29.23)')).toBe(toSrgbHex('oklch(0.628 0.2577 29.23)'));
    for (const unresolved of [
      'var(--tx-primary)',
      'color-mix(in oklch, red, blue)',
      'red',
      'url(x)',
      42,
    ]) {
      expect(toSrgbHex(unresolved)).toBeNull();
    }
    const theme = {
      fontFamily: '"Inter", system-ui, sans-serif; color: red',
      light: { primary: { default: 'oklch(0.5 0.2 260)' }, link: { default: 'var(--tx-x)' } },
    } as unknown as Theme;
    const palette = resolveEmailPalette(theme);
    expect(palette.primary).toBe(toSrgbHex('oklch(0.5 0.2 260)'));
    expect(palette.link).toBe(DEFAULT_EMAIL_PALETTE.link);
    const result = renderEmail(
      [
        block('blocks-structure', {
          type: 'cta',
          actions: [{ label: 'Go', href: 'https://example.com' }],
        }),
        block('blocks-text', { type: 'quote', quote: 'Shalom' }),
      ],
      { theme, dir: 'rtl', lang: 'he' }
    );
    expect(result.ok).toBe(true);
    expect(result.html).toContain(`background-color:${palette.primary}`);
    expect(result.html).not.toContain('oklch');
    expect(result.html).not.toContain('var(');
    expect(result.html).not.toContain('color: red');
    expect(result.html).toContain('<html lang="he" dir="rtl">');
    expect(result.html).toContain('text-align:right');
    expect(result.html).toContain('border-right:4px solid');
  });

  it('serializes only allowlisted style properties with checked values', () => {
    expect(serializeEmailStyle({ color: '#112233', padding: '0 0 0 24px', 'font-size': 16 })).toBe(
      'color:#112233;padding:0 0 0 24px;font-size:16px'
    );
    expect(EMAIL_STYLE_PROPERTIES).toContain('background-color');
    const refused: Record<string, string | number>[] = [
      { position: 'fixed' },
      { 'background-image': 'url(https://evil.example)' },
      { color: 'red;background:url(x)' },
      { color: 'expression(alert(1))' },
      { width: '100px;behavior:url(x)' },
      { 'font-family': 'Arial;}</style><script>' },
      { 'font-size': Number.NaN },
      { display: 'flex' },
    ];
    for (const style of refused) {
      expect(() => serializeEmailStyle(style as never), JSON.stringify(style)).toThrow(TypeError);
    }
  });

  it('stays fast on huge and pathological inputs (time bounds)', () => {
    const huge = `{"id":"blocks-text","props":{"block":{"type":"text","markdown":"${'a'.repeat(5_000_000)}"}}}`;
    let start = performance.now();
    expect(renderEmail(huge).ok).toBe(false);
    expect(performance.now() - start).toBeLessThan(1_000);

    const pathological = [
      '['.repeat(3_900),
      '*'.repeat(3_900),
      '`'.repeat(3_900),
      `${'[a]('.repeat(900)}`,
      '> '.repeat(1_900),
      '_*'.repeat(1_900),
    ];
    const children = Array.from({ length: 60 }, (_, index) =>
      text(pathological[index % pathological.length] as string)
    );
    start = performance.now();
    const result = renderEmail({ id: 'layout-doc', props: { title: 'Stress' }, children });
    const elapsed = performance.now() - start;
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(result.ok).toBe(true);
    expect(elapsed).toBeLessThan(3_000);
  });

  it('documents every export', () => {
    const doc = readFileSync('packages/tools/docs/email.md', 'utf8');
    const source = readFileSync('packages/tools/src/email/index.ts', 'utf8');
    const names = [...source.matchAll(/(?:^|\s|\{)(?:type\s+)?([A-Za-z_]\w*),?$/gm)].map(
      (m) => m[1] as string
    );
    expect(names.length).toBeGreaterThan(15);
    expect(names.filter((name) => !doc.includes(`\`${name}`))).toEqual([]);
    const exportsMap = JSON.parse(readFileSync('packages/tools/package.json', 'utf8')).exports;
    expect(exportsMap['./email']).toEqual({
      types: './src/email/index.ts',
      default: './src/email/index.ts',
    });
  });
});
