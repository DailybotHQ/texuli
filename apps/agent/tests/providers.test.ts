import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AgentEvent } from '../src/contract.ts';
import { createSecret } from '../src/keys.ts';
import { canonicalJson, chunkText, type Provider, type ProviderEvent } from '../src/provider.ts';
import { createAnthropicProvider } from '../src/providers/anthropic.ts';
import { createOpenAICompatibleProvider } from '../src/providers/openai.ts';
import { createSseParser, readSse, SseLimitError } from '../src/providers/sse.ts';
import { blueprintTool, systemPrompt } from '../src/tools.ts';
import {
  ANTHROPIC_SHORT,
  anthropicStream,
  fakeFetch,
  OPENAI_SHORT,
  openaiStream,
  SHORT_TOOL_JSON,
} from './fixtures/provider-streams.ts';
import { build, caller, collect, request, service } from './helpers.ts';

/**
 * The real provider adapters, offline: each runs against fixture byte
 * streams in its provider's documented shape through a fake `fetch`. No
 * network, no real key (the key below is fictional).
 */

const KEY = 'test-key-not-real-0123456789';
const SYSTEM = systemPrompt(build.catalog);
const TOOL = blueprintTool(build.catalog);
const REQUEST = {
  system: SYSTEM,
  tools: [TOOL],
  messages: [
    { role: 'assistant' as const, text: 'An earlier note.' },
    { role: 'user' as const, text: 'Make a notes page.' },
    { role: 'user' as const, text: 'With a title.' },
    { role: 'assistant' as const, text: 'emit_blueprint call 1' },
    { role: 'tool' as const, text: '{"status":"invalid"}' },
  ],
};

async function run(provider: Provider, signal?: AbortSignal): Promise<ProviderEvent[]> {
  const out: ProviderEvent[] = [];
  for await (const event of provider.generate({ ...REQUEST, ...(signal ? { signal } : {}) })) {
    out.push(event);
  }
  return out;
}

const toolText = (events: readonly ProviderEvent[]) =>
  events.map((e) => (e.type === 'tool-delta' ? e.text : '')).join('');
const text = (events: readonly ProviderEvent[]) =>
  events.map((e) => (e.type === 'text-delta' ? e.text : '')).join('');
const usage = (events: readonly ProviderEvent[]) =>
  events.reduce(
    (sum, e) =>
      e.type === 'usage'
        ? { input: sum.input + e.inputTokens, output: sum.output + e.outputTokens }
        : sum,
    { input: 0, output: 0 }
  );

describe('the server-sent events reader', () => {
  it('splits on LF, CRLF and CR across chunks, joins data lines, skips comments', () => {
    const input =
      ': hi\r\nevent: a\r\ndata: one\r\ndata:two\r\n\r\ndata: three\r\rid: 7\ndata: x\n\n';
    const whole = createSseParser().write(input);
    expect(whole).toEqual([
      { event: 'a', data: 'one\ntwo' },
      { event: 'message', data: 'three' },
      { event: 'message', data: 'x', id: '7' },
    ]);
    for (let split = 1; split < input.length; split += 1) {
      const parser = createSseParser();
      const out = [...parser.write(input.slice(0, split)), ...parser.write(input.slice(split))];
      expect(out, String(split)).toEqual(whole);
    }
  });

  it('refuses an over-long line instead of buffering it', () => {
    const parser = createSseParser({ maxLineChars: 1000 });
    expect(() => {
      for (let i = 0; i < 100; i += 1) parser.write('x'.repeat(100));
    }).toThrow(SseLimitError);
  });

  it('reads a hostile one-line stream of many small chunks in linear time', () => {
    const parser = createSseParser();
    const started = performance.now();
    for (let i = 0; i < 70_000; i += 1) parser.write('data: aaaaaaa');
    parser.write('\n\n');
    expect(performance.now() - started).toBeLessThan(2000);
  });

  it('decodes UTF-8 split anywhere in the byte stream', async () => {
    const body = 'data: {"t":"héllo ✓ 👋"}\n\n';
    const bytes = new TextEncoder().encode(body);
    for (let split = 1; split < bytes.length; split += 1) {
      const chunks = [bytes.slice(0, split), bytes.slice(split)];
      const messages = [];
      for await (const m of readSse(
        (async function* () {
          yield* chunks;
        })()
      ))
        messages.push(m);
      expect(messages, String(split)).toEqual([{ event: 'message', data: '{"t":"héllo ✓ 👋"}' }]);
    }
  });
});

