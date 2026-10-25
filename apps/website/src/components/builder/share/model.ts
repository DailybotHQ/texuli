/**
 * Share links: the draft (canonical JSON) and the preview view, compressed
 * into the URL hash (`#draft=1.<base64url>`). Encoding and decoding run in
 * the browser with the standard `CompressionStream` (raw deflate): nothing
 * is uploaded, and the same draft gives the same link from the same
 * compressor. Opening a link runs the exact check a JSON commit runs
 * (`checkPayloadText`: size, duplicate keys, the closed rules) before
 * anything paints; any problem yields a message, never a partial draft.
 */
import type { CatalogTreeInput } from '@texuli/catalog/render/renderer';
import { canonicalJson, MAX_BLUEPRINT_BYTES } from '../model.ts';
import { checkPayloadText, describeIssue } from '../payload/model.ts';
import { type PreviewView, parseView, viewText } from '../preview/model.ts';

export const SHARE_PREFIX = '#draft=';
export const SHARE_VERSION = '1';
/** The longest hash a link may carry (base64url characters after the prefix). */
export const MAX_SHARE_CHARS = 262_144;
/** The view line plus the largest draft a JSON commit accepts. */
const MAX_TEXT_BYTES = MAX_BLUEPRINT_BYTES + 64;

export type ShareResult =
  | { ok: true; tree: CatalogTreeInput; view: PreviewView }
  | { ok: false; message: string };

export function isShareHash(hash: string): boolean {
  return hash.startsWith(SHARE_PREFIX);
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
  try {
    const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Inflate, stopping as soon as the output passes `max` bytes (`null` then, or on corrupt data). */
async function inflate(bytes: Uint8Array, max: number): Promise<Uint8Array | null> {
  const reader = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'))
    .getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > max) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/** The hash for a draft and its preview view. */
export async function encodeShare(tree: CatalogTreeInput, view: PreviewView): Promise<string> {
  const text = `${viewText(view)}\n${canonicalJson(tree)}`;
  const packed = await deflate(new TextEncoder().encode(text));
  return `${SHARE_PREFIX}${SHARE_VERSION}.${toBase64Url(packed)}`;
}

/** A hash → the draft and view it carries, checked like a JSON commit, or why it cannot open. */
export async function decodeShare(hash: string): Promise<ShareResult> {
  if (!isShareHash(hash)) return { ok: false, message: 'The link carries no draft.' };
  const body = hash.slice(SHARE_PREFIX.length);
  const dot = body.indexOf('.');
  if (dot < 0 || body.slice(0, dot) !== SHARE_VERSION) {
    return { ok: false, message: 'The link uses a share format this builder does not read.' };
  }
  const data = body.slice(dot + 1);
  if (data.length > MAX_SHARE_CHARS) {
    return { ok: false, message: `The link is longer than ${MAX_SHARE_CHARS} characters.` };
  }
  const packed = fromBase64Url(data);
  if (!packed || packed.length === 0) return { ok: false, message: 'The link is damaged.' };
  const bytes = await inflate(packed, MAX_TEXT_BYTES);
  if (!bytes) {
    return { ok: false, message: 'The link is damaged or holds more than a draft can.' };
  }
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return { ok: false, message: 'The link is damaged.' };
  }
  const newline = text.indexOf('\n');
  const view = newline < 0 ? null : parseView(text.slice(0, newline));
  if (!view) return { ok: false, message: 'The link’s preview settings are not readable.' };
  const checked = checkPayloadText(text.slice(newline + 1));
  if (!checked.ok) {
    const first = checked.issues[0];
    return {
      ok: false,
      message: `The shared draft was refused: ${first ? describeIssue(first) : 'it did not pass the checks'}`,
    };
  }
  return { ok: true, tree: checked.tree, view };
}
