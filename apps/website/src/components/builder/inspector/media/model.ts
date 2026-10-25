/**
 * Framework-free model for media props in the builder inspector.
 *
 * Two kinds of media prop exist in the manifests, with two different rules:
 *
 * - `media-image` takes `src`, `srcset` and `href` as plain strings. The
 *   renderer (`sanitizeProps`) checks only that each is a string with no
 *   markup; the image component then runs the core URL policy on it at
 *   paint. Its tier comes from the `trust` prop, and the player pins that
 *   prop to `untrusted` for every blueprint (`TRUST_PINNED_IDS`), so a
 *   blueprint image is always checked at the untrusted tier. `href` is
 *   checked at the untrusted tier whatever `trust` says.
 * - `blocks-media` takes a whole block. Its sources are not URLs: the block
 *   parser accepts an avatar id, a small base64 data URI or a relative path
 *   (`classifyMediaSource`), and refuses every remote URL.
 *
 * Every verdict here is one of those functions called as the paint calls
 * it; nothing is re-implemented. Imports only `@texuli/*` packages, so it
 * can move into a future `@texuli/builder`.
 */

import {
  BLOCK_CONTENT_LIMITS,
  base64DecodedBytes,
  classifyMediaSource,
  MEDIA_DATA_URI_MAX_BYTES,
  type MediaKind,
} from '@texuli/blocks/core';
import { checkMediaBlock } from '@texuli/blocks/media';
import type { CatalogPropSchema } from '@texuli/catalog';
import { sanitizeProps } from '@texuli/catalog/render/renderer';
import { safeHref, safeImageSrc, safeImageSrcset } from '@texuli/core/url-policy';
import { applyMediaPolicy, TRUST_PINNED_IDS } from '@texuli/player';

export type Tier = 'developer' | 'untrusted';

/** Which URL policy call the image component makes on a prop. */
export type UrlRole = 'image-src' | 'image-srcset' | 'href';

/** The `media-image` props the image component passes through the URL policy. */
const URL_ROLES: Readonly<Record<string, Readonly<Record<string, UrlRole>>>> = Object.freeze({
  'media-image': Object.freeze({ src: 'image-src', srcset: 'image-srcset', href: 'href' }),
});

export function urlRoleOf(id: string, name: string): UrlRole | undefined {
  return Object.hasOwn(URL_ROLES, id) && Object.hasOwn(URL_ROLES[id] ?? {}, name)
    ? URL_ROLES[id]?.[name]
    : undefined;
}

export function isAltProp(id: string, name: string): boolean {
  return id === 'media-image' && name === 'alt';
}

/**
 * The tier a blueprint URL is painted at: always `untrusted`. The player
 * runs blueprints untrusted and overrides `trust` on every id with URL props
 * (`TRUST_PINNED_IDS`), and the image component checks `href` untrusted
 * whatever `trust` says. Fails closed for any id added later.
 */
export const BLUEPRINT_TIER: Tier = 'untrusted';

/** Ids with URL props whose `trust` the player pins (all of them today). */
export function isTrustPinned(id: string): boolean {
  return TRUST_PINNED_IDS.includes(id);
}

/** Every id with URL props, for tests. */
export const URL_PROP_IDS: readonly string[] = Object.freeze(Object.keys(URL_ROLES));

/** The URL policy call for a role, exactly as the image component makes it. */
export function policyFor(role: UrlRole, value: unknown, tier: Tier): string | undefined {
  if (role === 'image-src') return safeImageSrc(value, tier);
  if (role === 'image-srcset') return safeImageSrcset(value, tier);
  return safeHref(value, tier);
}

export type SourceKind =
  | 'https'
  | 'http'
  | 'mailto'
  | 'fragment'
  | 'relative'
  | 'data'
  | 'blob'
  | 'protocol-relative'
  | 'script'
  | 'other-scheme'
  | 'list';

