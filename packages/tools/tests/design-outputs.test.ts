// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { compileDesignSystem, resolveDesignSystem } from '@texuli/tokens/design-system/compile';
import { beforeAll, describe, expect, it } from 'vitest';
import { renderEmail, toSrgbHex } from '../src/email/index.ts';
import { designValues, renderBlueprintPdf } from '../src/print/index.ts';

const sha = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const block = (id: string, value: Record<string, unknown>) => ({ id, props: { block: value } });

const DRAFT = {
  id: 'layout-page',
  props: { title: 'Weekly report' },
  children: [
    block('blocks-text', { type: 'heading', level: 2, text: 'Highlights' }),
    {
      id: 'blocks-text',
      props: {
        block: {
          type: 'text',
          markdown: 'Orders grew **12%**; see [the dashboard](https://example.com/dash) and `x`.',
        },
      },
    },
    block('blocks-text', { type: 'callout', title: 'Heads up', body: 'Inventory is low.' }),
    block('blocks-structure', { type: 'divider' }),
    block('blocks-data', {
      type: 'table',
      columns: [
        { id: 'r', label: 'Region' },
        { id: 'n', label: 'Orders' },
      ],
      rows: [{ r: 'North', n: 12 }],
    }),
    block('blocks-structure', {
      type: 'cta',
      actions: [{ label: 'Open the report', href: 'https://example.com/report' }],
    }),
    block('blocks-code', { type: 'code', lang: 'ts', code: 'const a = 1;' }),
  ],
};

/** The default outputs before design systems existed (recorded at 7e5211f7). */
const DEFAULT_EMAIL_SHA = '750bbdb9aee22ed1a1e2e05164e947532790193a7c0de21b70e46179134a24b2';
const DEFAULT_PRINT_PDF_SHA = 'ba957b4e39754a605441003638c3297f42d3574932f913e36ee7752bf8641bb3';

type Compiled = { vars: Record<'light' | 'dark', Record<string, string>> };
let acme: Compiled;

beforeAll(async () => {
  const doc = JSON.parse(readFileSync('packages/spec/fixtures/design-systems/acme.json', 'utf8'));
  const resolved = await resolveDesignSystem(doc, { trust: 'developer' });
  if (!resolved.ok) throw new Error(JSON.stringify(resolved.errors));
  const compiled = compileDesignSystem(resolved.document);
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.errors));
  acme = compiled as unknown as Compiled;
});

