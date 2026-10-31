/**
 * Shared pieces of the DOCX and PDF writers (ADR-016): diagnostics, host
 * image resolution with byte sniffing, links through the URL policy, the
 * table of a wrapped `@texuli/blocks` table, and the text fallback of
 * blocks a static file cannot paint. Internal: each writer re-exports what
 * its callers need.
 */
import { type HrefTrust, safeHref, safeImageSrc } from '@texuli/core/url-policy';
import type {
  DocumentInline,
  DocumentJson,
  EmbedBlock,
  MediaBlock,
  TexuliDocument,
  WrappedBlock,
} from '../model/types.ts';

export type OutputDiagnosticCode =
  | 'image-unresolved'
  | 'image-unsupported'
  | 'link-refused'
  | 'block-as-text'
  | 'embed-as-text'
  | 'glyph-missing'
  | 'font-unsupported'
  | 'design-system-unapplied'
  | 'truncated';

export interface OutputDiagnostic {
  code: OutputDiagnosticCode;
  /** The block it concerns, when there is one. */
  id?: string;
  message: string;
}

/**
 * ADR-024: the document names a design system but the caller passed no
 * `design` values. The L1 writers cannot compile it (that needs
 * `@texuli/tokens`), so they write the default styling and say so.
 */
export function designSystemUnapplied(
  doc: Pick<TexuliDocument, 'designSystem'>,
  design: unknown
): OutputDiagnostic | undefined {
  const system = doc.designSystem;
  if (!system || design) return undefined;
  const name = typeof system.ref === 'string' ? `"${system.ref.slice(0, 80)}"` : 'an inline one';
  return {
    code: 'design-system-unapplied',
    message: `The document follows the design system ${name}; the default styling was used. Pass design values (designValues(compiled, mode) from @texuli/tools/print) to apply it.`,
  };
}

/** Image bytes a host resolved for a media block's `ref`. */
export type ImageResolver = (
  ref: string,
  block: MediaBlock
) => Uint8Array | null | undefined | Promise<Uint8Array | null | undefined>;

export interface ImageInfo {
  format: 'png' | 'jpeg';
  width: number;
  height: number;
  /** PNG: bit depth, color type, interlace. JPEG: color components. */
  bitDepth: number;
  colorType: number;
  interlaced: boolean;
  components: number;
}

/** The largest image a writer embeds (20 MiB). */
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

const u16 = (b: Uint8Array, i: number) => ((b[i] as number) << 8) | (b[i + 1] as number);
const u32 = (b: Uint8Array, i: number) =>
  (((b[i] as number) << 24) |
    ((b[i + 1] as number) << 16) |
    ((b[i + 2] as number) << 8) |
    (b[i + 3] as number)) >>>
  0;

/** Sniff PNG or JPEG bytes and read their dimensions, or `null` for anything else. Bounded: one pass over JPEG markers. */
export function probeImage(bytes: Uint8Array): ImageInfo | null {
  if (
    bytes.length > 33 &&
    u32(bytes, 0) === 0x89504e47 &&
    u32(bytes, 4) === 0x0d0a1a0a &&
    u32(bytes, 12) === 0x49484452
  ) {
    const width = u32(bytes, 16);
    const height = u32(bytes, 20);
    if (width === 0 || height === 0 || width > 30_000 || height > 30_000) return null;
    return {
      format: 'png',
      width,
      height,
      bitDepth: bytes[24] as number,
      colorType: bytes[25] as number,
      interlaced: bytes[28] === 1,
      components: 0,
    };
  }
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) return null;
      const marker = bytes[i + 1] as number;
      if (marker === 0xff) {
        i += 1;
        continue;
      }
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
        i += 2;
        continue;
      }
      const length = u16(bytes, i + 2);
      if (length < 2) return null;
      const sof =
        marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (sof) {
        const height = u16(bytes, i + 5);
        const width = u16(bytes, i + 7);
        const components = bytes[i + 9] as number;
        if (!width || !height || ![1, 3, 4].includes(components)) return null;
        return {
          format: 'jpeg',
          width,
          height,
          bitDepth: bytes[i + 4] as number,
          colorType: 0,
          interlaced: marker === 0xc2,
          components,
        };
      }
      if (marker === 0xda || marker === 0xd9) return null;
      i += 2 + length;
    }
  }
  return null;
}

export interface LoadedImage {
  bytes: Uint8Array;
  info: ImageInfo;
}

/**
 * Resolve a media block's image through the host, after its ref passes
 * `safeImageSrc` at `trust`. Unresolved, oversized or unrecognized bytes
 * report a diagnostic, and the writer prints the alt text instead.
 */
