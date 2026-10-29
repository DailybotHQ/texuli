/**
 * Image XObjects for the PDF writer. JPEG passes through (`DCTDecode`).
 * PNG passes through (`FlateDecode` with the PNG predictor) for grayscale,
 * RGB and palette images; PNGs with an alpha channel (8-bit) are inflated
 * through the platform `DecompressionStream`, split into color and a soft
 * mask, and deflated again. Interlaced PNGs and PNGs over the pixel cap
 * are refused with a diagnostic, and the alt text is printed instead.
 */
import { compressBytes } from '@texuli/core/zip';
import type { LoadedImage } from '../output/shared.ts';

export interface PdfImageStream {
  /** The dictionary entries, without `/Length`. */
  dict: string;
  data: Uint8Array;
}

export interface PdfImage {
  width: number;
  height: number;
  image: PdfImageStream;
  /** The alpha channel as a soft mask. */
  smask?: PdfImageStream;
}

/** Decoded pixel bytes an alpha PNG may expand to (64 MiB). */
export const MAX_IMAGE_PIXELS_BYTES = 64 * 1024 * 1024;

const hex = (bytes: Uint8Array) => {
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
};

interface PngChunks {
  idat: Uint8Array;
  palette: Uint8Array | null;
}

function pngChunks(bytes: Uint8Array): PngChunks | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const parts: Uint8Array[] = [];
  let palette: Uint8Array | null = null;
  let total = 0;
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(
      bytes[offset + 4] as number,
      bytes[offset + 5] as number,
      bytes[offset + 6] as number,
      bytes[offset + 7] as number
    );
    const start = offset + 8;
    if (start + length + 4 > bytes.length) return null;
    if (type === 'IDAT') {
      parts.push(bytes.subarray(start, start + length));
      total += length;
    } else if (type === 'PLTE') palette = bytes.subarray(start, start + length);
    else if (type === 'IEND') break;
    offset = start + length + 4;
  }
  if (total === 0) return null;
  const idat = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    idat.set(part, at);
    at += part.length;
  }
  return { idat, palette };
}

interface StreamPair {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
}

/** Inflate a zlib stream, stopping (null) once it passes `cap` bytes. */
async function inflate(data: Uint8Array, cap: number): Promise<Uint8Array | null> {
  const Ctor = (globalThis as { DecompressionStream?: new (format: string) => StreamPair })
    .DecompressionStream;
  if (typeof Ctor !== 'function') return null;
  const stream = new Ctor('deflate');
  const writer = stream.writable.getWriter();
  writer.write(data).catch(() => {});
  writer.close().catch(() => {});
  const reader = stream.readable.getReader();
  const out = new Uint8Array(cap);
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (total + value.length > cap) {
        await reader.cancel();
        return null;
      }
      out.set(value, total);
      total += value.length;
    }
  } catch {
    return null;
  }
  return out.subarray(0, total);
}

/** Undo PNG scanline filters in place (8-bit samples, `bpp` bytes per pixel). */
function unfilter(raw: Uint8Array, width: number, height: number, bpp: number): Uint8Array | null {
  const stride = width * bpp;
  if (raw.length < height * (stride + 1)) return null;
  const out = new Uint8Array(height * stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)] as number;
    const src = y * (stride + 1) + 1;
    const row = y * stride;
    const prev = row - stride;
    for (let x = 0; x < stride; x += 1) {
      const value = raw[src + x] as number;
      const a = x >= bpp ? (out[row + x - bpp] as number) : 0;
      const b = y > 0 ? (out[prev + x] as number) : 0;
      const c = y > 0 && x >= bpp ? (out[prev + x - bpp] as number) : 0;
      let predicted = 0;
      if (filter === 1) predicted = a;
      else if (filter === 2) predicted = b;
      else if (filter === 3) predicted = (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        predicted = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else if (filter !== 0) return null;
      out[row + x] = (value + predicted) & 0xff;
    }
  }
  return out;
}

async function packed(
  data: Uint8Array,
  compress: boolean
): Promise<{ filter: string; data: Uint8Array }> {
  const deflated = compress ? await compressBytes(data, 'deflate') : null;
  return deflated ? { filter: ' /Filter /FlateDecode', data: deflated } : { filter: '', data };
}

