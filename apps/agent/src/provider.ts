/**
 * The provider seam (agent-service design §7, ADR-014): one interface, one
 * adapter per provider. The service, validator, quotas and evals never
 * import a provider SDK. A provider turns one request into an async stream
 * of typed events: model text (`text-delta`), blueprint JSON as it is
 * written (`tool-delta`, or a whole `tool` call), `usage`, then `done` or a
 * typed `error` with a `retryable` flag.
 *
 * The fake replay adapter here is what tests, evals and the dev server use.
 * The real adapters (`src/providers/`) speak documented HTTP streaming APIs
 * through `fetch`; they take their key from the host at run time and read
 * no file and no environment. Using one is a developer decision.
 */

export interface ProviderMessage {
  role: 'user' | 'assistant' | 'tool';
  text: string;
}

export interface ProviderRequest {
  system: string;
  /** Plain JSON Schema tool definitions; an adapter wraps them for its provider. */
  tools: readonly { name: string; description: string; inputSchema: unknown }[];
  messages: readonly ProviderMessage[];
  signal?: AbortSignal;
}

/** Why a provider call stopped early. */
export type ProviderErrorCode =
  /** The provider asked to slow down (HTTP 429). */
  | 'rate-limited'
  /** The provider is overloaded or failing (HTTP 5xx, an overloaded stream error). */
  | 'overloaded'
  /** The key was refused (HTTP 401 or 403). */
  | 'auth'
  /** The provider refused the request itself (another HTTP 4xx). */
  | 'bad-request'
  /** `fetch` failed before a response (DNS, TLS, reset). */
  | 'network'
  /** The adapter's own deadline passed. */
  | 'timeout'
  /** The response was not the documented stream shape. */
  | 'protocol'
  /** The stream ended before the provider said it was complete. */
  | 'interrupted';

export type ProviderEvent =
  /** Model text, whole (recordings made before ADR-014). Treated as a `text-delta`. */
  | { type: 'text'; text: string }
  /** A piece of model text. */
  | { type: 'text-delta'; text: string }
  /** A whole tool call (recordings, or a provider that does not stream tool input). */
  | { type: 'tool'; name: string; input: unknown }
  /**
   * A piece of a tool call's JSON input, as the model writes it. Pieces of
   * one call share a `callId`; concatenated, they are the input's JSON text.
   */
  | { type: 'tool-delta'; callId: string; name: string; text: string }
  /** Incremental provider-reported counts for this event; totals accrue across calls. */
  | { type: 'usage'; inputTokens: number; outputTokens: number }
  /** The call stopped. `retryable` says whether the same request may succeed later. */
  | { type: 'error'; code: ProviderErrorCode; message: string; retryable: boolean }
  | { type: 'done' };

export interface Provider {
  /** Provider and model label shown in receipts. */
  readonly label: string;
  generate(request: ProviderRequest): AsyncIterable<ProviderEvent>;
}

/** One recorded conversation: the events of each model call, in order. */
export interface Recording {
  /** The prompt this recording answers (exact match after trimming). */
  prompt: string;
  /** Call `i` replays `calls[i]` (the first call, then each repair). */
  calls: readonly FakeCall[];
}

/** An injected stop at the end of a recorded call (or at `cutAt`). */
export interface InjectedOutcome {
  events?: readonly ProviderEvent[];
  /**
   * `failure` and `timeout` throw (a dropped connection, no wall-clock
   * timers); `error` yields a typed `error` event with `retryable`.
   */
  outcome: 'failure' | 'timeout' | 'error';
  /** For `error`: the code (default `overloaded`) and whether a retry may succeed (default true). */
  code?: ProviderErrorCode;
  retryable?: boolean;
  /**
   * Stop after this many UTF-16 code units of streamed tool JSON (an
   * interruption mid-draft). Applies when the provider streams tool input.
   */
  cutAt?: number;
}

/** A recorded call can return events or inject a stable provider failure. */
export type FakeCall = readonly ProviderEvent[] | InjectedOutcome;

export interface FakeProviderOptions {
  label?: string;
  fallback?: readonly ProviderEvent[];
  /**
   * Stream recorded `tool` calls as `tool-delta` events of this many UTF-16
   * code units (a list cycles, so tests can split anywhere). The JSON text
   * is the canonical one ({@link canonicalJson}: `children` last). Absent
   * or 0: whole `tool` events, as recorded.
   */
  chunkSize?: number | readonly number[];
  /** Split text events into `text-delta` events of the same sizes too. Default false. */
  chunkText?: boolean;
  /** Wait this long before each event (deterministic with an injected `sleep`). */
  latencyMs?: number;
  /** The wait; default a timer that the request's signal cancels. */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

function isInjectedOutcome(call: FakeCall): call is InjectedOutcome {
  return !Array.isArray(call);
}

/**
 * JSON text in the streaming canonical order (ADR-014): in every object
 * with a `children` member, `children` comes last, so a streamed node's
 * shell is final as soon as its children start. Other members keep their
 * order. Values are otherwise what `JSON.stringify` writes.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, current: unknown) => {
    if (
      current === null ||
      typeof current !== 'object' ||
      Array.isArray(current) ||
      !Object.hasOwn(current, 'children')
    ) {
      return current;
    }
    const record = current as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(record)) if (key !== 'children') out[key] = record[key];
    out.children = record.children;
    return out;
  });
}

/** Deterministic pieces of `text`: sizes from `sizes`, cycling; a size below 1 counts as 1. */
export function chunkText(text: string, sizes: number | readonly number[]): string[] {
  const list = typeof sizes === 'number' ? [sizes] : sizes.length > 0 ? sizes : [text.length];
  const out: string[] = [];
  let at = 0;
  let turn = 0;
  while (at < text.length) {
    const size = Math.max(1, Math.floor(list[turn % list.length] ?? 1));
    out.push(text.slice(at, at + size));
    at += size;
    turn += 1;
  }
  return out;
}

const defaultSleep = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    if (ms <= 0 || signal?.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve();
    }
    signal?.addEventListener('abort', done, { once: true });
  });