export const SOURCE_KIND_LABELS: Readonly<Record<SourceKind, string>> = Object.freeze({
  https: 'HTTPS URL',
  http: 'HTTP URL',
  mailto: 'email link',
  fragment: 'same-page link',
  relative: 'relative path',
  data: 'data URI',
  blob: 'blob URL',
  'protocol-relative': 'protocol-relative URL',
  script: 'script URL',
  'other-scheme': 'other scheme',
  list: 'candidate list',
});

/** What the text looks like, for the explanation only (verdicts come from the policy). */
export function sourceKindOf(value: string, role: UrlRole): SourceKind {
  const text = value.trim();
  if (role === 'image-srcset' && text.includes(',')) return 'list';
  if (text.startsWith('//') || text.startsWith('\\')) return 'protocol-relative';
  if (text.startsWith('#')) return 'fragment';
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(text)?.[1]?.toLowerCase();
  if (scheme === undefined) return 'relative';
  if (scheme === 'https' || scheme === 'http' || scheme === 'data' || scheme === 'blob') {
    return scheme;
  }
  if (scheme === 'mailto') return 'mailto';
  if (scheme === 'javascript' || scheme === 'vbscript') return 'script';
  return 'other-scheme';
}

export type UrlReading =
  | { state: 'unset'; required: boolean }
  | { state: 'refused'; message: string }
  | { state: 'blocked'; kind: SourceKind; tier: Tier; developer: boolean; reason: string }
  | { state: 'painted'; kind: SourceKind; tier: Tier; url: string };

/** The renderer's verdict on one prop: kept, or the reason it is refused. */
export function rendererVerdict(prop: CatalogPropSchema, value: unknown): string | undefined {
  const result = sanitizeProps({ [prop.name]: value }, [prop], '', 'inspector');
  if (result.props && Object.hasOwn(result.props, prop.name)) return undefined;
  return (
    result.diagnostics.find((diagnostic) => diagnostic.message)?.message ??
    `Prop "${prop.name}" was refused.`
  );
}

function blockedReason(kind: SourceKind, role: UrlRole, developer: boolean): string {
  if (developer) {
    return `A ${SOURCE_KIND_LABELS[kind]} is allowed only at the developer tier, and the player paints every blueprint image at the untrusted tier.`;
  }
  switch (kind) {
    case 'script':
      return 'Script URLs are blocked at every tier.';
    case 'protocol-relative':
      return 'Protocol-relative URLs (//host) are blocked at every tier.';
    case 'data':
      return role === 'href'
        ? 'Data links are blocked at every tier.'
        : 'Not a base64 png, jpeg, gif, webp or avif image within the size limit.';
    case 'list':
      return 'Every candidate must be an allowed URL with one width (480w) or density (2x) descriptor, all of one kind.';
    case 'https':
      return 'HTTPS URLs must name a host, with no credentials, spaces, quotes or angle brackets.';
    case 'relative':
      return 'Relative paths must not contain spaces, quotes, angle brackets, invisible characters or a colon before the first slash.';
    default:
      return role === 'href'
        ? 'Untrusted links allow only https:, mailto: and #fragment.'
        : 'Untrusted images allow only HTTPS URLs and relative paths.';
  }
}

/** One `media-image` URL prop: unset, refused by the renderer, blocked at paint, or painted. */
export function readUrl(prop: CatalogPropSchema, role: UrlRole, value: unknown): UrlReading {
  if (value === undefined) return { state: 'unset', required: prop.required === true };
  const refused = rendererVerdict(prop, value);
  if (refused) return { state: 'refused', message: refused };
  const text = value as string;
  const tier = BLUEPRINT_TIER;
  const kind = sourceKindOf(text, role);
  const url = policyFor(role, text, tier);
  if (url !== undefined) return { state: 'painted', kind, tier, url };
  const developer = policyFor(role, text, 'developer') !== undefined;
  return { state: 'blocked', kind, tier, developer, reason: blockedReason(kind, role, developer) };
}

