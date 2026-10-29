import { createSecret, isSecret, type Secret } from '../keys.ts';
import type { ProviderErrorCode, ProviderEvent } from '../provider.ts';
import { readSse, SseLimitError, type SseMessage } from './sse.ts';

/**
 * What every HTTP adapter shares: explicit options (no environment, no
 * files), the key wrapped as a redacting `Secret` from the first moment,
 * one `fetch` per call with the caller's abort signal and a deadline, and
 * HTTP failures mapped to typed, `retryable` provider errors. Error
 * messages name the status or the provider's error type only; response
 * bodies and the key never reach a message.
 */

export interface HttpProviderOptions {
  /**
   * The provider key, passed in by the host at run time (read from the
   * platform's secret store or the operator file by the host, never by the
   * adapter). Wrapped as a `Secret` at once; only the request reveals it.
   */
  apiKey: string | Secret;
  /** The provider's model name, e.g. from the developer's configuration. */
  model: string;
  /** The API origin (or base path). Each adapter has the documented default. */
  baseUrl?: string;
  /** Output token ceiling per call. */
  maxTokens?: number;
  /** Deadline per call, in milliseconds. Default 120,000. */
  timeoutMs?: number;
  /** The fetch to use; tests pass a fake one. Default `globalThis.fetch`. */
  fetch?: typeof fetch;
  /** Receipt label. Default `<adapter>/<model>`. */
  label?: string;
}

export interface ResolvedHttpOptions {
  key: Secret;
  model: string;
  baseUrl: string;
  maxTokens: number;
  timeoutMs: number;
  fetch: typeof fetch;
  label: string;
}

export const DEFAULT_TIMEOUT_MS = 120_000;
export const DEFAULT_MAX_TOKENS = 4096;
const MODEL = /^[A-Za-z0-9][A-Za-z0-9._:/@-]{0,127}$/;

export function resolveHttpOptions(
  options: HttpProviderOptions,
  adapter: string,
  defaultBaseUrl: string
): ResolvedHttpOptions {
  const key = isSecret(options.apiKey)
    ? options.apiKey
    : typeof options.apiKey === 'string' && options.apiKey.trim() !== ''
      ? createSecret(options.apiKey)
      : null;
  // The message never repeats what was passed.
  if (key === null) throw new TypeError(`${adapter}: apiKey is required.`);
  if (typeof options.model !== 'string' || !MODEL.test(options.model)) {
    throw new TypeError(`${adapter}: model must be a model name.`);
  }
  const baseUrl = (options.baseUrl ?? defaultBaseUrl).replace(/\/+$/, '');
  const url = new URL(baseUrl);
  // A key only travels over TLS (a local test server on loopback is the exception).
  const loopback = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) {
    throw new TypeError(`${adapter}: baseUrl must be https.`);
  }
  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new TypeError(`${adapter}: no fetch available.`);
  return {
    key,
    model: options.model,
    baseUrl,
    maxTokens: Math.max(1, Math.floor(options.maxTokens ?? DEFAULT_MAX_TOKENS)),
    timeoutMs: Math.max(1, Math.floor(options.timeoutMs ?? DEFAULT_TIMEOUT_MS)),
    fetch: fetchImpl,
    label: options.label ?? `${adapter}/${options.model}`,
  };
}

export const providerError = (
  code: ProviderErrorCode,
  message: string,
  retryable: boolean
): ProviderEvent => ({ type: 'error', code, message, retryable });

/** An HTTP status as a typed error: 408, 409, 429 and 5xx may pass on a retry. */
export function statusError(status: number): ProviderEvent {
  if (status === 429) return providerError('rate-limited', 'HTTP 429 from the provider.', true);
  if (status === 401 || status === 403) {
    return providerError('auth', `HTTP ${status}: the provider refused the key.`, false);
  }
  if (status === 408) return providerError('timeout', 'HTTP 408 from the provider.', true);
  if (status === 409) return providerError('overloaded', 'HTTP 409 from the provider.', true);
  if (status >= 500) return providerError('overloaded', `HTTP ${status} from the provider.`, true);
  return providerError('bad-request', `HTTP ${status} from the provider.`, false);
}

/** A provider's error type, reduced to a short token (never free text). */
export function errorType(value: unknown): string {
  return typeof value === 'string' && /^[a-z][a-z0-9_.-]{0,63}$/.test(value) ? value : 'unknown';
}

/** Parse one SSE data payload; `undefined` when it is not JSON. */
export function parseData(data: string): unknown {
  try {
    return JSON.parse(data);
  } catch {
    return undefined;
  }
}

export interface StreamCall {
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

/**
 * POST `call` and yield its server-sent messages; on failure, yield one
 * typed error event instead (as `{ error }`). A caller abort ends quietly.
 */
export async function* streamCall(
  options: ResolvedHttpOptions,
  call: StreamCall,
  signal: AbortSignal | undefined
): AsyncGenerator<{ message: SseMessage } | { error: ProviderEvent }> {
  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(), options.timeoutMs);
  const onAbort = () => deadline.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  const timedOut = () => deadline.signal.aborted && signal?.aborted !== true;
  try {
    let response: Response;
    try {
      response = await options.fetch(call.url, {
        method: 'POST',
        headers: call.headers,
        body: JSON.stringify(call.body),
        signal: deadline.signal,
      });
    } catch {
      if (signal?.aborted) return;
      yield {
        error: timedOut()
          ? providerError('timeout', 'The provider did not answer in time.', true)
          : providerError('network', 'The provider could not be reached.', true),
      };
      return;
    }
    if (!response.ok) {
      // The body is never read into a message: it may echo request data.
      await response.body?.cancel().catch(() => undefined);
      yield { error: statusError(response.status) };
      return;
    }
    const type = response.headers.get('content-type') ?? '';
    if (!response.body || !type.includes('text/event-stream')) {
      await response.body?.cancel().catch(() => undefined);
      yield { error: providerError('protocol', 'The provider did not stream events.', false) };
      return;
    }
    try {
      for await (const message of readSse(response.body)) yield { message };
    } catch (cause) {
      if (signal?.aborted) return;
      yield {
        error:
          cause instanceof SseLimitError
            ? providerError('protocol', 'The provider stream broke a size limit.', false)
            : timedOut()
              ? providerError('timeout', 'The provider stream timed out.', true)
              : providerError('interrupted', 'The provider stream dropped.', true),
      };
    }
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/** Incremental usage from cumulative counts (providers report running totals). */
export function createUsageMeter(): {
  report(input: unknown, output: unknown): ProviderEvent | null;
} {
  let seenIn = 0;
  let seenOut = 0;
  const count = (value: unknown, seen: number) =>
    typeof value === 'number' && Number.isFinite(value) && value > seen ? Math.floor(value) : seen;
  return {
    report(input, output) {
      const nextIn = count(input, seenIn);
      const nextOut = count(output, seenOut);
      const event: ProviderEvent | null =
        nextIn > seenIn || nextOut > seenOut
          ? { type: 'usage', inputTokens: nextIn - seenIn, outputTokens: nextOut - seenOut }
          : null;
      seenIn = nextIn;
      seenOut = nextOut;
      return event;
    },
  };
}

/** Our `tool` turns (repair diagnostics) as plain user text: no provider tool ids are kept. */
export function toolTurnText(text: string): string {
  return `Validation result of your last tool call:\n${text}`;
}
