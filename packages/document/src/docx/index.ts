/**
 * @texuli/document/docx: the owned DOCX (WordprocessingML) writer
 * (ADR-016), on the escaped `@texuli/core/markup` builders and the
 * `@texuli/core/zip` writer. Load it lazily: only an export pays for it.
 */
export {
  type ImageInfo,
  type ImageResolver,
  MAX_IMAGE_BYTES,
  type OutputDiagnostic,
  type OutputDiagnosticCode,
  probeImage,
} from '../output/shared.ts';
export { DOCX_MIME, type DocxOptions, type DocxResult, writeDocx } from './docx.ts';
