/**
 * Export a document as Markdown, DOCX or PDF (ADR-011, ADR-016). Each
 * format's writer loads on first use (`@texuli/document/markdown`,
 * `docx` and `pdf`), so a page that never exports never pays for them.
 * Results are `Blob`s; `downloadBlob` saves one through a `blob:` URL it
 * creates and revokes itself, so an export never navigates anywhere else.
 */
import type { DocxOptions } from '@texuli/document/docx';
import type { MarkdownExportOptions } from '@texuli/document/markdown';
import type { TexuliDocument } from '@texuli/document/model';
import type { OutputDiagnostic, PdfOptions } from '@texuli/document/pdf';

export type ExportFormat = 'markdown' | 'docx' | 'pdf';

export const EXPORT_FORMATS: readonly ExportFormat[] = Object.freeze(['markdown', 'docx', 'pdf']);

export const EXPORT_TYPES: Readonly<Record<ExportFormat, { extension: string; mime: string }>> =
  Object.freeze({
    markdown: { extension: 'md', mime: 'text/markdown;charset=utf-8' },
    docx: {
      extension: 'docx',
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    },
    pdf: { extension: 'pdf', mime: 'application/pdf' },
  });

export interface ExportOptions {
  /** The file name without extension (default: from the document title). */
  filename?: string;
  markdown?: MarkdownExportOptions;
  docx?: DocxOptions;
  pdf?: PdfOptions;
}

export interface ExportResult {
  format: ExportFormat;
  blob: Blob;
  /** A safe file name with the format's extension. */
  filename: string;
  /** PDF only. */
  pageCount?: number;
  /** What the writer degraded (unresolved images, refused links, embeds as text…). */
  diagnostics: OutputDiagnostic[];
}

/**
 * A file name from a title: letters and digits of any script, `-` and `_`,
 * spaces and other characters collapsed to `-`, at most 80 characters, and
 * never empty, hidden or a reserved device name.
 */
export function exportFileName(title: string, format: ExportFormat): string {
  const base =
    String(title ?? '')
      .normalize('NFC')
      .replace(/[^\p{L}\p{N}_-]+/gu, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^[-_]+|[-_]+$/g, '')
      .slice(0, 80)
      .replace(/[-_]+$/g, '') || 'document';
  const safe = /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(base) ? `${base}-document` : base;
  return `${safe}.${EXPORT_TYPES[format].extension}`;
}

/** Export a document to a `Blob` in one format, loading its writer on first use. */
export async function exportDocument(
  doc: TexuliDocument,
  format: ExportFormat,
  options: ExportOptions = {}
): Promise<ExportResult> {
  const filename = exportFileName(options.filename ?? doc.meta.title, format);
  const type = EXPORT_TYPES[format].mime;
  if (format === 'markdown') {
    const { documentToMarkdown } = await import('@texuli/document/markdown');
    const text = documentToMarkdown(doc, options.markdown);
    return { format, blob: new Blob([text], { type }), filename, diagnostics: [] };
  }
  if (format === 'docx') {
    const { writeDocx } = await import('@texuli/document/docx');
    const result = await writeDocx(doc, options.docx);
    return {
      format,
      blob: new Blob([result.bytes as Uint8Array<ArrayBuffer>], { type }),
      filename,
      diagnostics: result.diagnostics,
    };
  }
  if (format === 'pdf') {
    const { writePdf } = await import('@texuli/document/pdf');
    const result = await writePdf(doc, options.pdf);
    return {
      format,
      blob: new Blob([result.bytes as Uint8Array<ArrayBuffer>], { type }),
      filename,
      pageCount: result.pageCount,
      diagnostics: result.diagnostics,
    };
  }
  throw new TypeError(`Unknown export format: ${String(format)}`);
}

/**
 * Save a blob as a download: a `blob:` URL created here, an `<a download>`
 * clicked and removed, and the URL revoked. Nothing else is ever navigated
 * to. The file name is cleaned again.
 */
export function downloadBlob(
  blob: Blob,
  filename: string,
  owner: Document = globalThis.document
): void {
  const view = owner.defaultView;
  if (!view) throw new Error('downloadBlob needs a browser document.');
  const dot = filename.lastIndexOf('.');
  const extension =
    dot > 0
      ? filename
          .slice(dot + 1)
          .replace(/[^A-Za-z0-9]/g, '')
          .slice(0, 8)
      : '';
  const stem = dot > 0 ? filename.slice(0, dot) : filename;
  const clean = `${exportFileName(stem, 'markdown').replace(/\.md$/, '')}${extension ? `.${extension}` : ''}`;
  const url = view.URL.createObjectURL(blob);
  const link = owner.createElement('a');
  link.href = url;
  link.download = clean;
  link.rel = 'noopener';
  link.hidden = true;
  owner.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    view.setTimeout(() => view.URL.revokeObjectURL(url), 0);
  }
}
