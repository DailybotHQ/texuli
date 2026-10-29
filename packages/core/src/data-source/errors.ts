/**
 * The typed error model of data sources. Every failure is a `SourceError`
 * with a closed code, a `retryable` flag and a user-facing `messageKey`;
 * its `message` is for developers and is never shown to people. Adapters
 * throw `sourceError(code)` to say what went wrong; anything else they
 * throw becomes `failed` (not retryable), and its text stays in `cause`.
 */

import type { SourceQueryIssue } from './query.ts';

export const SOURCE_ERROR_CODES = [
  'unknown-source',
  'unsupported',
  'invalid-query',
  'invalid-input',
  'invalid-response',
  'not-found',
  'conflict',
  'unauthorized',
  'forbidden',
  'rate-limited',
  'timeout',
  'network',
  'unavailable',
  'aborted',
  'failed',
] as const;
export type SourceErrorCode = (typeof SOURCE_ERROR_CODES)[number];

/** Codes a retry may fix. The loader retries these with backoff (reads only). */
export const RETRYABLE_SOURCE_ERRORS: readonly SourceErrorCode[] = Object.freeze([
  'rate-limited',
  'timeout',
  'network',
  'unavailable',
]);

/**
 * Codes that describe the view's own request (a source the host never
 * registered, a refused query or input, a cancelled call): asking again
 * cannot help, so a view offers no retry for them.
 */
export const FINAL_SOURCE_ERRORS: readonly SourceErrorCode[] = Object.freeze([
  'unknown-source',
  'unsupported',
  'invalid-query',
  'invalid-input',
  'aborted',
]);

/** Whether a person asking again may help (a retry button), unlike `retryable` (automatic retries). */
export function canRetrySourceError(error: Pick<SourceError, 'code'>): boolean {
  return !FINAL_SOURCE_ERRORS.includes(error.code);
}

/** The i18n key of an error's user-facing message: `dataSource.error.<code>`. */
export type SourceErrorMessageKey = `dataSource.error.${SourceErrorCode}`;

export interface SourceError extends Error {
  readonly name: 'SourceError';
  readonly code: SourceErrorCode;
  readonly retryable: boolean;
  readonly messageKey: SourceErrorMessageKey;
  /** The source the operation addressed, when known. */
  readonly source?: string;
  /** Query or input issues (`invalid-query`, `invalid-input`). */
  readonly issues?: readonly SourceQueryIssue[];
  /** A server's retry hint for `rate-limited` or `unavailable`, in milliseconds. */
  readonly retryAfterMs?: number;
}

/** English defaults for every message key; hosts translate by key. */
export const SOURCE_ERROR_MESSAGES: Readonly<Record<SourceErrorMessageKey, string>> = Object.freeze(
  {
    'dataSource.error.unknown-source': 'This data is not available here.',
    'dataSource.error.unsupported': 'This data cannot be changed here.',
    'dataSource.error.invalid-query': 'This view asks for data in a way the source does not allow.',
    'dataSource.error.invalid-input': 'Some values are not valid.',
    'dataSource.error.invalid-response': 'The data that came back could not be read.',
    'dataSource.error.not-found': 'This item no longer exists.',
    'dataSource.error.conflict': 'Someone else changed this item. Reload and try again.',
    'dataSource.error.unauthorized': 'Sign in to see this data.',
    'dataSource.error.forbidden': 'You do not have access to this data.',
    'dataSource.error.rate-limited': 'Too many requests. Try again in a moment.',
    'dataSource.error.timeout': 'Loading took too long.',
    'dataSource.error.network': 'The connection was lost.',
    'dataSource.error.unavailable': 'The data source is unavailable right now.',
    'dataSource.error.aborted': 'Loading was cancelled.',
    'dataSource.error.failed': 'Something went wrong loading this data.',
  }
);

const BRAND = new WeakSet<object>();

export interface SourceErrorInit {
  /** Developer-facing detail. Never shown to people. */
  message?: string;
  /** Overrides the code's default (`RETRYABLE_SOURCE_ERRORS`). */
  retryable?: boolean;
  source?: string;
  issues?: readonly SourceQueryIssue[];
  retryAfterMs?: number;
  cause?: unknown;
}

/** Make a typed source error. Adapters throw these; the loader recognizes only these. */
export function sourceError(code: SourceErrorCode, init: SourceErrorInit = {}): SourceError {
  const known = (SOURCE_ERROR_CODES as readonly string[]).includes(code);
  const safe: SourceErrorCode = known ? code : 'failed';
  const error = new Error(init.message ?? `Data source error: ${safe}.`, {
    ...(init.cause === undefined ? {} : { cause: init.cause }),
  });
  const retryAfter =
    typeof init.retryAfterMs === 'number' &&
    Number.isFinite(init.retryAfterMs) &&
    init.retryAfterMs >= 0
      ? init.retryAfterMs
      : undefined;
  Object.defineProperties(error, {
    name: { value: 'SourceError', enumerable: false },
    code: { value: safe, enumerable: true },
    retryable: {
      value: init.retryable ?? RETRYABLE_SOURCE_ERRORS.includes(safe),
      enumerable: true,
    },
    messageKey: { value: `dataSource.error.${safe}`, enumerable: true },
    ...(init.source === undefined ? {} : { source: { value: init.source, enumerable: true } }),
    ...(init.issues === undefined
      ? {}
      : { issues: { value: Object.freeze([...init.issues]), enumerable: true } }),
    ...(retryAfter === undefined ? {} : { retryAfterMs: { value: retryAfter, enumerable: true } }),
  });
  BRAND.add(error);
  return Object.freeze(error) as SourceError;
}

/** Whether `value` was made by {@link sourceError} (a look-alike object is not). */
export function isSourceError(value: unknown): value is SourceError {
  return typeof value === 'object' && value !== null && BRAND.has(value);
}

function isAbort(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { name?: unknown }).name === 'AbortError'
  );
}

/**
 * Whatever an adapter threw, as a source error: a `sourceError` keeps its
 * code (and gains the source name), an `AbortError` is `aborted`, and
 * anything else is `failed` with the original in `cause`.
 */
export function toSourceError(thrown: unknown, source?: string): SourceError {
  if (isSourceError(thrown)) {
    if (source === undefined || thrown.source !== undefined) return thrown;
    return sourceError(thrown.code, {
      message: thrown.message,
      retryable: thrown.retryable,
      source,
      ...(thrown.issues ? { issues: thrown.issues } : {}),
      ...(thrown.retryAfterMs === undefined ? {} : { retryAfterMs: thrown.retryAfterMs }),
      cause: thrown.cause,
    });
  }
  if (isAbort(thrown)) {
    return sourceError('aborted', { ...(source === undefined ? {} : { source }), cause: thrown });
  }
  return sourceError('failed', {
    message: 'The data source failed.',
    ...(source === undefined ? {} : { source }),
    cause: thrown,
  });
}

/** The user-facing English default of an error (hosts translate `messageKey` instead). */
export function sourceErrorMessage(
  error: Pick<SourceError, 'messageKey'>,
  messages: Partial<Record<SourceErrorMessageKey, string>> = {}
): string {
  const key = error.messageKey;
  return (
    (Object.hasOwn(messages, key) ? messages[key] : undefined) ??
    SOURCE_ERROR_MESSAGES[key] ??
    SOURCE_ERROR_MESSAGES['dataSource.error.failed']
  );
}
