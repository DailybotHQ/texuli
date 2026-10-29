import { type HrefTrust, safeHref } from '../url/safe-href.ts';

/**
 * Host inline extensions (G48): closed, host-registered inline entities such
 * as mentions (`@{person-1|Ada}`) and references (`#{rec-7|Roadmap}`). In the
 * model an entity is an `extension` mark (`name` and `id`) over its label
 * text, so offsets, selections and transforms stay plain text. In Markdown
 * it is the delimiter grammar `<sigil>{<id>|<label>}`.
 *
 * The grammar is fixed and read in linear time: a host registers a name and
 * a sigil from a closed set, never a pattern. A host `accepts` check sees
 * only ids that already passed the bounded id charset; a host `href` is
 * always checked by the URL policy (`untrusted` by default).
 */

/** The sigils an extension can open with. */
export const EDITOR_EXTENSION_SIGILS = ['@', '#', '$', '%', '&', '+', '=', '^'] as const;
export type EditorExtensionSigil = (typeof EDITOR_EXTENSION_SIGILS)[number];

export const EDITOR_EXTENSION_LIMITS = Object.freeze({
  /** Registered extensions. */
  extensions: 16,
  /** Longest entity id: `[A-Za-z0-9_.:-]`. */
  id: 128,
  /** Longest label read from Markdown. */
  label: 512,
});

const NAME = /^[a-z][a-z0-9-]{0,31}$/;
const ID = /^[A-Za-z0-9_.:-]+$/;

/** The id charset, one character at a time (no regex on untrusted runs). */
export function isExtensionIdChar(code: number): boolean {
  return (
    (code >= 48 && code <= 58) || // 0-9 and ':'
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122) ||
    code === 95 || // _
    code === 46 || // .
    code === 45 // -
  );
}

export interface EditorInlineExtension {
  /** Stored on the mark: `[a-z][a-z0-9-]{0,31}`, unique in a registry. */
  name: string;
  /** Opens `<sigil>{id|label}`; one of `EDITOR_EXTENSION_SIGILS`, unique in a registry. */
  sigil: EditorExtensionSigil;
  /** Optional host check of an id that already passed the charset and length cap. */
  accepts?: (id: string) => boolean;
  /** Optional link for an entity; `extensionHref` checks it with the URL policy. */
  href?: (id: string) => string | undefined;
}

/** A validated, frozen set of extensions (from `createInlineExtensions`). */
export interface EditorInlineExtensions {
  readonly list: readonly EditorInlineExtension[];
  readonly bySigil: ReadonlyMap<string, EditorInlineExtension>;
  readonly byName: ReadonlyMap<string, EditorInlineExtension>;
  /** Characters that can start an inline construct, sigils included. Internal. */
  readonly special: RegExp;
  /** A sigil followed by `{` in plain text (escaped when written). Internal. */
  readonly literal: RegExp | null;
}

const BASE_SPECIAL = '\\\\\\n`*_~!\\[<';
const reEscape = (char: string) => char.replace(/[$^+\\]/g, '\\$&');

const EMPTY: EditorInlineExtensions = Object.freeze({
  list: Object.freeze([]) as readonly EditorInlineExtension[],
  bySigil: new Map(),
  byName: new Map(),
  special: new RegExp(`[${BASE_SPECIAL}]`, 'g'),
  literal: null,
});

/**
 * Validate a host's extensions once. Throws a `TypeError` on a bad name or
 * sigil, a duplicate, or more than 16 entries: these are developer errors.
 */
export function createInlineExtensions(
  list: readonly EditorInlineExtension[] = []
): EditorInlineExtensions {
  if (list.length === 0) return EMPTY;
  if (list.length > EDITOR_EXTENSION_LIMITS.extensions) throw new TypeError('Too many extensions.');
  const bySigil = new Map<string, EditorInlineExtension>();
  const byName = new Map<string, EditorInlineExtension>();
  for (const extension of list) {
    const { name, sigil } = extension ?? {};
    if (
      typeof name !== 'string' ||
      !NAME.test(name) ||
      !(EDITOR_EXTENSION_SIGILS as readonly string[]).includes(sigil) ||
      byName.has(name) ||
      bySigil.has(sigil)
    )
      throw new TypeError(`Bad or repeated inline extension "${String(name)}" (${String(sigil)}).`);
    const frozen = Object.freeze({ ...extension });
    byName.set(name, frozen);
    bySigil.set(sigil, frozen);
  }
  const sigils = [...bySigil.keys()].map(reEscape).join('');
  return Object.freeze({
    list: Object.freeze([...byName.values()]),
    bySigil,
    byName,
    special: new RegExp(`[${BASE_SPECIAL}${sigils}]`, 'g'),
    literal: new RegExp(`([${sigils}])\\{`, 'g'),
  });
}

/** A registry from either form; `undefined` gives the empty one. */
export function toInlineExtensions(
  value: EditorInlineExtensions | readonly EditorInlineExtension[] | undefined
): EditorInlineExtensions {
  if (!value) return EMPTY;
  return Array.isArray(value)
    ? createInlineExtensions(value as readonly EditorInlineExtension[])
    : (value as EditorInlineExtensions);
}

/** Whether `id` is a usable entity id for the registered `name`. */
export function acceptsExtensionId(
  registry: EditorInlineExtensions,
  name: unknown,
  id: unknown
): boolean {
  if (typeof name !== 'string' || typeof id !== 'string') return false;
  const extension = registry.byName.get(name);
  if (!extension || id.length === 0 || id.length > EDITOR_EXTENSION_LIMITS.id || !ID.test(id))
    return false;
  try {
    return extension.accepts ? extension.accepts(id) === true : true;
  } catch {
    return false;
  }
}

/**
 * The policy-checked link of an entity, or `undefined` when the extension
 * has no `href`, the host throws, or the URL policy refuses it. Untrusted by
 * default: entity ids come from agent or user content.
 */
export function extensionHref(
  registry: EditorInlineExtensions,
  mark: { name: string; id: string },
  trust: HrefTrust = 'untrusted'
): string | undefined {
  const extension = registry.byName.get(mark.name);
  if (!extension?.href || !acceptsExtensionId(registry, mark.name, mark.id)) return undefined;
  let href: unknown;
  try {
    href = extension.href(mark.id);
  } catch {
    return undefined;
  }
  return typeof href === 'string' ? safeHref(href, trust) : undefined;
}
