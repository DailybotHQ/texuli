/**
 * The provider seam (agent-service design §7): one interface, one adapter
 * per provider. The service, validator, quotas and evals never import a
 * provider SDK. The only adapter here is the fake replay adapter; a real
 * one would read its key at run time from outside the repository and is a
 * developer decision.
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

export type ProviderEvent =
  | { type: 'text'; text: string }
  | { type: 'tool'; name: string; input: unknown }
  /** Incremental provider-reported counts for this event; totals accrue across calls. */
  | { type: 'usage'; inputTokens: number; outputTokens: number }
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

/** A recorded call can return events or inject a stable provider failure. */
export type FakeCall =
  | readonly ProviderEvent[]
  | {
      events?: readonly ProviderEvent[];
      /** Fail after the listed events; timeout is injected without wall-clock timers. */
      outcome: 'failure' | 'timeout';
    };

function isInjectedOutcome(
  call: FakeCall
): call is { events?: readonly ProviderEvent[]; outcome: 'failure' | 'timeout' } {
  return !Array.isArray(call);
}

/**
 * Replays recorded model output. A prompt without a recording gets
 * `fallback` (or a short apology and no tool call). The replay is keyed by
 * the latest user prompt and counts tool turns to pick the call, so a
 * repair replays the next recorded call. No network, no key.
 */
export function createFakeProvider(
  recordings: readonly Recording[],
  options: { label?: string; fallback?: readonly ProviderEvent[] } = {}
): Provider {
  const byPrompt = new Map(recordings.map((r) => [r.prompt.trim(), r]));
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
      const events = isInjectedOutcome(call) ? (call.events ?? []) : call;
      for (const event of events) {
        if (request.signal?.aborted) return;
        yield event;
      }
      if (isInjectedOutcome(call) && request.signal?.aborted !== true) {
        if (call.outcome === 'timeout') {
          throw new Error('Fake provider timed out.');
        }
        throw new Error('Fake provider failed.');
      }
      yield { type: 'done' };
    },
  };
}

/** Backwards-compatible name for the deterministic fake recorder. */
export const createReplayProvider = createFakeProvider;