export type AltReading =
  | { state: 'unset' }
  | { state: 'refused'; message: string }
  | { state: 'replaced' }
  | { state: 'set' };

const NO_ALT = '\u0000no-alt';

/** `alt`: the renderer's verdict, then whether the player's media policy replaces a blank one. */
export function readAlt(prop: CatalogPropSchema, value: unknown): AltReading {
  if (value === undefined) return { state: 'unset' };
  const refused = rendererVerdict(prop, value);
  if (refused) return { state: 'refused', message: refused };
  const painted = applyMediaPolicy('media-image', { alt: value }, { mediaNoAlt: NO_ALT });
  return painted.alt === NO_ALT ? { state: 'replaced' } : { state: 'set' };
}

// ---------------------------------------------------------------------------
// blocks-media
// ---------------------------------------------------------------------------

export const MEDIA_TYPES = ['image', 'figure', 'video', 'gallery'] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export const MEDIA_TYPE_LABELS: Readonly<Record<MediaType, string>> = Object.freeze({
  image: 'Image',
  figure: 'Figure',
  video: 'Video',
  gallery: 'Gallery',
});

export type MediaField =
  | { name: string; label: string; kind: 'source'; media: MediaKind; required: boolean }
  | { name: string; label: string; kind: 'plain'; required: boolean; max: number }
  | { name: string; label: string; kind: 'dimension'; required: true }
  | { name: string; label: string; kind: 'boolean'; required: false }
  | { name: 'fit'; label: string; kind: 'fit'; required: false }
  | { name: 'columns'; label: string; kind: 'columns'; required: false }
  | { name: 'items'; label: string; kind: 'items'; required: true };

const L = BLOCK_CONTENT_LIMITS;

/** The fields every image-like record has (image, figure, gallery item). */
const IMAGE_LIKE: readonly MediaField[] = [
  { name: 'src', label: 'Image source', kind: 'source', media: 'image', required: true },
  { name: 'alt', label: 'Alt text', kind: 'plain', required: false, max: 280 },
  { name: 'decorative', label: 'Decorative (no alt text)', kind: 'boolean', required: false },
  { name: 'width', label: 'Width (px)', kind: 'dimension', required: true },
  { name: 'height', label: 'Height (px)', kind: 'dimension', required: true },
  { name: 'fit', label: 'Fit', kind: 'fit', required: false },
];

/** Field lists mirror the media family parser (`@texuli/blocks`), which stays the judge. */
export const MEDIA_FIELDS: Readonly<Record<MediaType, readonly MediaField[]>> = Object.freeze({
  image: [
    ...IMAGE_LIKE,
    { name: 'caption', label: 'Caption', kind: 'plain', required: false, max: 280 },
    { name: 'credit', label: 'Credit', kind: 'plain', required: false, max: 120 },
  ],
  figure: [
    ...IMAGE_LIKE,
    { name: 'caption', label: 'Caption', kind: 'plain', required: true, max: 280 },
    { name: 'credit', label: 'Credit', kind: 'plain', required: false, max: 120 },
  ],
  video: [
    { name: 'src', label: 'Video source', kind: 'source', media: 'video', required: true },
    { name: 'label', label: 'Label', kind: 'plain', required: true, max: 160 },
    { name: 'width', label: 'Width (px)', kind: 'dimension', required: true },
    { name: 'height', label: 'Height (px)', kind: 'dimension', required: true },
    { name: 'poster', label: 'Poster image', kind: 'source', media: 'image', required: false },
    { name: 'caption', label: 'Caption', kind: 'plain', required: false, max: 280 },
    { name: 'autoplay', label: 'Autoplay (muted only)', kind: 'boolean', required: false },
    { name: 'loop', label: 'Loop', kind: 'boolean', required: false },
    { name: 'muted', label: 'Muted', kind: 'boolean', required: false },
    { name: 'controls', label: 'Show controls', kind: 'boolean', required: false },
  ],
  gallery: [
    { name: 'items', label: 'Images', kind: 'items', required: true },
    { name: 'title', label: 'Title', kind: 'plain', required: false, max: 120 },
    { name: 'columns', label: 'Columns', kind: 'columns', required: false },
  ],
});