describe('designValues: a compiled design system as plain values', () => {
  it('resolves colors to sRGB, keeps font stacks and turns radius and space into pixels', () => {
    const light = designValues(acme, 'light');
    const dark = designValues(acme, 'dark');
    expect(light?.mode).toBe('light');
    expect(light?.colors.background).toBe('#ffffff');
    expect(light?.colors.foreground).toBe('#111827');
    expect(light?.colors.primary).toBe('#4f46e5');
    expect(light?.colors.link).toBe('#4338ca');
    expect(light?.colors.chart4).toBe(acme.vars.light['--tx-chart-4']);
    expect(light?.fonts).toEqual({
      sans: acme.vars.light['--tx-font-sans'],
      heading: acme.vars.light['--tx-font-heading'],
      mono: acme.vars.light['--tx-font-mono'],
    });
    expect(light?.radius).toBe(8);
    expect(light?.space).toBe(4);
    // The dark primary is an oklch() pin: resolved through the gamut-mapped converter.
    expect(acme.vars.dark['--tx-primary']).toMatch(/^oklch\(/);
    expect(dark?.colors.primary).toBe(toSrgbHex(acme.vars.dark['--tx-primary']));
    expect(dark?.colors.background).toBe('#111827');
    for (const value of Object.values(dark?.colors ?? {})) expect(value).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('is null for a missing mode and skips values that do not resolve (never throws)', () => {
    expect(designValues(null)).toBeNull();
    expect(designValues({ vars: { light: {} } }, 'dark')).toBeNull();
    const hostile = designValues({
      vars: {
        light: {
          '--tx-primary': 'var(--x)',
          '--tx-link': 'url(javascript:alert(1))',
          '--tx-radius': 'calc(1px + 1px)',
          '--tx-space-1': '-4px',
          '--tx-font-sans': 'x'.repeat(500),
        },
      },
    });
    expect(hostile).toEqual({ mode: 'light', colors: {}, fonts: {} });
  });
});

describe('email with a design system', () => {
  it('keeps the default output byte for byte without a design system', () => {
    const plain = renderEmail(DRAFT);
    expect(plain.ok).toBe(true);
    expect(sha(plain.html)).toBe(DEFAULT_EMAIL_SHA);
    expect(renderEmail(DRAFT, { designSystem: null }).html).toBe(plain.html);
  });

  it('paints colors, fonts, radius and spacing from the compiled light mode', () => {
    const light = designValues(acme, 'light');
    const result = renderEmail(DRAFT, { designSystem: acme });
    expect(result.ok).toBe(true);
    const html = result.html;
    expect(html).toContain(`background-color:${light?.colors.surface}`);
    expect(html).toContain(`color:${light?.colors.foreground}`);
    expect(html).toContain(`color:${light?.colors.link}`);
    expect(html).toContain(`background-color:${light?.colors.primary}`);
    // Quotes are escaped inside the style attribute.
    expect(html).toContain(
      'font-family:&quot;Acme Sans&quot;, system-ui, sans-serif, Arial, Helvetica'
    );
    expect(html).toContain(
      'font-family:&quot;Acme Display&quot;, &quot;Acme Sans&quot;, system-ui'
    );
    expect(html).toContain(
      'font-family:&quot;Acme Mono&quot;, ui-monospace, monospace, Courier New'
    );
    // Radius 8 px for the card, three quarters for the button; spacing from the 4 px step.
    expect(html).toContain('border-radius:8px');
    expect(html).toContain('border-radius:6px');
    expect(html).toContain('padding:24px');
  });

  it('scales radius and spacing with the design (bounded)', () => {
    const roomy = {
      vars: {
        light: { ...acme.vars.light, '--tx-radius': '1rem', '--tx-space-1': '0.375rem' },
      },
    };
    const html = renderEmail(DRAFT, { designSystem: roomy }).html;
    expect(html).toContain('border-radius:16px');
    expect(html).toContain('border-radius:12px');
    expect(html).toContain('padding:36px');
    expect(html).toContain('padding:18px 30px');
    const huge = {
      vars: { light: { ...acme.vars.light, '--tx-radius': '400px', '--tx-space-1': '90px' } },
    };
    const capped = renderEmail(DRAFT, { designSystem: huge }).html;
    expect(capped).toContain('border-radius:32px');
    expect(capped).toContain('padding:48px');
  });

  it('adds a typed prefers-color-scheme dark rule from the compiled dark mode', () => {
    const dark = designValues(acme, 'dark');
    const light = designValues(acme, 'light');
    const { html } = renderEmail(DRAFT, { designSystem: acme });
    expect(html).toContain('<meta name="color-scheme" content="light dark">');
    expect(html).toContain('<meta name="supported-color-schemes" content="light dark">');
    const rule = /<style>(.*?)<\/style>/s.exec(html)?.[1] ?? '';
    expect(rule.startsWith('@media (prefers-color-scheme: dark){')).toBe(true);
    expect(rule).toContain(`background-color:${dark?.colors.background}!important`);
    expect(rule).toContain(`color:${dark?.colors.foreground}!important`);
    // Every selector is a generated class carried by the painted elements.
    const classes = [...rule.matchAll(/\.(tx-[a-z]+-[0-9a-f]{6})\{/g)].map((m) => m[1]);
    expect(classes.length).toBeGreaterThan(4);
    for (const name of classes) expect(html).toContain(name as string);
    expect(html).toContain(`class="tx-bg-${light?.colors.surface?.slice(1)}"`);
    // Only hex values, class names and the fixed grammar: nothing from content.
    expect(rule).toMatch(
      /^@media \(prefers-color-scheme: dark\)\{(?:\.tx-[a-z]+-[0-9a-f]{6}\{[a-z-]+:#[0-9a-f]{6}!important\})+\}$/
    );
    // A compiled light-only system, or an inline dark mode, has no dark rule.
    expect(
      renderEmail(DRAFT, { designSystem: { vars: { light: acme.vars.light } } }).html
    ).not.toContain('<style>');
    const inlineDark = renderEmail(DRAFT, { designSystem: acme, mode: 'dark' }).html;
    expect(inlineDark).not.toContain('<style>');
    expect(inlineDark).toContain(`background-color:${dark?.colors.surface}`);
  });

  it('never lets a hostile font or color through the email style grammar', () => {
    const hostile = {
      vars: {
        light: {
          '--tx-font-sans': 'Arial;}</style><script>alert(1)</script>',
          '--tx-background': 'red;background:url(x)',
          '--tx-font-mono': '"Evil"); color: red',
        },
        dark: { '--tx-background': '#000000;}</style>' },
      },
    };
    const result = renderEmail(DRAFT, { designSystem: hostile });
    expect(result.ok).toBe(true);
    expect(result.html).not.toContain('<script');
    expect(result.html).not.toContain('url(');
    expect(result.html.match(/<\/style>/g)?.length ?? 0).toBeLessThanOrEqual(1);
  });
});

describe('print with a design system', () => {
  it('keeps the default PDF byte for byte without a design system', async () => {
    const plain = await renderBlueprintPdf(DRAFT, { pdf: { compress: false } });
    expect(plain.ok).toBe(true);
    expect(sha(plain.bytes as Uint8Array)).toBe(DEFAULT_PRINT_PDF_SHA);
  });

  it('passes the compiled design through to the PDF writer', async () => {
    const plain = await renderBlueprintPdf(DRAFT, { pdf: { compress: false } });
    const themed = await renderBlueprintPdf(DRAFT, {
      designSystem: acme,
      pdf: { compress: false },
    });
    expect(themed.ok).toBe(true);
    const raw = new TextDecoder('latin1').decode(themed.bytes as Uint8Array);
    // #111827 as PDF rgb: 17/255, 24/255, 39/255.
    expect(raw).toContain('0.067 0.094 0.153 rg');
    expect(sha(themed.bytes as Uint8Array)).not.toBe(sha(plain.bytes as Uint8Array));
    const dark = await renderBlueprintPdf(DRAFT, {
      designSystem: acme,
      mode: 'dark',
      pdf: { compress: false },
    });
    expect(new TextDecoder('latin1').decode(dark.bytes as Uint8Array)).toContain(
      '0.976 0.98 0.984 rg'
    );
  });
});
