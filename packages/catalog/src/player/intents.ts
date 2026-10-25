import { safeHref } from '@texuli/core/url-policy';

/**
 * The closed intent set (player design, Phase 1, G02-lite). An intent is a
 * proposal the host confirms and applies; the player never performs it.
 * There is deliberately no "activate" intent: activation is host chrome.
 */
export const PLAYER_INTENT_KINDS = [
  'navigate',
  'open-artifact',
  'copy',
  'export',
  'request-fullscreen',
] as const;
export type PlayerIntentKind = (typeof PLAYER_INTENT_KINDS)[number];

export const PLAYER_EXPORT_FORMATS = ['pdf', 'png', 'json', 'csv'] as const;

/** Most intents one node may have waiting on the host at once. */
export const MAX_PENDING_INTENTS_PER_NODE = 4;
/** Longest `copy` text. */
export const MAX_COPY_TEXT = 4000;

export type PlayerIntentPayload =
  | { kind: 'navigate'; href: string }
  | { kind: 'open-artifact'; ref: string }
  | { kind: 'copy'; text: string }
  | { kind: 'export'; format: (typeof PLAYER_EXPORT_FORMATS)[number] }
  | { kind: 'request-fullscreen' };

export interface PlayerIntent {
  /** `intent-<n>`, unique within one player. */
  id: string;
  /** Render path of the node that proposed it. */
  path: string;
  /** Catalog id of that node. */
  componentId: string;
  payload: PlayerIntentPayload;
  status: 'pending' | 'confirmed' | 'rejected';
}

export type IntentCheck =
  | { ok: true; payload: PlayerIntentPayload }
  | { ok: false; reason: string };

const REF = /^[A-Za-z0-9._:-]{1,128}$/;
const FIELDS: Readonly<Record<PlayerIntentKind, readonly string[]>> = {
  navigate: ['kind', 'href'],
  'open-artifact': ['kind', 'ref'],
  copy: ['kind', 'text'],
  export: ['kind', 'format'],
  'request-fullscreen': ['kind'],
};

/**
 * Check an untrusted intent payload against the closed set: known kind, no
 * extra fields, and a `navigate` href the untrusted URL policy keeps (the
 * normalized URL is what the host receives).
 */
export function checkIntent(value: unknown): IntentCheck {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, reason: 'An intent must be an object with a "kind".' };
  }
  const record = value as Record<string, unknown>;
  const kind = record.kind;
  if (typeof kind !== 'string' || !Object.hasOwn(FIELDS, kind)) {
    return { ok: false, reason: `Unknown intent kind ${JSON.stringify(kind)}.` };
  }
  const fields = FIELDS[kind as PlayerIntentKind];
  const extra = Object.keys(record).find((key) => !fields.includes(key));
  if (extra !== undefined) return { ok: false, reason: `"${kind}" does not take "${extra}".` };
  switch (kind as PlayerIntentKind) {
    case 'navigate': {
      const href = typeof record.href === 'string' ? safeHref(record.href, 'untrusted') : undefined;
      return href
        ? { ok: true, payload: { kind: 'navigate', href } }
        : { ok: false, reason: 'The untrusted URL policy refuses this link.' };
    }
    case 'open-artifact':
      return typeof record.ref === 'string' && REF.test(record.ref)
        ? { ok: true, payload: { kind: 'open-artifact', ref: record.ref } }
        : { ok: false, reason: '"ref" must be a short artifact id.' };
    case 'copy':
      return typeof record.text === 'string' &&
        record.text.length > 0 &&
        record.text.length <= MAX_COPY_TEXT
        ? { ok: true, payload: { kind: 'copy', text: record.text } }
        : { ok: false, reason: `"text" must be 1–${MAX_COPY_TEXT} characters.` };
    case 'export':
      return (PLAYER_EXPORT_FORMATS as readonly unknown[]).includes(record.format)
        ? {
            ok: true,
            payload: {
              kind: 'export',
              format: record.format as (typeof PLAYER_EXPORT_FORMATS)[number],
            },
          }
        : { ok: false, reason: `"format" must be one of ${PLAYER_EXPORT_FORMATS.join(', ')}.` };
    case 'request-fullscreen':
      return { ok: true, payload: { kind: 'request-fullscreen' } };
  }
}
