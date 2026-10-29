/**
 * Fixture server-sent event byte streams in the documented shapes of the
 * Anthropic Messages API and OpenAI-compatible Chat Completions streams.
 * Hand-written to the published formats with fictional ids and counts; no
 * real provider was called to make them. `fakeFetch` serves one as the
 * response body and records each request, so the adapter tests need no
 * network and no key.
 */

/** A short Anthropic stream: a text block, a `tool_use` block in two JSON pieces, usage, stop. */
export const ANTHROPIC_SHORT = [
  'event: message_start',
  'data: {"type":"message_start","message":{"id":"msg_fixture_01","type":"message","role":"assistant","model":"fixture-model","content":[],"stop_reason":null,"usage":{"input_tokens":120,"output_tokens":1}}}',
  '',
  'event: content_block_start',
  'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}',
  '',
  ': a comment line the reader skips',
  'event: ping',
  'data: {"type":"ping"}',
  '',
  'event: content_block_delta',
  'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Here is "}}',
  '',
  'event: content_block_delta',
  'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"a draft."}}',
  '',
  'event: content_block_stop',
  'data: {"type":"content_block_stop","index":0}',
  '',
  'event: content_block_start',
  'data: {"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"toolu_fixture_01","name":"emit_blueprint","input":{}}}',
  '',
  'event: content_block_delta',
  'data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":""}}',
  '',
  'event: content_block_delta',
  'data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"{\\"tree\\": {\\"id\\": \\"layout-doc\\","}}',
  '',
  'event: content_block_delta',
  'data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":" \\"props\\": {\\"title\\": \\"Notes\\"}}}"}}',
  '',
  'event: content_block_stop',
  'data: {"type":"content_block_stop","index":1}',
  '',
  'event: message_delta',
  'data: {"type":"message_delta","delta":{"stop_reason":"tool_use","stop_sequence":null},"usage":{"output_tokens":42}}',
  '',
  'event: message_stop',
  'data: {"type":"message_stop"}',
  '',
  '',
].join('\n');

/** The same short answer as an OpenAI-compatible chunk stream. */
export const OPENAI_SHORT = [
  'data: {"id":"chatcmpl-fixture","object":"chat.completion.chunk","created":1,"model":"fixture-model","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}',
  '',
  'data: {"id":"chatcmpl-fixture","object":"chat.completion.chunk","created":1,"model":"fixture-model","choices":[{"index":0,"delta":{"content":"Here is "},"finish_reason":null}]}',
  '',
  'data: {"id":"chatcmpl-fixture","object":"chat.completion.chunk","created":1,"model":"fixture-model","choices":[{"index":0,"delta":{"content":"a draft."},"finish_reason":null}]}',
  '',
  'data: {"id":"chatcmpl-fixture","object":"chat.completion.chunk","created":1,"model":"fixture-model","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_fixture_01","type":"function","function":{"name":"emit_blueprint","arguments":""}}]},"finish_reason":null}]}',
  '',
  'data: {"id":"chatcmpl-fixture","object":"chat.completion.chunk","created":1,"model":"fixture-model","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"tree\\": {\\"id\\": \\"layout-doc\\","}}]},"finish_reason":null}]}',
  '',
  'data: {"id":"chatcmpl-fixture","object":"chat.completion.chunk","created":1,"model":"fixture-model","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":" \\"props\\": {\\"title\\": \\"Notes\\"}}}"}}]},"finish_reason":null}]}',
  '',
  'data: {"id":"chatcmpl-fixture","object":"chat.completion.chunk","created":1,"model":"fixture-model","choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}',
  '',
  'data: {"id":"chatcmpl-fixture","object":"chat.completion.chunk","created":1,"model":"fixture-model","choices":[],"usage":{"prompt_tokens":120,"completion_tokens":42,"total_tokens":162}}',
  '',
  'data: [DONE]',
  '',
  '',
].join('\n');

/** The tool JSON both short fixtures carry. */
export const SHORT_TOOL_JSON = '{"tree": {"id": "layout-doc", "props": {"title": "Notes"}}}';

const sse = (event: string | null, data: unknown) =>
  `${event ? `event: ${event}\n` : ''}data: ${JSON.stringify(data)}\n\n`;

/** An Anthropic stream that writes `toolJson` in the given pieces (the documented event order). */
export function anthropicStream(pieces: readonly string[], options: { stop?: boolean } = {}) {
  let out = sse('message_start', {
    type: 'message_start',
    message: {
      id: 'msg_fixture_02',
      type: 'message',
      role: 'assistant',
      model: 'fixture-model',
      content: [],
      usage: { input_tokens: 900, output_tokens: 1 },
    },
  });
  out += sse('content_block_start', {
    type: 'content_block_start',
    index: 0,
    content_block: { type: 'tool_use', id: 'toolu_fixture_02', name: 'emit_blueprint', input: {} },
  });
  for (const piece of pieces) {
    out += sse('content_block_delta', {
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'input_json_delta', partial_json: piece },
    });
  }
  if (options.stop === false) return out;
  out += sse('content_block_stop', { type: 'content_block_stop', index: 0 });
  out += sse('message_delta', {
    type: 'message_delta',
    delta: { stop_reason: 'tool_use' },
    usage: { output_tokens: 300 },
  });
  out += sse('message_stop', { type: 'message_stop' });
  return out;
}

/** An OpenAI-compatible stream that writes `toolJson` in the given pieces. */
export function openaiStream(pieces: readonly string[], options: { done?: boolean } = {}) {
  const chunk = (delta: unknown, extra: Record<string, unknown> = {}) => ({
    id: 'chatcmpl-fixture-02',
    object: 'chat.completion.chunk',
    created: 1,
    model: 'fixture-model',
    choices: [{ index: 0, delta, finish_reason: null }],
    ...extra,
  });
  let out = sse(
    null,
    chunk({
      tool_calls: [
        {
          index: 0,
          id: 'call_fixture_02',
          type: 'function',
          function: { name: 'emit_blueprint', arguments: '' },
        },
      ],
    })
  );
  for (const piece of pieces) {
    out += sse(null, chunk({ tool_calls: [{ index: 0, function: { arguments: piece } }] }));
  }
  if (options.done === false) return out;
  out += sse(null, {
    ...chunk({}),
    choices: [],
    usage: { prompt_tokens: 900, completion_tokens: 300 },
  });
  out += 'data: [DONE]\n\n';
  return out;
}

export interface RecordedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

/**
 * A fake `fetch`: answers every call with `body` split into byte chunks of
 * `split` bytes (so tests cut multi-byte characters and lines anywhere),
 * and records the requests. `status` and `contentType` shape the response.
 */
export function fakeFetch(
  body: string,
  options: { status?: number; contentType?: string; split?: number } = {}
) {
  const requests: RecordedRequest[] = [];
  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((value, name) => {
      headers[name] = value;
    });
    requests.push({
      url: String(input),
      method: init?.method ?? 'GET',
      headers,
      body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>,
    });
    const bytes = new TextEncoder().encode(body);
    const split = Math.max(1, options.split ?? bytes.length);
    const signal = init?.signal;
    let at = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (signal?.aborted) {
          controller.error(new DOMException('aborted', 'AbortError'));
          return;
        }
        if (at >= bytes.length) {
          controller.close();
          return;
        }
        controller.enqueue(bytes.slice(at, at + split));
        at += split;
      },
    });
    return new Response(stream, {
      status: options.status ?? 200,
      headers: { 'content-type': options.contentType ?? 'text/event-stream' },
    });
  }) as typeof globalThis.fetch;
  return { fetch, requests };
}
