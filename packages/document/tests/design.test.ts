// @vitest-environment node
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { type DocumentDesign, writeDocx } from '../src/docx/index.ts';
import { firstFamily, isSerifStack } from '../src/output/design.ts';
import { writePdf } from '../src/pdf/index.ts';
import { everyBlock } from './fixtures.ts';
import { parsePdf, readZip } from './output-helpers.ts';

const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const decoder = new TextDecoder();

/** The default outputs of `everyBlock()` before design values existed (recorded at 7e5211f7). */
const DEFAULT_PDF_SHA = '4038c6fa02753704a946662c0c417a22eb7619bc995e2f9babf1f3609f64f838';
const DEFAULT_DOCX_SHA = 'f9d0e7674aad0e35603594b01418f6060c44b9fdb0ab6019a71dba6cc72a392f';

/** Plain design values, as `designValues(compiled, 'light')` builds them from a compiled design system. */
const ACME: DocumentDesign = {
  colors: {
    background: '#ffffff',
    foreground: '#111827',
    muted: '#f3f4f6',
    mutedForeground: '#4b5563',
    border: '#e5e7eb',
    borderStrong: '#6b7280',
    link: '#4338ca',
    primary: '#4f46e5',
    primarySoft: '#f2f4ff',
    info: '#0871c1',
    infoSoft: '#eef6ff',
    success: '#079455',
    successSoft: '#deffe8',
    warning: '#916600',
    warningSoft: '#fff4e1',
    destructive: '#d92d20',
    destructiveSoft: '#fff2ef',
  },
  fonts: {
    sans: '"Acme Sans", system-ui, sans-serif',
    heading: '"Acme Display", "Acme Sans", system-ui',
    mono: '"Acme Mono", ui-monospace, monospace',
  },
};

/** `#rrggbb` as the writer's `r g b rg` operator. */
const rg = (hex: string) =>
  `${[1, 3, 5]
    .map((i) => String(Math.round((Number.parseInt(hex.slice(i, i + 2), 16) / 255) * 1000) / 1000))
    .join(' ')} rg`;

async function docxFiles(design?: DocumentDesign | null) {
  const result = await writeDocx(everyBlock(), { compress: false, design });
  const files = new Map(readZip(result.bytes).map((entry) => [entry.path, entry.data]));
  const text = (path: string) => decoder.decode(files.get(path));
  return { result, text };
}

describe('document outputs: the default stays byte for byte', () => {
  it('writes the same PDF and DOCX bytes without a design (and with an empty or hostile one)', async () => {
    expect(sha((await writePdf(everyBlock(), { compress: false })).bytes)).toBe(DEFAULT_PDF_SHA);
    // Deflate output depends on the platform's zlib, so the compressed PDF is
    // compared with itself across designs rather than pinned to one hash.
    const compressed = sha((await writePdf(everyBlock())).bytes);
    expect(sha((await writeDocx(everyBlock(), { compress: false })).bytes)).toBe(DEFAULT_DOCX_SHA);
    const hostile: DocumentDesign = {
      colors: { foreground: 'red', link: '#12345', border: 'url(x)', muted: '#00ff00;x' },
      fonts: { sans: '</w:rFonts><script>', mono: 'monospace', heading: 'x'.repeat(500) },
    };
    for (const design of [null, {}, hostile]) {
      expect(sha((await writePdf(everyBlock(), { compress: false, design })).bytes)).toBe(
        DEFAULT_PDF_SHA
      );
      expect(sha((await writeDocx(everyBlock(), { compress: false, design })).bytes)).toBe(
        DEFAULT_DOCX_SHA
      );
      expect(sha((await writePdf(everyBlock(), { design })).bytes)).toBe(compressed);
    }
  });
});

