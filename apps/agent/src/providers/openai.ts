import type { Provider, ProviderEvent, ProviderMessage, ProviderRequest } from '../provider.ts';
import {
  createUsageMeter,
  errorType,
  type HttpProviderOptions,
  parseData,
  providerError,
  resolveHttpOptions,
  streamCall,
  toolTurnText,
} from './http.ts';

/**
 * An OpenAI-compatible Chat Completions adapter (`POST
 * <baseUrl>/chat/completions` with `"stream": true` and
 * `stream_options.include_usage`), written against the documented
 * server-sent event stream with `fetch` and no SDK. Each `data:` line is a
 * `chat.completion.chunk`: `choices[0].delta.content` becomes `text-delta`,
 * `choices[0].delta.tool_calls[]` fragments (by `index`, the first carrying
 * `id` and `function.name`) become `tool-delta`, the final chunk's `usage`
 * is reported, and `data: [DONE]` ends the call. A stream that ends before
 * `[DONE]` is an `interrupted` error; an `error` object in a chunk is a
 * typed error.
 *
 * "Compatible" means any server with this documented shape; `baseUrl`
 * picks it. Nothing here reads the environment or a file: the host passes
 * the key at run time. The tests run it against recorded byte streams
 * through a fake `fetch`.
 */

export const OPENAI_DEFAULT_BASE_URL = 'https://api.openai.com/v1';

export type OpenAICompatibleProviderOptions = HttpProviderOptions;

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** The provider-neutral turns as chat messages: the system prompt first, `tool` turns as user text. */
export function toChatMessages(
  system: string,
  messages: readonly ProviderMessage[]
): ChatMessage[] {
  return [
    { role: 'system', content: system },
    ...messages.map(
      (message): ChatMessage => ({
        role: message.role === 'assistant' ? 'assistant' : 'user',
        content: message.role === 'tool' ? toolTurnText(message.text) : message.text,
      })
    ),
  ];
}

/** The request body for one call (exported for tests and audits). */
export function chatRequestBody(
  request: ProviderRequest,
  model: string,
  maxTokens: number
): Record<string, unknown> {
  return {
    model,
    stream: true,
    stream_options: { include_usage: true },
    max_tokens: maxTokens,
    messages: toChatMessages(request.system, request.messages),
    tools: request.tools.map((tool) => ({
      type: 'function',
      function: { name: tool.name, description: tool.description, parameters: tool.inputSchema },
    })),
  };
}

const RETRYABLE_TYPES = new Set(['server_error', 'rate_limit_exceeded', 'overloaded_error']);

const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

/** At most this many parallel tool calls are tracked per call; the service reads one. */
const MAX_TOOL_CALLS = 8;
/** Argument text buffered for calls whose name has not arrived yet. */
const MAX_PENDING_CHARS = 512 * 1024;

export function createOpenAICompatibleProvider(options: OpenAICompatibleProviderOptions): Provider {
  const resolved = resolveHttpOptions(options, 'openai-compatible', OPENAI_DEFAULT_BASE_URL);
  return {
    label: resolved.label,
    async *generate(request) {
      const usage = createUsageMeter();
      // Tool call index → its id, name, and argument text that arrived before the name.
      const calls = new Map<number, { callId: string; name: string; pending: string[] }>();
      let finished = false;
      let pendingChars = 0;
      for await (const item of streamCall(
        resolved,
        {
          url: `${resolved.baseUrl}/chat/completions`,
          headers: {
            'content-type': 'application/json',
            accept: 'text/event-stream',
            authorization: `Bearer ${resolved.key.reveal()}`,
          },
          body: chatRequestBody(request, resolved.model, resolved.maxTokens),
        },
        request.signal
      )) {
        if ('error' in item) {
          yield item.error;
          return;
        }
        const { data } = item.message;
        if (data.trim() === '[DONE]') {
          finished = true;
          break;
        }
        const parsed = parseData(data);
        if (parsed === undefined) {
          yield providerError('protocol', 'The provider sent a chunk that is not JSON.', false);
          return;
        }
        const chunk = record(parsed);
        if (chunk.error !== undefined) {
          const kind = errorType(record(chunk.error).type ?? record(chunk.error).code);
          yield providerError(
            kind === 'rate_limit_exceeded'
              ? 'rate-limited'
              : RETRYABLE_TYPES.has(kind)
                ? 'overloaded'
                : 'protocol',
            `The provider stream reported ${kind}.`,
            RETRYABLE_TYPES.has(kind)
          );
          return;
        }
        const out: ProviderEvent[] = [];
        const choices = Array.isArray(chunk.choices) ? chunk.choices : [];
        const delta = record(record(choices[0]).delta);
        if (typeof delta.content === 'string' && delta.content) {
          out.push({ type: 'text-delta', text: delta.content });
        }
        if (Array.isArray(delta.tool_calls)) {
          for (const fragment of delta.tool_calls) {
            const part = record(fragment);
            const index = Number.isInteger(part.index) ? (part.index as number) : 0;
            const fn = record(part.function);
            let call = calls.get(index);
            if (!call) {
              if (calls.size >= MAX_TOOL_CALLS) continue;
              call = {
                callId: typeof part.id === 'string' && part.id ? part.id : `call-${index}`,
                name: '',
                pending: [],
              };
              calls.set(index, call);
            }
            if (call.name === '' && typeof fn.name === 'string' && fn.name) {
              call.name = fn.name;
              for (const text of call.pending) {
                out.push({ type: 'tool-delta', callId: call.callId, name: call.name, text });
              }
              call.pending = [];
            }
            if (typeof fn.arguments === 'string' && fn.arguments) {
              if (call.name === '') {
                pendingChars += fn.arguments.length;
                if (pendingChars > MAX_PENDING_CHARS) {
                  yield providerError('protocol', 'A tool call never named its tool.', false);
                  return;
                }
                call.pending.push(fn.arguments);
              } else {
                out.push({
                  type: 'tool-delta',
                  callId: call.callId,
                  name: call.name,
                  text: fn.arguments,
                });
              }
            }
          }
        }
        const counts = record(chunk.usage);
        const metered = usage.report(counts.prompt_tokens, counts.completion_tokens);
        if (metered) out.push(metered);
        yield* out;
      }
      if (request.signal?.aborted) return;
      if (!finished) {
        yield providerError('interrupted', 'The provider stream ended before [DONE].', true);
        return;
      }
      yield { type: 'done' };
    },
  };
}