/** The XObject for a loaded image, or `null` (with the reason) when the writer cannot embed it. */
export async function pdfImage(
  image: LoadedImage,
  compress: boolean
): Promise<{ ok: true; value: PdfImage } | { ok: false; reason: string }> {
  const { info, bytes } = image;
  const size = `/Type /XObject /Subtype /Image /Width ${info.width} /Height ${info.height}`;
  if (info.format === 'jpeg') {
    if (info.bitDepth !== 8) return { ok: false, reason: 'Only 8-bit JPEG images are embedded.' };
    const space =
      info.components === 1
        ? '/DeviceGray'
        : info.components === 4
          ? '/DeviceCMYK /Decode [1 0 1 0 1 0 1 0]'
          : '/DeviceRGB';
    return {
      ok: true,
      value: {
        width: info.width,
        height: info.height,
        image: {
          dict: `${size} /ColorSpace ${space} /BitsPerComponent 8 /Filter /DCTDecode`,
          data: bytes,
        },
      },
    };
  }
  if (info.interlaced) return { ok: false, reason: 'Interlaced PNG images are not embedded.' };
  const chunks = pngChunks(bytes);
  if (!chunks) return { ok: false, reason: 'The PNG image has no readable image data.' };
  const { colorType, bitDepth, width, height } = info;
  if (colorType === 0 || colorType === 2 || colorType === 3) {
    if (![1, 2, 4, 8, 16].includes(bitDepth) || (colorType === 3 && bitDepth > 8)) {
      return { ok: false, reason: 'Unsupported PNG bit depth.' };
    }
    let space = colorType === 0 ? '/DeviceGray' : '/DeviceRGB';
    if (colorType === 3) {
      if (!chunks.palette || chunks.palette.length % 3 !== 0 || chunks.palette.length === 0) {
        return { ok: false, reason: 'The palette PNG has no palette.' };
      }
      space = `[/Indexed /DeviceRGB ${chunks.palette.length / 3 - 1} <${hex(chunks.palette)}>]`;
    }
    const colors = colorType === 2 ? 3 : 1;
    return {
      ok: true,
      value: {
        width,
        height,
        image: {
          dict: `${size} /ColorSpace ${space} /BitsPerComponent ${bitDepth} /Filter /FlateDecode /DecodeParms << /Predictor 15 /Colors ${colors} /BitsPerComponent ${bitDepth} /Columns ${width} >>`,
          data: chunks.idat,
        },
      },
    };
  }
  if ((colorType === 4 || colorType === 6) && bitDepth === 8) {
    const channels = colorType === 6 ? 4 : 2;
    const expected = height * (1 + width * channels);
    if (expected > MAX_IMAGE_PIXELS_BYTES)
      return { ok: false, reason: 'The PNG image is too large.' };
    const raw = await inflate(chunks.idat, expected);
    const pixels = raw ? unfilter(raw, width, height, channels) : null;
    if (!pixels) return { ok: false, reason: 'The PNG image data could not be decoded.' };
    const colorChannels = channels - 1;
    const color = new Uint8Array(width * height * colorChannels);
    const alpha = new Uint8Array(width * height);
    for (let i = 0, c = 0; i < width * height; i += 1) {
      for (let k = 0; k < colorChannels; k += 1) color[c++] = pixels[i * channels + k] as number;
      alpha[i] = pixels[i * channels + colorChannels] as number;
    }
    const colorData = await packed(color, compress);
    const alphaData = await packed(alpha, compress);
    const space = colorChannels === 3 ? '/DeviceRGB' : '/DeviceGray';
    return {
      ok: true,
      value: {
        width,
        height,
        image: {
          dict: `${size} /ColorSpace ${space} /BitsPerComponent 8${colorData.filter}`,
          data: colorData.data,
        },
        smask: {
          dict: `${size} /ColorSpace /DeviceGray /BitsPerComponent 8${alphaData.filter}`,
          data: alphaData.data,
        },
      },
    };
  }
  return { ok: false, reason: 'Unsupported PNG color type or bit depth.' };
}
