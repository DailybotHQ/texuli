import { type RenderCompositionOptions, renderComposition } from '../composition-canvas/render.ts';
import type { CompositionIssue } from '../composition-model/index.ts';
import { type CompositionProvenanceEntry, collectCompositionProvenance } from '../provenance.ts';
import {
  createExportCanvas,
  type EncodeFailure,
  type ExportCanvas,
  encodeCanvas,
} from './canvas.ts';
import { EXPORT_MIME_TYPES, exportFilename } from './filename.ts';

export interface ExportPngOptions
  extends Omit<RenderCompositionOptions, 'viewport' | 'imageCache'> {
  /** Download name; sanitized, and `.png` is added. */
  filename?: string;
  /** Document that creates the canvas (and the default image loader). */
  document?: Document;
  /** Canvas factory (tests, workers). Default: a detached `<canvas>`, else `OffscreenCanvas`. */
  createCanvas?: () => ExportCanvas | null;
}

export type ExportPngResult =
  | {
      ok: true;
      blob: Blob;
      filename: string;
      /** Pixel size of the image (composition size × the capped pixel ratio). */
      width: number;
      height: number;
      /** Image sources the URL policy refused (never fetched; their layers are empty). */
      refusedSources: string[];
      /** Image sources that failed to load (their layers are empty). */
      failedSources: string[];
      provenance: CompositionProvenanceEntry[];
    }
  | { ok: false; reason: 'invalid'; errors: readonly CompositionIssue[] }
  | { ok: false; reason: 'aborted' | EncodeFailure };

/**
 * Validates `input`, draws it on an offscreen canvas with the composition
 * canvas renderer (images through the media URL policy) and encodes a PNG
 * with `toBlob`. Untrusted by default; nothing is sent anywhere. Never
 * throws for content.
 */
export async function exportPng(
  input: unknown,
  options: ExportPngOptions = {}
): Promise<ExportPngResult> {
  const { filename, document: documentRef, createCanvas, ...render } = options;
  const canvas = createCanvas ? createCanvas() : createExportCanvas(documentRef);
  if (!canvas) return { ok: false, reason: 'unsupported' };
  const drawn = await renderComposition(canvas, input, render);
  if (!drawn.ok) {
    return drawn.reason === 'invalid'
      ? { ok: false, reason: 'invalid', errors: drawn.errors }
      : { ok: false, reason: drawn.reason };
  }
  if (options.signal?.aborted) return { ok: false, reason: 'aborted' };
  const encoded = await encodeCanvas(canvas, EXPORT_MIME_TYPES.png);
  if (!encoded.ok) return { ok: false, reason: encoded.reason };
  return {
    ok: true,
    blob: encoded.blob,
    filename: exportFilename(filename, 'png'),
    width: canvas.width,
    height: canvas.height,
    refusedSources: drawn.refusedSources,
    failedSources: drawn.failedSources,
    provenance: collectCompositionProvenance(drawn.composition.layers),
  };
}
