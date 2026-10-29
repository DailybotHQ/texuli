/**
 * @texuli/document/pdf: the owned PDF writer (ADR-016) over the paged
 * layout. Standard 14 fonts with WinAnsi encoding, an optional host
 * TrueType font for other scripts, link annotations through the URL
 * policy, JPEG and PNG images, deterministic bytes. Load it lazily: only
 * an export pays for it.
 */
export {
  type ImageInfo,
  type ImageResolver,
  MAX_IMAGE_BYTES,
  type OutputDiagnostic,
  type OutputDiagnosticCode,
  probeImage,
} from '../output/shared.ts';
export { MAX_IMAGE_PIXELS_BYTES } from './images.ts';
export { PDF_MIME, type PdfOptions, type PdfResult, writePdf } from './pdf.ts';
export { MAX_FONT_BYTES, parseTrueType, type TrueTypeFont } from './truetype.ts';