export async function loadImage(
  block: MediaBlock,
  resolve: ImageResolver | undefined,
  trust: HrefTrust,
  diagnostics: OutputDiagnostic[]
): Promise<LoadedImage | null> {
  if (!resolve || safeImageSrc(block.ref, trust) === undefined) {
    diagnostics.push({
      code: 'image-unresolved',
      id: block.id,
      message: resolve
        ? 'The image ref is refused by the URL policy.'
        : 'No image resolver; the alt text is written.',
    });
    return null;
  }
  let bytes: Uint8Array | null | undefined;
  try {
    bytes = await resolve(block.ref, block);
  } catch {
    bytes = null;
  }
  if (!(bytes instanceof Uint8Array) || bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) {
    diagnostics.push({
      code: 'image-unresolved',
      id: block.id,
      message: 'The host returned no usable image bytes.',
    });
    return null;
  }
  const info = probeImage(bytes);
  if (!info) {
    diagnostics.push({
      code: 'image-unsupported',
      id: block.id,
      message: 'Only PNG and JPEG images are embedded.',
    });
    return null;
  }
  return { bytes, info };
}

/**
 * A link a file may carry: it passes `safeHref` at `trust` and is absolute
 * (`https:` or `mailto:`, or any non-relative scheme the developer tier
 * allows). Fragments and relative paths have nothing to point at in a file.
 */
export function fileLink(href: string, trust: HrefTrust): string | null {
  const safe = safeHref(href, trust);
  if (!safe) return null;
  return /^[A-Za-z][A-Za-z0-9+.-]*:/.test(safe) && !safe.startsWith('#') ? safe : null;
}

/** The link href of a text run, if it has one. */
export function runLink(part: DocumentInline): string | null {
  if (part.type !== 'text') return null;
  for (const mark of part.marks) if (mark.type === 'link') return mark.href;
  return null;
}

export interface RunStyle {
  strong: boolean;
  em: boolean;
  strike: boolean;
  code: boolean;
}

export function runStyle(part: DocumentInline): RunStyle {
  const style = { strong: false, em: false, strike: false, code: false };
  if (part.type === 'text') {
    for (const mark of part.marks) {
      if (
        mark.type === 'strong' ||
        mark.type === 'em' ||
        mark.type === 'strike' ||
        mark.type === 'code'
      )
        style[mark.type] = true;
    }
  }
  return style;
}

export interface SimpleTable {
  caption: string;
  header: string[];
  rows: string[][];
}

const MAX_COLUMNS = 16;
const MAX_ROWS = 500;

function cell(value: DocumentJson | undefined): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

/**
 * The table of a wrapped `@texuli/blocks` `table` block (`{ caption?,
 * columns: [{ id, label }], rows: [{ [id]: cell }] }`), read defensively
 * and bounded, or `null` when the props do not hold one.
 */
export function wrappedTable(block: WrappedBlock): SimpleTable | null {
  if (block.block !== 'table') return null;
  const { columns, rows, caption } = block.props;
  if (!Array.isArray(columns) || !Array.isArray(rows) || columns.length === 0) return null;
  const ids: string[] = [];
  const header: string[] = [];
  for (const column of columns.slice(0, MAX_COLUMNS)) {
    if (!column || typeof column !== 'object' || Array.isArray(column)) return null;
    const id = column.id;
    if (typeof id !== 'string') return null;
    ids.push(id);
    header.push(typeof column.label === 'string' ? column.label : id);
  }
  const body: string[][] = [];
  for (const row of rows.slice(0, MAX_ROWS)) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    body.push(ids.map((id) => cell((row as Record<string, DocumentJson>)[id])));
  }
  return { caption: typeof caption === 'string' ? caption : '', header, rows: body };
}

const TEXT_PROPS = ['title', 'label', 'value', 'text', 'caption', 'description'];

/** The text a static file prints for a wrapped block it cannot paint. */
export function wrappedText(block: WrappedBlock): string {
  const parts: string[] = [];
  for (const key of TEXT_PROPS) {
    const value = block.props[key];
    if (typeof value === 'string' && value.trim()) parts.push(value.trim().slice(0, 500));
    else if (typeof value === 'number') parts.push(String(value));
  }
  return parts.length > 0 ? parts.join(' · ') : `[${block.block}]`;
}

/** The text a static file prints for an embed: its title or kind. */
export function embedText(block: EmbedBlock): string {
  const kind = block.kind.charAt(0).toUpperCase() + block.kind.slice(1);
  return block.title ? `[${kind}: ${block.title}]` : `[${kind}]`;
}

/** Split a band template into text and `page`/`pages` field segments (`{title}` is text). */
export function bandSegments(
  template: string | undefined,
  title: string
): ({ text: string } | { field: 'page' | 'pages' })[] {
  if (!template) return [];
  const out: ({ text: string } | { field: 'page' | 'pages' })[] = [];
  let last = 0;
  for (const match of template.matchAll(/\{(pages|page|title)\}/g)) {
    const index = match.index ?? 0;
    if (index > last) out.push({ text: template.slice(last, index) });
    if (match[1] === 'title') out.push({ text: title });
    else out.push({ field: match[1] as 'page' | 'pages' });
    last = index + match[0].length;
  }
  if (last < template.length) out.push({ text: template.slice(last) });
  return out;
}
