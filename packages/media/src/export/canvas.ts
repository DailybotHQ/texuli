import type { CompositionCanvasTarget } from '../composition-canvas/render.ts';

/** A canvas an exporter can draw on and encode. */
export type ExportCanvas = CompositionCanvasTarget & {
  /** `HTMLCanvasElement.toBlob`. */
  toBlob?: (callback: (blob: Blob | null) => void, type?: string, quality?: number) => void;
  /** `OffscreenCanvas.convertToBlob`. */
  convertToBlob?: (options?: { type?: string; quality?: number }) => Promise<Blob>;
  /** `HTMLCanvasElement.captureStream` (WebM recording). */
  captureStream?: (frameRate?: number) => MediaStream;
};

/** A detached `<canvas>` from `document`, else an `OffscreenCanvas`, else `null`. */
export function createExportCanvas(documentRef?: Document): ExportCanvas | null {
  const doc = documentRef ?? (typeof document === 'undefined' ? undefined : document);
  if (doc) return doc.createElement('canvas') as unknown as ExportCanvas;
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(1, 1) as unknown as ExportCanvas;
  }
  return null;
}

export type EncodeFailure = 'tainted' | 'unsupported' | 'encode-failed';

/**
 * Encodes a canvas as PNG. A canvas tainted by a cross-origin image throws a
 * `SecurityError` on read; that becomes `tainted`, never an exception.
 */
export async function encodeCanvas(
  canvas: ExportCanvas,
  type: string
): Promise<{ ok: true; blob: Blob } | { ok: false; reason: EncodeFailure }> {
  try {
    let blob: Blob | null = null;
    if (typeof canvas.toBlob === 'function') {
      const toBlob = canvas.toBlob.bind(canvas);
      blob = await new Promise<Blob | null>((resolve) => toBlob(resolve, type));
    } else if (typeof canvas.convertToBlob === 'function') {
      blob = await canvas.convertToBlob({ type });
    } else {
      return { ok: false, reason: 'unsupported' };
    }
    return blob && blob.size > 0 ? { ok: true, blob } : { ok: false, reason: 'encode-failed' };
  } catch (error) {
    const name = (error as { name?: unknown } | null)?.name;
    return { ok: false, reason: name === 'SecurityError' ? 'tainted' : 'encode-failed' };
  }
}
