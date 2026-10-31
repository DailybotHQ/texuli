/**
 * Design-system share links for the studio (PLAN_011 T-ds-studio): the
 * document travels in the URL fragment, compressed, and nothing is uploaded.
 *
 *   #ds=1.<base64url(deflate-raw(UTF-8 JSON))>
 *
 * - `1` is the link format version; anything else is refused.
 * - The fragment never reaches a server (browsers do not send it), so a
 *   shared link stores nothing anywhere but in the link itself.
 * - Decoding is bounded: the fragment is capped before it is touched, the
 *   inflated size is capped while it streams (a small link cannot expand
 *   into a large document), and the text must be strict UTF-8 JSON holding
 *   an object. The caller then validates it at the `untrusted` tier, like
 *   any other document from outside the page.
 *
 * Pure apart from the platform's `CompressionStream`, which every current
 * browser and Node 18+ provide. No DOM.
 */

/** The fragment prefix of a design-system link. */
export const SHARE_PREFIX = '#ds=';

/** The link format this studio writes and reads. */
export const SHARE_VERSION = '1';

/**
 * Link caps: the fragment length (after `#ds=`) and the inflated JSON size.
 * 16,384 characters fit every browser's address bar and most chat clients;
 * a typical studio document is under 1,000. The JSON cap equals the
 * importers' and is far above any legal document the caps of the spec allow
 * in practice.
 */
export const SHARE_LIMITS = Object.freeze({
  hashChars: 16_384,
  jsonBytes: 262_144,
});

/** Stable codes for a link the studio cannot open (shown with the message). */
export type ShareErrorCode =
  | 'share-format'
  | 'share-version'
  | 'share-too-long'
  | 'share-encoding'
  | 'share-too-large'
  | 'share-json'
  | 'share-unsupported';

export interface ShareError {
  ok: false;
  code: ShareErrorCode;
  message: string;
}

export type ShareEncodeResult = { ok: true; hash: string; chars: number } | ShareError;

export type ShareDecodeResult =
  | { ok: true; value: Record<string, unknown>; bytes: number }
  | ShareError;

const BODY = /^([0-9]{1,3})\.([A-Za-z0-9_-]+)$/;

const fail = (code: ShareErrorCode, message: string): ShareError => ({ ok: false, code, message });

/** True when a `location.hash` is a design-system link (it may still be refused). */
export function isShareHash(hash: string): boolean {
  return hash.startsWith(SHARE_PREFIX);
}

function hasCompression(): boolean {
  return typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';
}

function streamOf(bytes: Uint8Array<ArrayBuffer>): ReadableStream<BufferSource> {
  return new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

/** Reads a byte stream to the end, or stops at `cap` bytes and returns `null`. */
async function readCapped(
  stream: ReadableStream<Uint8Array>,
  cap: number
): Promise<Uint8Array | null> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > cap) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/** Base64url without padding (RFC 4648 §5). */
export function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const step = 0x8000;
  for (let index = 0; index < bytes.length; index += step) {
    binary += String.fromCharCode(...bytes.subarray(index, index + step));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** The bytes of a base64url string, or `null` when it is not one. */
export function fromBase64Url(text: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1) return null;
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  try {
    const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    return null;
  }
}

/**
 * The link fragment for a document. Refused (with a code) when the browser
 * cannot compress or the document is too large for a link: export the JSON
 * file instead.
 */
export async function encodeShareHash(document: unknown): Promise<ShareEncodeResult> {
  if (!hasCompression()) {
    return fail(
      'share-unsupported',
      'This browser cannot compress a link. Download the JSON instead.'
    );
  }
  let json: string;
  try {
    json = JSON.stringify(document);
  } catch {
    return fail('share-json', 'The document could not be written as JSON.');
  }
  if (typeof json !== 'string') return fail('share-json', 'Only a document object can be shared.');
  const bytes = new TextEncoder().encode(json);
  if (bytes.byteLength > SHARE_LIMITS.jsonBytes) {
    return fail(
      'share-too-large',
      'The document is too large for a link. Download the JSON instead.'
    );
  }
  const compressed = await readCapped(
    streamOf(bytes).pipeThrough(new CompressionStream('deflate-raw')),
    SHARE_LIMITS.jsonBytes
  );
  if (!compressed) {
    return fail(
      'share-too-large',
      'The document is too large for a link. Download the JSON instead.'
    );
  }
  const body = `${SHARE_VERSION}.${toBase64Url(compressed)}`;
  if (body.length > SHARE_LIMITS.hashChars) {
    return fail(
      'share-too-long',
      `The link would be ${body.length.toLocaleString('en-US')} characters, over the ${SHARE_LIMITS.hashChars.toLocaleString('en-US')} cap. Download the JSON instead.`
    );
  }
  return { ok: true, hash: `${SHARE_PREFIX}${body}`, chars: body.length };
}

/**
 * The value a link fragment carries, or a refusal with a code. The value is
 * plain JSON (an object), not yet a valid design system: validate it at the
 * `untrusted` tier before use.
 */
export async function decodeShareHash(hash: string): Promise<ShareDecodeResult> {
  if (!isShareHash(hash)) return fail('share-format', 'That is not a design-system link.');
  const body = hash.slice(SHARE_PREFIX.length);
  if (body.length > SHARE_LIMITS.hashChars) {
    return fail(
      'share-too-long',
      `The link is longer than the ${SHARE_LIMITS.hashChars.toLocaleString('en-US')}-character cap, so it was not opened.`
    );
  }
  const match = BODY.exec(body);
  if (!match)
    return fail('share-format', 'The link is malformed: it is not a version and a base64url body.');
  if (match[1] !== SHARE_VERSION) {
    return fail(
      'share-version',
      `The link uses format ${match[1]}; this studio reads format ${SHARE_VERSION}.`
    );
  }
  if (!hasCompression()) {
    return fail('share-unsupported', 'This browser cannot decompress the link.');
  }
  const compressed = fromBase64Url(match[2] ?? '');
  if (!compressed) return fail('share-encoding', 'The link body is not valid base64url.');
  let inflated: Uint8Array | null;
  try {
    inflated = await readCapped(
      streamOf(compressed).pipeThrough(new DecompressionStream('deflate-raw')),
      SHARE_LIMITS.jsonBytes
    );
  } catch {
    return fail('share-encoding', 'The link body is not a compressed document.');
  }
  if (!inflated) {
    return fail(
      'share-too-large',
      `The link expands past the ${SHARE_LIMITS.jsonBytes.toLocaleString('en-US')}-byte cap, so it was not opened.`
    );
  }
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(inflated);
  } catch {
    return fail('share-encoding', 'The link does not hold UTF-8 text.');
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return fail('share-json', 'The link does not hold JSON.');
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return fail('share-json', 'The link does not hold a design-system object.');
  }
  return { ok: true, value: value as Record<string, unknown>, bytes: inflated.byteLength };
}