const adapters = [
  {
    name: 'anthropic',
    make: (f: typeof fetch, extra: Record<string, unknown> = {}) =>
      createAnthropicProvider({ apiKey: KEY, model: 'fixture-model', fetch: f, ...extra }),
    short: ANTHROPIC_SHORT,
    stream: anthropicStream,
    cut: (pieces: readonly string[]) => anthropicStream(pieces, { stop: false }),
    url: 'https://api.anthropic.com/v1/messages',
  },
  {
    name: 'openai-compatible',
    make: (f: typeof fetch, extra: Record<string, unknown> = {}) =>
      createOpenAICompatibleProvider({ apiKey: KEY, model: 'fixture-model', fetch: f, ...extra }),
    short: OPENAI_SHORT,
    stream: openaiStream,
    cut: (pieces: readonly string[]) => openaiStream(pieces, { done: false }),
    url: 'https://api.openai.com/v1/chat/completions',
  },
] as const;

describe.each(adapters)('the $name adapter', (adapter) => {
  it('maps the documented stream to text-delta, tool-delta, usage and done', async () => {
    const { fetch } = fakeFetch(adapter.short);
    const events = await run(adapter.make(fetch));
    expect(text(events)).toBe('Here is a draft.');
    expect(toolText(events)).toBe(SHORT_TOOL_JSON);
    const deltas = events.filter((e) => e.type === 'tool-delta');
    expect(deltas.every((d) => d.type === 'tool-delta' && d.name === 'emit_blueprint')).toBe(true);
    expect(new Set(deltas.map((d) => d.type === 'tool-delta' && d.callId)).size).toBe(1);
    expect(usage(events)).toEqual({ input: 120, output: 42 });
    expect(events.at(-1)).toEqual({ type: 'done' });
  });

  it('reads the same events for every byte split of the response', async () => {
    const whole = await run(adapter.make(fakeFetch(adapter.short).fetch));
    const expected = { text: text(whole), tool: toolText(whole), usage: usage(whole) };
    for (const split of [1, 2, 3, 5, 8, 13, 64, 333]) {
      const events = await run(adapter.make(fakeFetch(adapter.short, { split }).fetch));
      expect(
        { text: text(events), tool: toolText(events), usage: usage(events) },
        String(split)
      ).toEqual(expected);
      expect(events.at(-1)).toEqual({ type: 'done' });
    }
  });

  it('sends a documented streaming request built from the closed system prompt and tool', async () => {
    const { fetch, requests } = fakeFetch(adapter.short);
    await run(adapter.make(fetch, { maxTokens: 2048 }));
    expect(requests).toHaveLength(1);
    const [sent] = requests;
    expect(sent?.url).toBe(adapter.url);
    expect(sent?.method).toBe('POST');
    expect(sent?.headers['content-type']).toBe('application/json');
    expect(sent?.body.stream).toBe(true);
    expect(sent?.body.model).toBe('fixture-model');
    expect(sent?.body.max_tokens).toBe(2048);
    const body = JSON.stringify(sent?.body);
    expect(body).toContain('children last');
    expect(body).not.toContain(KEY);
    if (adapter.name === 'anthropic') {
      expect(sent?.headers['x-api-key']).toBe(KEY);
      expect(sent?.headers['anthropic-version']).toBe('2023-06-01');
      expect(sent?.body.system).toBe(SYSTEM);
      expect(sent?.body.tools).toEqual([
        { name: TOOL.name, description: TOOL.description, input_schema: TOOL.inputSchema },
      ]);
      // A leading assistant turn is dropped; same-role turns merge; tool turns are user text.
      expect(sent?.body.messages).toEqual([
        { role: 'user', content: 'Make a notes page.\n\nWith a title.' },
        { role: 'assistant', content: 'emit_blueprint call 1' },
        {
          role: 'user',
          content: 'Validation result of your last tool call:\n{"status":"invalid"}',
        },
      ]);
    } else {
      expect(sent?.headers.authorization).toBe(`Bearer ${KEY}`);
      expect(sent?.body.stream_options).toEqual({ include_usage: true });
      const messages = sent?.body.messages as { role: string; content: string }[];
      expect(messages[0]).toEqual({ role: 'system', content: SYSTEM });
      expect(messages.map((m) => m.role)).toEqual([
        'system',
        'assistant',
        'user',
        'user',
        'assistant',
        'user',
      ]);
      expect(sent?.body.tools).toEqual([
        {
          type: 'function',
          function: {
            name: TOOL.name,
            description: TOOL.description,
            parameters: TOOL.inputSchema,
          },
        },
      ]);
    }
  });

  it.each([
    [429, 'rate-limited', true],
    [500, 'overloaded', true],
    [503, 'overloaded', true],
    [401, 'auth', false],
    [403, 'auth', false],
    [400, 'bad-request', false],
  ] as const)(
    'maps HTTP %i to a %s error (retryable %s) without the body',
    async (status, code, retryable) => {
      const { fetch } = fakeFetch(`{"error":"upstream echo ${KEY}"}`, {
        status,
        contentType: 'application/json',
      });
      const events = await run(adapter.make(fetch));
      expect(events).toEqual([{ type: 'error', code, message: expect.any(String), retryable }]);
      expect(JSON.stringify(events)).not.toContain(KEY);
      expect(JSON.stringify(events)).not.toContain('upstream echo');
    }
  );

  it('reports a stream that ends early as a retryable interruption', async () => {
    const pieces = chunkText(SHORT_TOOL_JSON, 9);
    const events = await run(adapter.make(fakeFetch(adapter.cut(pieces)).fetch));
    expect(toolText(events)).toBe(SHORT_TOOL_JSON);
    expect(events.at(-1)).toMatchObject({ type: 'error', code: 'interrupted', retryable: true });
  });

  it('reports a non-stream response and non-JSON data as protocol errors', async () => {
    const json = await run(
      adapter.make(fakeFetch('{}', { contentType: 'application/json' }).fetch)
    );
    expect(json).toEqual([
      { type: 'error', code: 'protocol', message: expect.any(String), retryable: false },
    ]);
    const garbage = await run(adapter.make(fakeFetch('data: not json\n\n').fetch));
    expect(garbage.at(-1)).toMatchObject({ type: 'error', code: 'protocol', retryable: false });
  });

  it('maps a network failure and its own deadline to retryable errors', async () => {
    const offline = (async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    expect(await run(adapter.make(offline))).toEqual([
      { type: 'error', code: 'network', message: expect.any(String), retryable: true },
    ]);
    const hanging = ((_url: unknown, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('x', 'AbortError')));
      })) as unknown as typeof fetch;
    expect(await run(adapter.make(hanging, { timeoutMs: 5 }))).toEqual([
      { type: 'error', code: 'timeout', message: expect.any(String), retryable: true },
    ]);
  });

  it('ends quietly when the caller aborts', async () => {
    const controller = new AbortController();
    const { fetch } = fakeFetch(adapter.short, { split: 16 });
    const out: ProviderEvent[] = [];
    for await (const event of adapter
      .make(fetch)
      .generate({ ...REQUEST, signal: controller.signal })) {
      out.push(event);
      controller.abort();
    }
    expect(out.some((e) => e.type === 'error')).toBe(false);
    expect(out.some((e) => e.type === 'done')).toBe(false);
  });

  it('takes its key only from options, wraps it, and refuses bad options without echoing them', () => {
    const { fetch } = fakeFetch(adapter.short);
    expect(() => adapter.make(fetch, { apiKey: '' })).toThrow(/apiKey is required/);
    expect(() => adapter.make(fetch, { model: 'bad model name' })).toThrow(/model/);
    expect(() => adapter.make(fetch, { baseUrl: 'http://example.com' })).toThrow(/https/);
    const provider = adapter.make(fetch, { apiKey: createSecret(KEY) });
    expect(provider.label).toBe(`${adapter.name}/fixture-model`);
    expect(JSON.stringify(provider)).not.toContain(KEY);
  });

  it('feeds the service: a golden tree streamed by the provider becomes a validated final draft', async () => {
    const tree = (
      JSON.parse(
        readFileSync(
          join(import.meta.dirname, '../../../tests/fixtures/golden/05-chat-thread.json'),
          'utf8'
        )
      ) as { tree: unknown }
    ).tree;
    const pieces = chunkText(canonicalJson({ tree }), [7, 31, 2]);
    const { fetch } = fakeFetch(adapter.stream(pieces), { split: 50 });
    const s = service({ provider: adapter.make(fetch) });
    const events: AgentEvent[] = await collect(
      s.draft(request('Any prompt: the fake fetch answers.', { stream: true }), caller)
    );
    const final = events.find((e) => e.type === 'final');
    expect(final?.type === 'final' && final.result.status).toBe('valid');
    expect(final?.type === 'final' && final.result.receipt.model).toBe(
      `${adapter.name}/fixture-model`
    );
    expect(final?.type === 'final' && final.result.receipt.usage).toEqual({
      inputTokens: 900,
      outputTokens: 300,
    });
    expect(events.filter((e) => e.type === 'node-ready').length).toBeGreaterThan(3);
  });
});

describe('library code reads no configuration', () => {
  it('has no environment, file or SDK access in the adapters', () => {
    for (const file of ['anthropic.ts', 'openai.ts', 'http.ts', 'sse.ts']) {
      const source = readFileSync(join(import.meta.dirname, '../src/providers', file), 'utf8');
      expect(source, file).not.toMatch(
        /process\.env|node:fs|readFile|import\.meta\.env|from '(?!\.)/
      );
    }
  });
});
