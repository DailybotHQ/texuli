/**
 * @texuli/core/zip: a deterministic ZIP writer (stored, or deflated through
 * the platform `CompressionStream`) and CRC-32 (ADR-016).
 */
export {
  assertZipPath,
  type CompressionFormatName,
  canCompress,
  compressBytes,
  crc32,
  writeZip,
  writeZipAsync,
  type ZipEntry,
  type ZipOptions,
} from './zip.ts';