describe('pdf: design values', () => {
  it('draws text, links, rules, code and callouts in the design colors', async () => {
    const result = await writePdf(everyBlock(), { compress: false, design: ACME });
    const content = parsePdf(result.bytes).contents.join('\n');
    const colors = ACME.colors as Record<string, string>;
    for (const role of ['foreground', 'link', 'border', 'muted', 'mutedForeground'])
      expect(content, role).toContain(rg(colors[role] as string));
    // At least one callout tone paints its soft fill and its bar.
    const tones = ['primary', 'info', 'success', 'warning', 'destructive'];
    expect(tones.some((tone) => content.includes(rg(colors[`${tone}Soft`] as string)))).toBe(true);
    // A white background paints no page fill; Helvetica stays the face for a sans stack.
    expect(content).not.toMatch(/^1 1 1 rg 0 0 /m);
    expect(parsePdf(result.bytes).raw).toContain('/BaseFont /Helvetica ');
  });

  it('fills the page for a non-white background (a dark design)', async () => {
    const dark: DocumentDesign = { colors: { background: '#111827', foreground: '#f9fafb' } };
    const result = await writePdf(everyBlock(), { compress: false, design: dark });
    const pdf = parsePdf(result.bytes);
    for (const page of pdf.contents) expect(page.startsWith(`${rg('#111827')} 0 0 `)).toBe(true);
    expect(pdf.contents[0]).toContain(rg('#f9fafb'));
  });

  it('sets a serif body stack in Times (metrics loaded on use), keeping Courier for code', async () => {
    const serif: DocumentDesign = { fonts: { sans: '"Example Serif", Georgia, serif' } };
    const result = await writePdf(everyBlock(), { compress: false, design: serif });
    const raw = parsePdf(result.bytes).raw;
    for (const face of ['Times-Roman', 'Times-Bold', 'Times-Italic', 'Times-BoldItalic', 'Courier'])
      expect(raw).toContain(`/BaseFont /${face} `);
    expect(raw).not.toContain('/BaseFont /Helvetica');
    // Times is narrower than Helvetica: the same text needs no more pages.
    const plain = await writePdf(everyBlock(), { compress: false });
    expect(result.pageCount).toBeLessThanOrEqual(plain.pageCount);
  });

  it('classifies stacks and picks the first concrete family', () => {
    expect(isSerifStack('"Example Serif", Georgia, serif')).toBe(true);
    expect(isSerifStack('ui-serif, Georgia')).toBe(true);
    expect(isSerifStack('"Acme Sans", system-ui, sans-serif')).toBe(false);
    expect(isSerifStack('system-ui, Georgia')).toBe(false);
    expect(isSerifStack(42)).toBe(false);
    expect(firstFamily('system-ui, "Acme Sans", sans-serif')).toBe('Acme Sans');
    expect(firstFamily('monospace')).toBeUndefined();
    expect(firstFamily('<x>, var(--a)')).toBeUndefined();
  });
});

describe('docx: design values', () => {
  it('writes the design fonts, text, link, rule, code and callout colors', async () => {
    const { text } = await docxFiles(ACME);
    const styles = text('word/styles.xml');
    expect(styles).toContain(
      '<w:rFonts w:ascii="Acme Sans" w:hAnsi="Acme Sans" w:eastAsia="Acme Sans" w:cs="Acme Sans"/>'
    );
    expect(styles).toContain('<w:color w:val="111827"/>');
    // Headings take the heading family, code the mono family and the muted fill.
    expect(styles).toContain('w:ascii="Acme Display"');
    expect(styles).toContain(
      '<w:rFonts w:ascii="Acme Mono" w:hAnsi="Acme Mono" w:cs="Acme Mono"/>'
    );
    expect(styles).toContain('w:fill="F3F4F6"');
    expect(styles).toContain('<w:color w:val="4338CA"/>');
    expect(styles).toContain('w:color="E5E7EB"');
    expect(styles).not.toContain('Calibri');
    expect(styles).not.toContain('BFBFBF');
    const body = text('word/document.xml');
    const tones = ['primary', 'info', 'success', 'warning', 'destructive'];
    const colors = ACME.colors as Record<string, string>;
    expect(
      tones.some((tone) =>
        body.includes(`w:fill="${(colors[`${tone}Soft`] as string).slice(1).toUpperCase()}"`)
      )
    ).toBe(true);
  });
});