export const GALLERY_ITEM_FIELDS: readonly MediaField[] = [
  ...IMAGE_LIKE,
  { name: 'caption', label: 'Caption', kind: 'plain', required: false, max: 280 },
];

export const FITS = ['contain', 'cover'] as const;
export const COLUMNS = [2, 3, 4] as const;
export const MAX_DIMENSION = L.mediaDimension;
export const MAX_GALLERY_ITEMS = L.galleryItems;
export { checkMediaBlock, MEDIA_DATA_URI_MAX_BYTES };

/** A 1×1 transparent PNG: a fictional, embedded starter source that paints anywhere. */
export const SAMPLE_IMAGE_SRC =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

const SAMPLE_ITEM = Object.freeze({
  src: SAMPLE_IMAGE_SRC,
  alt: 'A placeholder image',
  width: 640,
  height: 480,
});

export type MediaBlockValue = Record<string, unknown> & { type: MediaType };

/** Fictional starter content for each type; every preset parses. */
export const MEDIA_PRESETS: Readonly<Record<MediaType, MediaBlockValue>> = Object.freeze({
  image: { type: 'image', ...SAMPLE_ITEM },
  figure: { type: 'figure', ...SAMPLE_ITEM, caption: 'A fictional caption.' },
  video: {
    type: 'video',
    src: 'media/sample.mp4',
    label: 'A fictional product tour',
    width: 1280,
    height: 720,
  },
  gallery: {
    type: 'gallery',
    items: [{ ...SAMPLE_ITEM }, { ...SAMPLE_ITEM, alt: 'A second placeholder' }],
  },
});

