// @vitest-environment node
import { readFileSync } from 'node:fs';
import { documentPlainText } from '@texuli/document/model';
import { describe, expect, it } from 'vitest';
import { blueprintToDocument, renderBlueprintPdf } from '../src/print/index.ts';

const block = (id: string, value: Record<string, unknown>) => ({ id, props: { block: value } });

const BRIEF = {
  id: 'layout-doc',
  props: { title: 'Quarterly brief' },
  children: [
    block('blocks-text', { type: 'heading', level: 2, text: 'Summary' }),
    block('blocks-text', {
      type: 'text',
      markdown: 'Revenue grew **8%**. See [the plan](https://example.com/plan).',
    }),
    block('blocks-text', {
      type: 'list',
      items: [{ text: 'Hire two engineers' }, { text: 'Ship the beta' }],
    }),
    block('blocks-text', { type: 'callout', title: 'Risk', body: 'Supplier delays.' }),
    block('blocks-structure', { type: 'divider' }),
    block('blocks-code', { type: 'code', lang: 'ts', code: 'const total = 1 + 2;' }),
    block('blocks-structure', {
      type: 'cta',
      actions: [{ label: 'Open [the] report', href: 'https://example.com/report' }],
    }),
    block('blocks-data', {
      type: 'table',
      caption: 'Regions',
      columns: [
        { id: 'r', label: 'Region' },
        { id: 'n', label: 'Orders' },
      ],
      rows: [{ r: 'North', n: 12 }],
    }),
    block('blocks-data', { type: 'stat', items: [{ label: 'NPS', value: '61', delta: '+3' }] }),
    block('blocks-media', {
      type: 'image',
      src: 'img/chart.png',
      alt: 'Chart',
      width: 400,
      height: 200,
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

describe('tools/print: blueprints to documents and PDF', () => {
  it('maps a validated blueprint to a valid document, sink-free', () => {
    const result = blueprintToDocument(BRIEF, { locale: 'en' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const doc = result.document;
    expect(doc.meta.title).toBe('Quarterly brief');
    const types = doc.blocks.map((b) => (b.type === 'block' ? `block:${b.block}` : b.type));
    expect(types).toEqual([
      'heading',
      'heading',
      'paragraph',
      'list',
      'callout',
      'divider',
      'code',
      'paragraph',
      'block:table',
      'block:table',
      'media',
      'paragraph',
    ]);
    const text = documentPlainText(doc);
    expect(text).toContain('Revenue grew 8%.');
    // A label with Markdown syntax stays literal text.
    expect(text).toContain('Open [the] report');
    // Ids are unique across the codec calls.
    const ids = JSON.stringify(doc).match(/"id":"p[0-9a-z]+"/g) ?? [];
    expect(new Set(ids).size).toBe(ids.length);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'print-unsupported', id: 'blocks-data' })
    );
  });

  it('refuses hostile drafts before mapping', () => {
    for (const draft of [
      block('blocks-text', { type: 'text', markdown: '<script>alert(1)</script>' }),
      block('blocks-structure', {
        type: 'cta',
        actions: [{ label: 'x', href: 'javascript:alert(1)' }],
      }),
      { id: 'layout-host', props: {} },
      'not json',
    ]) {
      const result = blueprintToDocument(draft);
      expect(result.ok, JSON.stringify(draft)).toBe(false);
      expect(result.document).toBeNull();
    }
  });

  it('writes a deterministic PDF with no script, form or embedded file', async () => {
    const first = await renderBlueprintPdf(BRIEF, { pdf: { compress: false } });
    const second = await renderBlueprintPdf(BRIEF, { pdf: { compress: false } });
    expect(first.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.mime).toBe('application/pdf');
    expect(first.pageCount).toBeGreaterThanOrEqual(1);
    const latin = new TextDecoder('latin1').decode(first.bytes);
    expect(latin.startsWith('%PDF-1.7')).toBe(true);
    for (const forbidden of ['/JavaScript', '/JS', '/AcroForm', '/EmbeddedFile', '/Launch']) {
      expect(latin).not.toContain(forbidden);
    }
    expect(Buffer.from(first.bytes).equals(Buffer.from(second.bytes))).toBe(true);
    const refused = await renderBlueprintPdf('not json');
    expect(refused).toMatchObject({ ok: false, bytes: null, pageCount: 0 });
  });

  it('stays fast on large drafts (time bound)', async () => {
    const children = Array.from({ length: 60 }, (_, index) =>
      block('blocks-text', { type: 'text', markdown: `${'[x]('.repeat(400)} paragraph ${index}` })
    );
    const start = performance.now();
    const result = await renderBlueprintPdf({
      id: 'layout-doc',
      props: { title: 'Big' },
      children,
    });
    expect(result.ok).toBe(true);
    expect(performance.now() - start).toBeLessThan(5_000);
  });

  it('documents every export', () => {
    const doc = readFileSync('packages/tools/docs/print.md', 'utf8');
    for (const name of [
      'blueprintToDocument',
      'renderBlueprintPdf',
      'BlueprintDocumentOptions',
      'BlueprintDocumentResult',
      'BlueprintPdfOptions',
      'BlueprintPdfResult',
      'PrintDiagnostic',
    ]) {
      expect(doc).toContain(`\`${name}`);
    }
    const exportsMap = JSON.parse(readFileSync('packages/tools/package.json', 'utf8')).exports;
    expect(exportsMap['./print']).toEqual({
      types: './src/print/index.ts',
      default: './src/print/index.ts',
    });
  });
});
