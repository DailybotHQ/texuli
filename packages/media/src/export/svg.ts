import type { CompositionIssue } from '../composition-model/index.ts';
import { compositionToSvgString } from '../composition-svg/render.ts';
import { type CompositionProvenanceEntry, collectCompositionProvenance } from '../provenance.ts';
import { EXPORT_MIME_TYPES, exportFilename } from './filename.ts';

export interface ExportSvgOptions {
  /** URL policy tier for validation. Default `untrusted`. */
  trust?: 'developer' | 'untrusted';
  /** The SVG `<title>` (its accessible name). Default `Composition`. */
  title?: string;
  /** The SVG `<desc>`. */
  description?: string;
  /** Download name; sanitized, and `.svg` is added. */
  filename?: string;
}

export type ExportSvgResult =
  | {
      ok: true;
      blob: Blob;
      svg: string;
      filename: string;
      width: number;
      height: number;
      provenance: CompositionProvenanceEntry[];
    }
  | { ok: false; reason: 'invalid'; errors: readonly CompositionIssue[] };

const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>\n';

/**
 * Validates `input` and serializes it as a standalone SVG file. Every text and
 * attribute is escaped by the SVG renderer; image layers keep only sources the
 * media URL policy accepts. Nothing is fetched. Never throws for content.
 */
export function exportSvg(input: unknown, options: ExportSvgOptions = {}): ExportSvgResult {
  const result = compositionToSvgString(input, {
    trust: options.trust === 'developer' ? 'developer' : 'untrusted',
    focusable: false,
    ...(options.title ? { title: options.title } : {}),
    ...(options.description ? { description: options.description } : {}),
  });
  if (!result.ok) return { ok: false, reason: 'invalid', errors: result.errors };
  const svg = `${XML_DECLARATION}${result.svg ?? ''}\n`;
  return {
    ok: true,
    svg,
    blob: new Blob([svg], { type: `${EXPORT_MIME_TYPES.svg};charset=utf-8` }),
    filename: exportFilename(options.filename, 'svg'),
    width: result.composition.width,
    height: result.composition.height,
    provenance: collectCompositionProvenance(result.composition.layers),
  };
}