/**
 * Replays recorded model output. A prompt without a recording gets
 * `fallback` (or a short apology and no tool call). The replay is keyed by
 * the latest user prompt and counts tool turns to pick the call, so a
 * repair replays the next recorded call. With `chunkSize`, recorded tool
 * calls stream as `tool-delta` pieces; `latencyMs` paces every event; an
 * injected outcome stops the call (at `cutAt` code units of tool JSON when
 * streaming). No network, no key.
 */
export function createFakeProvider(
  recordings: readonly Recording[],
  options: FakeProviderOptions = {}
): Provider {
  const byPrompt = new Map(recordings.map((r) => [r.prompt.trim(), r]));
  const streaming =
    options.chunkSize !== undefined &&
    (typeof options.chunkSize === 'number' ? options.chunkSize > 0 : options.chunkSize.length > 0);
  const sleep = options.sleep ?? defaultSleep;
  const latency = Math.max(0, options.latencyMs ?? 0);
  let calls = 0;
  return {
    label: options.label ?? 'replay/fake',
    async *generate(request) {
      const lastUser = [...request.messages].reverse().find((m) => m.role === 'user');
      const recording = lastUser ? byPrompt.get(lastUser.text.trim()) : undefined;
      // Each repair adds one tool message after the last user turn.
      const lastUserIndex = lastUser ? request.messages.lastIndexOf(lastUser) : -1;
      const repairs = request.messages
        .slice(lastUserIndex + 1)
        .filter((m) => m.role === 'tool').length;
      const call = recording
        ? (recording.calls[Math.min(repairs, recording.calls.length - 1)] ?? [])
        : (options.fallback ?? [{ type: 'text', text: 'No recorded answer for this prompt.' }]);
      const injected = isInjectedOutcome(call) ? call : null;
      const recorded = injected ? (injected.events ?? []) : (call as readonly ProviderEvent[]);
      calls += 1;
      const callId = `fake-call-${calls}`;
      // Tool JSON streamed so far in this call, for `cutAt`.
      let streamed = 0;
      let cut = false;

      const expand = (event: ProviderEvent): ProviderEvent[] => {
        if (!streaming) return [event];
        if (event.type === 'tool') {
          const pieces = chunkText(canonicalJson(event.input), options.chunkSize ?? 0);
          return pieces.map((text) => ({ type: 'tool-delta', callId, name: event.name, text }));
        }
        if (options.chunkText && (event.type === 'text' || event.type === 'text-delta')) {
          return chunkText(event.text, options.chunkSize ?? 0).map((text) => ({
            type: 'text-delta',
            text,
          }));
        }
        return [event];
      };

      outer: for (const recordedEvent of recorded) {
        for (const event of expand(recordedEvent)) {
          if (request.signal?.aborted) return;
          if (event.type === 'tool-delta' && injected?.cutAt !== undefined) {
            const room = injected.cutAt - streamed;
            if (room <= 0) {
              cut = true;
              break outer;
            }
            if (event.text.length > room) {
              if (latency > 0) await sleep(latency, request.signal);
              if (request.signal?.aborted) return;
              yield { ...event, text: event.text.slice(0, room) };
              streamed += room;
              cut = true;
              break outer;
            }
            streamed += event.text.length;
          }
          if (latency > 0) await sleep(latency, request.signal);
          if (request.signal?.aborted) return;
          yield event;
        }
      }
      if (injected && request.signal?.aborted !== true) {
        if (injected.outcome === 'error') {
          yield {
            type: 'error',
            code: injected.code ?? 'overloaded',
            message: cut ? 'Fake provider stopped mid-draft.' : 'Fake provider reported an error.',
            retryable: injected.retryable ?? true,
          };
          return;
        }
        if (injected.outcome === 'timeout') throw new Error('Fake provider timed out.');
        throw new Error(cut ? 'Fake provider dropped the connection.' : 'Fake provider failed.');
      }
      yield { type: 'done' };
    },
  };
}

/** Backwards-compatible name for the deterministic fake recorder. */
export const createReplayProvider = createFakeProvider;
