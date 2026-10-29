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
 * An Anthropic Messages API adapter (`POST /v1/messages` with
 * `"stream": true`), written against the documented server-sent event
 * stream with `fetch` and no SDK: `message_start` (input usage),
 * `content_block_start` (a `text` or `tool_use` block, with the call id and
 * tool name), `content_block_delta` (`text_delta` text and `input_json_delta`
 * partial tool JSON), `message_delta` (running output usage),
 * `message_stop`, `ping` and `error`. Text becomes `text-delta`, tool JSON
 * becomes `tool-delta`, usage is reported incrementally, and a stream that
 * ends before `message_stop` is an `interrupted` error.
 *
 * Nothing here reads the environment or a file: the host passes the key at
 * run time. Calling it with a real key is a developer decision; the tests
 * run it against recorded byte streams through a fake `fetch`.
 */

export const ANTHROPIC_DEFAULT_BASE_URL = 'https://api.anthropic.com';
export const ANTHROPIC_API_VERSION = '2023-06-01';

export interface AnthropicProviderOptions extends HttpProviderOptions {
  /** The `anthropic-version` header. Default {@link ANTHROPIC_API_VERSION}. */
  apiVersion?: string;
}

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * The provider-neutral turns as Messages API turns: `tool` turns (repair
 * diagnostics) become user text, consecutive turns of one role merge, and
 * the conversation starts with a user turn.
 */
export function toAnthropicMessages(messages: readonly ProviderMessage[]): AnthropicMessage[] {
  const out: AnthropicMessage[] = [];
  for (const message of messages) {
    const role = message.role === 'assistant' ? 'assistant' : 'user';
    const content = message.role === 'tool' ? toolTurnText(message.text) : message.text;
    if (out.length === 0 && role === 'assistant') continue;
    const last = out[out.length - 1];
    if (last && last.role === role) last.content = `${last.content}\n\n${content}`;
    else out.push({ role, content });
  }
  return out;
}

/** The request body for one call (exported for tests and audits). */
export function anthropicRequestBody(
  request: ProviderRequest,
  model: string,
  maxTokens: number
): Record<string, unknown> {
  return {
    model,
    max_tokens: maxTokens,
    stream: true,
    system: request.system,
    messages: toAnthropicMessages(request.messages),
    tools: request.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    })),
  };
}

const RETRYABLE_STREAM_ERRORS = new Set(['overloaded_error', 'api_error', 'rate_limit_error']);

const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export function createAnthropicProvider(options: AnthropicProviderOptions): Provider {
  const resolved = resolveHttpOptions(options, 'anthropic', ANTHROPIC_DEFAULT_BASE_URL);
  const version = options.apiVersion ?? ANTHROPIC_API_VERSION;
  return {
    label: resolved.label,
    async *generate(request) {
      const usage = createUsageMeter();
      // Content block index → the tool call it carries.
      const toolBlocks = new Map<number, { callId: string; name: string }>();
      let stopped = false;
      for await (const item of streamCall(
        resolved,
        {
          url: `${resolved.baseUrl}/v1/messages`,
          headers: {
            'content-type': 'application/json',
            accept: 'text/event-stream',
            'anthropic-version': version,
            'x-api-key': resolved.key.reveal(),
          },
          body: anthropicRequestBody(request, resolved.model, resolved.maxTokens),
        },
        request.signal
      )) {
        if ('error' in item) {
          yield item.error;
          return;
        }
        const { event, data } = item.message;
        if (event === 'ping') continue;
        const parsed = parseData(data);
        if (parsed === undefined) {
          yield providerError('protocol', 'The provider sent an event that is not JSON.', false);
          return;
        }
        const payload = record(parsed);
        const type = typeof payload.type === 'string' ? payload.type : event;
        if (type === 'error') {
          const kind = errorType(record(payload.error).type);
          const code =
            kind === 'overloaded_error' || kind === 'api_error'
              ? 'overloaded'
              : kind === 'rate_limit_error'
                ? 'rate-limited'
                : 'protocol';
          yield providerError(
            code,
            `The provider stream reported ${kind}.`,
            RETRYABLE_STREAM_ERRORS.has(kind)
          );
          return;
        }
        let out: ProviderEvent | null = null;
        if (type === 'message_start') {
          const counts = record(record(payload.message).usage);
          out = usage.report(counts.input_tokens, counts.output_tokens);
        } else if (type === 'content_block_start') {
          const block = record(payload.content_block);
          const index = Number(payload.index);
          if (block.type === 'tool_use' && typeof block.name === 'string') {
            const callId = typeof block.id === 'string' ? block.id : `block-${index}`;
            toolBlocks.set(index, { callId, name: block.name });
          } else if (block.type === 'text' && typeof block.text === 'string' && block.text) {
            out = { type: 'text-delta', text: block.text };
          }
        } else if (type === 'content_block_delta') {
          const delta = record(payload.delta);
          if (delta.type === 'text_delta' && typeof delta.text === 'string' && delta.text) {
            out = { type: 'text-delta', text: delta.text };
          } else if (
            delta.type === 'input_json_delta' &&
            typeof delta.partial_json === 'string' &&
            delta.partial_json
          ) {
            const call = toolBlocks.get(Number(payload.index));
            if (call) out = { type: 'tool-delta', ...call, text: delta.partial_json };
          }
        } else if (type === 'message_delta') {
          const counts = record(payload.usage);
          out = usage.report(counts.input_tokens, counts.output_tokens);
        } else if (type === 'message_stop') {
          stopped = true;
        }
        if (out) yield out;
        if (stopped) break;
      }
      if (request.signal?.aborted) return;
      if (!stopped) {
        yield providerError('interrupted', 'The provider stream ended before message_stop.', true);
        return;
      }
      yield { type: 'done' };
    },
  };
}
