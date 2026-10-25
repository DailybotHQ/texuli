/**
 * `@texuli/media/export` (T-media-export): export compositions as PNG or SVG
 * and composition animations as WebM, in the browser, with no network.
 * Inputs are validated (untrusted by default) and image sources pass the
 * media URL policy before anything is drawn or fetched. Each exporter loads
 * on its first call, with only the renderer it needs. The keyboard-operable
 * control is `@texuli/media/export/ui`.
 */
import type { ExportPngOptions, ExportPngResult } from './png.ts';
import type { ExportQueueItem, ExportQueueOptions, ExportQueueResult } from './queue.ts';
import type { ExportSvgOptions, ExportSvgResult } from './svg.ts';
import type { ExportWebmOptions, ExportWebmResult } from './webm.ts';

export {
  createExportCanvas,
  type EncodeFailure,
  type ExportCanvas,
  encodeCanvas,
} from './canvas.ts';
export { downloadBlob } from './download.ts';
export { EXPORT_MIME_TYPES, type ExportFormat, exportFilename } from './filename.ts';
export type { ExportPngOptions, ExportPngResult } from './png.ts';
export type {
  ExportQueueItem,
  ExportQueueItemResult,
  ExportQueueOptions,
  ExportQueueProgress,
  ExportQueueReceipt,
  ExportQueueResult,
  ExportQueueStatus,
} from './queue.ts';
export type { ExportSvgOptions, ExportSvgResult } from './svg.ts';
export type { ExportWebmOptions, ExportWebmResult } from './webm.ts';
export {
  browserWebmFrameClock,
  canExportWebm,
  pickWebmMimeType,
  type RecorderConstructor,
  type RecorderLike,
  WEBM_EXPORT_MIME_TYPE,
  WEBM_LIMITS,
  type WebmFrameClock,
  webmFrameTimes,
} from './webm-support.ts';

/** Validates `input` and makes a standalone SVG file (see `svg.ts`). */
export async function exportSvg(
  input: unknown,
  options?: ExportSvgOptions
): Promise<ExportSvgResult> {
  return (await import('./svg.ts')).exportSvg(input, options);
}

/** Validates `input`, draws it on a canvas and encodes a PNG (see `png.ts`). */
export async function exportPng(
  input: unknown,
  options?: ExportPngOptions
): Promise<ExportPngResult> {
  return (await import('./png.ts')).exportPng(input, options);
}

/** Validates both documents and records the animation as WebM (see `webm.ts`). */
export async function exportWebm(
  composition: unknown,
  animation: unknown,
  options?: ExportWebmOptions
): Promise<ExportWebmResult> {
  return (await import('./webm.ts')).exportWebm(composition, animation, options);
}

/** Execute several independent exports sequentially with per-item receipts. */
export async function exportQueue(
  items: readonly ExportQueueItem[],
  options?: ExportQueueOptions
): Promise<ExportQueueResult> {
  return (await import('./queue.ts')).exportQueue(items, options);
}
