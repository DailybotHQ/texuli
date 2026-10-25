/**
 * Deterministic, SSR-stable ids for Texuli components.
 *
 * Each {@link createIdScope} owns a counter and a stable prefix. Calling
 * `next()` in the same order on the server and again on the client yields the
 * same strings, so hydration matches SSR. There is no `Math.random`, no
 * `crypto.randomUUID`, and no module-scope counter shared across roots.
 *
 * Framework-free: pure functions, or helpers that take an element explicitly.
 */

/** Options for {@link createIdScope}. */
export type IdScopeOptions = {
  /**
   * Stable prefix for every id this scope issues. Default `"tx"`.
   * Sanitized to HTML-id-safe characters; empty input becomes `"tx"`.
   */
  prefix?: string;
  /**
   * First counter value used by `next()` (default `0`). After each call the
   * counter advances by one. Pass the same `start` on SSR and hydration.
   */
  start?: number;
};

/**
 * A per-root id factory. Create one scope per SSR/render root (or per
 * component tree that owns its own id namespace) and call `next` in a stable
 * order on server and client.
 */
export type IdScope = {
  /** Sanitized prefix used for every issued id. */
  readonly prefix: string;
  /**
   * Allocate the next id.
   * @param part Optional slot name (e.g. `"label"`, `"hint"`). Appended as
   *   `-{sanitized-part}` after the counter.
   */
  next: (part?: string) => string;
  /** Number of ids issued since create or last {@link IdScope.reset}. */
  readonly count: number;
  /** Current counter value that the next `next()` call will use. */
  readonly cursor: number;
  /** Reset the counter to the scope's original `start` (tests / re-render). */
  reset: () => void;
};

const DEFAULT_PREFIX = 'tx';

/**
 * Keep only characters that are safe inside an HTML `id` and a CSS selector
 * without escaping: ASCII letters, digits, hyphen, underscore. Leading digits
 * are prefixed with `_` so the result never starts with a number.
 */
export function sanitizeIdPart(value: string): string {
  const cleaned = value
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  if (cleaned === '') return '';
  if (/^[0-9]/.test(cleaned)) return `_${cleaned}`;
  return cleaned;
}

function resolvePrefix(prefix: string | undefined): string {
  if (prefix === undefined || prefix === '') return DEFAULT_PREFIX;
  const cleaned = sanitizeIdPart(prefix);
  return cleaned === '' ? DEFAULT_PREFIX : cleaned;
}

function resolveStart(start: number | undefined): number {
  if (start === undefined) return 0;
  if (!Number.isFinite(start) || start < 0) return 0;
  return Math.floor(start);
}

/**
 * Create a per-root id scope. Call this once per render root with the same
 * options on the server and on the client; issue ids with `next()` in the
 * same order on both sides.
 *
 * @example
 * const ids = createIdScope({ prefix: 'dialog' });
 * const titleId = ids.next('title'); // "dialog-0-title"
 * const descId = ids.next('desc');   // "dialog-1-desc"
 */
export function createIdScope(options: IdScopeOptions = {}): IdScope {
  const prefix = resolvePrefix(options.prefix);
  const start = resolveStart(options.start);
  let cursor = start;
  let count = 0;

  const scope: IdScope = {
    prefix,
    get count() {
      return count;
    },
    get cursor() {
      return cursor;
    },
    next(part?: string): string {
      const n = cursor;
      cursor += 1;
      count += 1;
      if (part === undefined || part === '') {
        return `${prefix}-${n}`;
      }
      const slot = sanitizeIdPart(part);
      return slot === '' ? `${prefix}-${n}` : `${prefix}-${n}-${slot}`;
    },
    reset(): void {
      cursor = start;
      count = 0;
    },
  };

  return scope;
}

/**
 * Build a family of related ids that share one counter value and differ by
 * part name. Useful for a control that needs label, description and error ids
 * from a single allocation. Consumes one counter step on `scope`.
 *
 * @example
 * const family = createIdFamily(ids, ['label', 'hint', 'error']);
 * // { label: "tx-0-label", hint: "tx-0-hint", error: "tx-0-error" }
 */
export function createIdFamily(scope: IdScope, parts: readonly string[]): Record<string, string> {
  const base = scope.next();
  const out: Record<string, string> = {};
  for (const part of parts) {
    const slot = sanitizeIdPart(part);
    if (slot === '') continue;
    out[part] = `${base}-${slot}`;
  }
  return out;
}

type IdToken = string | null | undefined | false;

/**
 * Join id tokens into a space-separated string for `aria-labelledby`,
 * `aria-describedby` and `aria-controls`. Falsy and empty tokens are dropped.
 * Returns `undefined` when nothing remains so the attribute can be omitted.
 */
export function joinIds(...ids: IdToken[]): string | undefined {
  const parts: string[] = [];
  for (const id of ids) {
    if (typeof id !== 'string') continue;
    const trimmed = id.trim();
    if (trimmed === '') continue;
    parts.push(trimmed);
  }
  if (parts.length === 0) return undefined;
  return parts.join(' ');
}

/** Space-separated ids for `aria-labelledby`, or `undefined` when empty. */
export function ariaLabelledBy(...ids: IdToken[]): string | undefined {
  return joinIds(...ids);
}

/** Space-separated ids for `aria-describedby`, or `undefined` when empty. */
export function ariaDescribedBy(...ids: IdToken[]): string | undefined {
  return joinIds(...ids);
}

/** Space-separated ids for `aria-controls`, or `undefined` when empty. */
export function ariaControls(...ids: IdToken[]): string | undefined {
  return joinIds(...ids);
}

/**
 * Return the element's existing `id`, or assign and return a new one from the
 * scope when the element has no id. Takes the element explicitly (no global
 * document lookup).
 */
export function ensureElementId(element: Element, scope: IdScope, part?: string): string {
  const existing = element.getAttribute('id');
  if (existing !== null && existing.trim() !== '') {
    return existing;
  }
  const id = scope.next(part);
  element.setAttribute('id', id);
  return id;
}
