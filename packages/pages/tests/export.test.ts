import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  downloadBlob,
  EXPORT_FORMATS,
  EXPORT_TYPES,
  exportDocument,
  exportFileName,
} from '../src/export/index.ts';
import { doc, para, samplePage } from './fixtures.ts';

const bytes = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer());

describe('export', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exports Markdown, DOCX and PDF blobs with their types and safe file names', async () => {
    const page = samplePage();
    const markdown = await exportDocument(page, 'markdown');
    expect(markdown.blob.type).toBe('text/markdown;charset=utf-8');
    expect(await markdown.blob.text()).toContain('# Field notes');
    expect(markdown.filename).toBe('Field-notes.md');

    const docx = await exportDocument(page, 'docx', { filename: 'Q3 report' });
    expect(docx.blob.type).toBe(EXPORT_TYPES.docx.mime);
    expect(docx.filename).toBe('Q3-report.docx');
    expect([...(await bytes(docx.blob)).slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);

    const pdf = await exportDocument(page, 'pdf');
    expect(pdf.blob.type).toBe('application/pdf');
    expect(new TextDecoder().decode((await bytes(pdf.blob)).slice(0, 8))).toBe('%PDF-1.7');
    expect(pdf.pageCount).toBeGreaterThanOrEqual(1);
    expect(EXPORT_FORMATS).toEqual(['markdown', 'docx', 'pdf']);
    await expect(exportDocument(page, 'html' as never)).rejects.toThrow(TypeError);
  });

  it('makes file names safe from any title', () => {
    expect(exportFileName('Release notes: v2 / final?', 'pdf')).toBe('Release-notes-v2-final.pdf');
    expect(exportFileName('../../etc/passwd', 'docx')).toBe('etc-passwd.docx');
    expect(exportFileName('', 'markdown')).toBe('document.md');
    expect(exportFileName('...', 'pdf')).toBe('document.pdf');
    expect(exportFileName('CON', 'pdf')).toBe('CON-document.pdf');
    expect(exportFileName('Título 日本', 'pdf')).toBe('Título-日本.pdf');
    expect(exportFileName('x'.repeat(500), 'pdf')).toHaveLength(84);
    expect(exportFileName('a‮exe.pdf', 'docx')).toBe('a-exe-pdf.docx');
  });

  it('downloads through a blob URL it creates and revokes, and nothing else', async () => {
    const created: string[] = [];
    const revoked: string[] = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      created.push('blob:https://example.com/1');
      return 'blob:https://example.com/1';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url) => revoked.push(url));
    const clicks: { href: string; download: string }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      clicks.push({ href: this.getAttribute('href') ?? '', download: this.download });
    });
    const result = await exportDocument(doc([para('p', 'Hi')], '<script>'), 'markdown');
    downloadBlob(result.blob, '../evil name.md');
    expect(clicks).toEqual([{ href: 'blob:https://example.com/1', download: 'evil-name.md' }]);
    expect(document.querySelector('a[download]')).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(revoked).toEqual(created);
  });
});
