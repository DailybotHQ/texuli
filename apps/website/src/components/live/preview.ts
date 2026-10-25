/**
 * The isolated preview document: one static route that mounts a live stage
 * full-page, so a demo owns its theme, direction, landmarks and overlays.
 * The embedding page talks to it with same-origin `postMessage`.
 */
/** The preview route, under the site base path (`TEXULI_SITE_BASE`). */
export const PREVIEW_PATH = `${(import.meta.env?.BASE_URL ?? '/').replace(/\/$/, '')}/gallery-components/preview/`;
export const PREVIEW_READY = 'texuli:preview-ready';
export const PREVIEW_STATE = 'texuli:preview-state';
/** The preview reports its content height so the frame can grow to fit it. */
export const PREVIEW_SIZE = 'texuli:preview-size';
/** The tallest a preview frame grows; taller content scrolls inside it. */
export const PREVIEW_MAX_HEIGHT = 720;

export type PreviewMode = 'light' | 'dark';
export type PreviewDir = 'ltr' | 'rtl';
export type PreviewValue = string | number | boolean;
export type PreviewState = {
  values: Record<string, PreviewValue>;
  mode: PreviewMode;
  dir: PreviewDir;
};

/** Props a preview never takes from a message: URLs, identity and markup hooks. */
const BLOCKED = new Set([
  'actionHref',
  'class',
  'className',
  'href',
  'hrefTrust',
  'id',
  'name',
  'src',
  'srcset',
  'style',
  'trust',
  'wrapperClass',
]);
const KEY = /^[a-z][A-Za-z0-9]{0,39}$/;
const MAX_KEYS = 32;
const MAX_STRING = 200;

/** Primitive, size-capped values only; anything else is dropped. */
export function sanitizePreviewValues(input: unknown): Record<string, PreviewValue> {
  const out: Record<string, PreviewValue> = {};
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return out;
  for (const [key, value] of Object.entries(input)) {
    if (Object.keys(out).length >= MAX_KEYS) break;
    if (!KEY.test(key) || BLOCKED.has(key) || key.startsWith('on')) continue;
    if (typeof value === 'boolean') out[key] = value;
    else if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
    else if (typeof value === 'string') out[key] = value.slice(0, MAX_STRING);
  }
  return out;
}

export function sanitizePreviewState(input: unknown): PreviewState | null {
  if (input === null || typeof input !== 'object') return null;
  const state = input as Record<string, unknown>;
  return {
    values: sanitizePreviewValues(state.values),
    mode: state.mode === 'dark' ? 'dark' : 'light',
    dir: state.dir === 'rtl' ? 'rtl' : 'ltr',
  };
}

/** The preview URL for a catalog id. Mode and direction apply before first paint. */
export function previewUrl(id: string, mode: PreviewMode, dir: PreviewDir): string {
  const query = new URLSearchParams({ id, mode, dir });
  return `${PREVIEW_PATH}?${query.toString()}`;
}