export function isMediaType(value: unknown): value is MediaType {
  return typeof value === 'string' && (MEDIA_TYPES as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** The block the editor shows: the current value when it is a media type, else the image preset. */
export function editableMediaBlock(value: unknown): MediaBlockValue {
  if (isRecord(value) && isMediaType(value.type)) return { ...value, type: value.type };
  return { ...MEDIA_PRESETS.image };
}

/** The image-like fields a type switch carries over (between image, figure and gallery). */
const CARRIED = ['src', 'alt', 'decorative', 'width', 'height', 'fit'];

/** Switch type, keeping the first image's fields between image-like types. */
export function switchMediaType(block: MediaBlockValue, type: MediaType): MediaBlockValue {
  if (block.type === type) return block;
  const first: Record<string, unknown> =
    block.type === 'gallery'
      ? isRecord((block.items as unknown[] | undefined)?.[0])
        ? ((block.items as unknown[])[0] as Record<string, unknown>)
        : {}
      : block;
  if (type === 'video' || block.type === 'video') return { ...MEDIA_PRESETS[type] };
  const carried: Record<string, unknown> = {};
  for (const name of CARRIED) if (first[name] !== undefined) carried[name] = first[name];
  if (Object.keys(carried).length === 0) return { ...MEDIA_PRESETS[type] };
  if (type === 'gallery') return { type, items: [carried] };
  return { ...MEDIA_PRESETS[type], ...carried, type };
}

/**
 * Set one field on a record. An empty optional field (`''`, `undefined`,
 * `false`) is removed instead of written, so payloads stay minimal.
 */
export function setRecordField(
  record: Record<string, unknown>,
  field: MediaField,
  value: unknown
): Record<string, unknown> {
  const empty =
    value === undefined || value === '' || (field.kind === 'boolean' && value === false);
  if (empty && !field.required) {
    const { [field.name]: _removed, ...rest } = record;
    return rest;
  }
  return { ...record, [field.name]: value };
}

export type GalleryEdit =
  | { action: 'set'; index: number; item: Record<string, unknown> }
  | { action: 'add' }
  | { action: 'remove'; index: number }
  | { action: 'move'; index: number; step: 1 | -1 };

/** Gallery item edits, kept within 1..`galleryItems`. Returns the block unchanged when refused. */
export function editGallery(block: MediaBlockValue, edit: GalleryEdit): MediaBlockValue {
  const items = Array.isArray(block.items) ? [...block.items] : [];
  if (edit.action === 'add') {
    if (items.length >= L.galleryItems) return block;
    items.push({ ...SAMPLE_ITEM });
  } else {
    if (edit.index < 0 || edit.index >= items.length) return block;
    if (edit.action === 'set') items[edit.index] = edit.item;
    else if (edit.action === 'remove') {
      if (items.length <= 1) return block;
      items.splice(edit.index, 1);
    } else {
      const to = edit.index + edit.step;
      if (to < 0 || to >= items.length) return block;
      const [moved] = items.splice(edit.index, 1);
      items.splice(to, 0, moved);
    }
  }
  return { ...block, items };
}

export interface MediaIssue {
  /** Field key: `src`, or `items.<index>.<field>` inside a gallery. */
  field: string;
  message: string;
}

/** The media family parser's verdict on the whole block (it stops at the first problem). */
export function validateMediaBlock(block: unknown): MediaIssue[] {
  const result = checkMediaBlock(block);
  if (result.ok) return [];
  return result.issues.map((issue) => ({
    field: issue.path.length ? issue.path.join('.') : 'type',
    message: issue.message,
  }));
}

export type BlockSourceKind = 'avatar' | 'data' | 'relative';

export const BLOCK_SOURCE_LABELS: Readonly<Record<BlockSourceKind, string>> = Object.freeze({
  avatar: 'Avatar',
  data: 'Embedded file',
  relative: 'Relative path',
});

/** Fictional avatar ids the parser accepts: av-001 … av-175. */
export const AVATAR_IDS: readonly string[] = Object.freeze(
  Array.from({ length: 175 }, (_, index) => `av-${String(index + 1).padStart(3, '0')}`)
);

/** The kinds a source can be: avatars are images only. */
export function sourceKindsFor(media: MediaKind): readonly BlockSourceKind[] {
  return media === 'image' ? ['avatar', 'data', 'relative'] : ['data', 'relative'];
}

/** Which kind a stored source looks like (for the picker's initial choice). */
export function blockSourceKindOf(value: unknown): BlockSourceKind {
  if (typeof value !== 'string') return 'relative';
  if (value.startsWith('avatar:')) return 'avatar';
  if (value.startsWith('data:')) return 'data';
  return 'relative';
}

export type BlockSourceReading =
  | { ok: true; kind: BlockSourceKind; bytes: number }
  | { ok: false; message: string };

/** The block parser's own verdict on one source. */
export function readBlockSource(value: unknown, media: MediaKind): BlockSourceReading {
  if (typeof value !== 'string' || value === '') {
    return { ok: false, message: 'Choose a source.' };
  }
  return classifyMediaSource(value, media);
}

/** The data types an embedded file may have, per media kind (the parser's list). */
export const EMBED_TYPES: Readonly<Record<MediaKind, readonly string[]>> = Object.freeze({
  image: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
  video: ['video/mp4', 'video/webm'],
});

/** A file's bytes as a base64 data URI (no network, no object URL). */
export function dataUriOf(bytes: Uint8Array, type: string): string {
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return `data:${type};base64,${btoa(binary)}`;
}

/** A source shown as short text: long data URIs are summarized, never echoed whole. */
export function describeSource(value: unknown): string {
  if (typeof value !== 'string') return '';
  if (value.startsWith('data:')) {
    const type = /^data:([^;,]+)/.exec(value)?.[1] ?? 'unknown type';
    const payload = value.slice(value.indexOf(',') + 1);
    const kb = Math.ceil(base64DecodedBytes(payload) / 1024);
    return `${type}, about ${kb} KB`;
  }
  return value.length > 80 ? `${value.slice(0, 80)}…` : value;
}
