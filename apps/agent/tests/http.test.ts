import { describe, expect, it } from 'vitest';
import type { DraftResult } from '../src/contract.ts';
import { DEMO_PROMPTS } from '../src/demo.ts';
import { createMemoryActionReceiptStore } from '../src/drafts.ts';
import { type HttpOptions, handleRequest } from '../src/http.ts';
import { issueSession } from '../src/limits.ts';
import type { Provider } from '../src/provider.ts';
import { HASH, service, toolCall } from './helpers.ts';

const ORIGIN = 'https://texuli.example';
const options = (extra: Partial<HttpOptions> = {}): HttpOptions => ({
  service: service(),
  allowedOrigin: ORIGIN,
  ipOf: () => '203.0.113.7',
  ...extra,
});
const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`https://agent.example${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
const draftBody = { prompt: DEMO_PROMPTS.dashboard, catalogHash: HASH };

describe('HTTP surface', () => {
  it('reports health with the catalog hash and the kill switch state', async () => {
    const res = await handleRequest(new Request('https://agent.example/v1/health'), options());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      api: 'v1',
      enabled: true,
      catalogHash: HASH,
      guards: {
        killSwitch: { enabled: true, source: 'default' },
        breaker: { state: 'closed', failures: 0, trips: 0, retryAt: null },
      },
    });
  });

  it('returns one JSON result, with no-store and nosniff', async () => {
    const res = await handleRequest(post('/v1/draft', draftBody), options());
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    const result = (await res.json()) as DraftResult;
    expect(result).toMatchObject({ status: 'valid', draft: { id: 'layout-page' } });
  });

  it('maps token-budget refusal to HTTP 429 with a GuardReceipt-shaped body', async () => {
    const provider: Provider = {
      label: 'fake/http-budget',
      async *generate() {
        yield toolCall({ id: 'layout-page', props: { title: 'Budget report' } });
        yield { type: 'usage', inputTokens: 4, outputTokens: 3 };
      },
    };
    const response = await handleRequest(
      post('/v1/draft', draftBody),
      options({
        service: service({
          provider,
          tokenBudgets: { perSessionDailyTokens: 6, globalDailyTokens: 100 },
        }),
      })
    );

    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({
      error: 'rate-limited',
      receipt: {
        id: 'req-1',
        guard: 'token-budget',
        catalogHash: HASH,
        attempts: 1,
        budget: { scope: 'session', limit: 6, used: 7, unit: 'reported-token' },
      },
    });
  });

  it('streams server-sent events when asked', async () => {
    const res = await handleRequest(
      post('/v1/draft', draftBody, { accept: 'text/event-stream' }),
      options()
    );
    expect(res.headers.get('content-type')).toBe('text/event-stream; charset=utf-8');
    const text = await res.text();
    const types = [...text.matchAll(/^event: (\w+)$/gm)].map((m) => m[1]);
    expect(types).toEqual(['accepted', 'generating', 'validating', 'result', 'done']);
    expect(
      text
        .split('\n\n')
        .filter(Boolean)
        .every((frame) => /^event: \w+\ndata: \{/.test(frame))
    ).toBe(true);
  });

  it('buffers text within a provider call and ends with the validated receipt', async () => {
    const tree = {
      id: 'layout-doc',
      props: { title: 'Harbor weekly report' },
      children: [
        { id: 'blocks-text', props: { block: { type: 'text', markdown: '42 tickets closed.' } } },
      ],
    };
    let emitted = 0;
    const provider: Provider = {
      label: 'sse/fake',
      async *generate() {
        emitted += 1;
        yield { type: 'text', text: 'Step 1: outline the report.' };
        yield { type: 'text', text: 'Step 2: add fictional support metrics.' };
        yield toolCall(tree);
        yield { type: 'usage', inputTokens: 22, outputTokens: 9 };
      },
    };
    const response = await handleRequest(
      post('/v1/draft', draftBody, { accept: 'text/event-stream' }),
      options({ service: service({ provider }) })
    );
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Missing SSE body.');
    const decode = (chunk: Uint8Array) => new TextDecoder().decode(chunk);

    const first = await reader.read();
    expect(decode(first.value ?? new Uint8Array())).toMatch(/^event: accepted\n/);
    expect(emitted).toBe(0);
    const progressOne = await reader.read();
    expect(decode(progressOne.value ?? new Uint8Array())).toContain('Step 1: outline the report.');
    expect(decode(progressOne.value ?? new Uint8Array())).toContain(
      'Step 2: add fictional support metrics.'
    );
    expect(emitted).toBe(1);
    const progressTwo = await reader.read();
    expect(decode(progressTwo.value ?? new Uint8Array())).toMatch(/^event: validating\n/);
    const frames = [
      decode(progressOne.value ?? new Uint8Array()),
      decode(progressTwo.value ?? new Uint8Array()),
    ];
    const rest: string[] = [];
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      rest.push(decode(next.value ?? new Uint8Array()));
    }
    const allFrames = [decode(first.value ?? new Uint8Array()), ...frames, ...rest];
    expect(allFrames.map((frame) => frame.match(/^event: (\w+)/)?.[1])).toEqual([
      'accepted',
      'generating',
      'validating',
      'result',
      'done',
    ]);
    const resultFrame = allFrames.find((frame) => frame.startsWith('event: result\n'));
    if (!resultFrame) throw new Error('Missing terminal result frame.');
    const resultData = resultFrame.match(/^data: (.+)$/m)?.[1];
    if (!resultData) throw new Error('Missing result payload.');
    const payload = JSON.parse(resultData) as {
      result: DraftResult;
    };
    expect(payload.result).toMatchObject({
      status: 'valid',
      envelope: { status: 'validated' },
    });
    expect(payload.result.receipt).toMatchObject({
      attempts: 1,
      model: 'sse/fake',
      usage: { inputTokens: 22, outputTokens: 9 },
      checks: { envelope: 'pass', sinks: 'pass' },
      timing: { totalMs: expect.any(Number), gateMs: expect.any(Number) },
    });
  });

  it('aborts the provider when an SSE client cancels mid-stream', async () => {
    let started!: () => void;
    const providerStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    let observedSignal: AbortSignal | undefined;
    const tree = {
      id: 'layout-doc',
      props: { title: 'Canceled fictional report' },
      children: [
        { id: 'blocks-text', props: { block: { type: 'text', markdown: 'Not persisted.' } } },
      ],
    };
    const provider: Provider = {
      label: 'sse/abort-test',
      async *generate(request) {
        observedSignal = request.signal;
        started();
        await new Promise<void>((resolve) => {
          if (request.signal?.aborted) {
            resolve();
            return;
          }
          request.signal?.addEventListener('abort', () => resolve(), { once: true });
        });
        yield toolCall(tree);
      },
    };
    const response = await handleRequest(
      post('/v1/draft', draftBody, { accept: 'text/event-stream' }),
      options({ service: service({ provider }) })
    );
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Missing SSE body.');
    await reader.read();
    const pendingRead = reader.read();
    await providerStarted;
    await reader.cancel();
    await pendingRead;
    expect(observedSignal?.aborted).toBe(true);
  });

  it('has no activate, publish or send route', async () => {
    for (const path of ['/v1/activate', '/v1/publish', '/v1/send', '/v1/deploy', '/activate']) {
      expect((await handleRequest(post(path, {}), options())).status, path).toBe(404);
    }
    expect(
      (await handleRequest(new Request('https://agent.example/v1/draft'), options())).status
    ).toBe(405);
  });

  it('caps the body while reading it', async () => {
    const res = await handleRequest(post('/v1/draft', 'x'.repeat(70 * 1024)), options());
    expect(res.status).toBe(413);
  });

  it('maps errors to statuses: kill switch 503, catalog mismatch 409, bad request 400', async () => {
    const off = await handleRequest(
      post('/v1/draft', draftBody),
      options({ service: service({ enabled: () => false }) })
    );
    expect(off.status).toBe(503);
    expect(
      (
        await handleRequest(
          post('/v1/draft', { ...draftBody, catalogHash: 'a'.repeat(64) }),
          options()
        )
      ).status
    ).toBe(409);
    expect((await handleRequest(post('/v1/draft', { prompt: 'x' }), options())).status).toBe(400);
  });

  it('allows only the configured origin', async () => {
    const ok = await handleRequest(post('/v1/draft', draftBody, { origin: ORIGIN }), options());
    expect(ok.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    const evil = await handleRequest(
      post('/v1/draft', draftBody, { origin: 'https://evil.example' }),
      options()
    );
    expect(evil.status).toBe(403);
    expect(evil.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('requires a valid, unexpired session token when sessions are on', async () => {
    const secret = 'test-only-secret-not-a-key';
    const opts = options({ sessionSecret: secret, clock: () => 10_000 });
    expect((await handleRequest(post('/v1/draft', draftBody), opts)).status).toBe(401);
    const issued = (await (await handleRequest(post('/v1/session', {}), opts)).json()) as {
      token: string;
    };
    const ok = await handleRequest(
      post('/v1/draft', draftBody, { authorization: `Bearer ${issued.token}` }),
      opts
    );
    expect(ok.status).toBe(200);
    const forged = `${issued.token.split('.')[0]}.AAAA`;
    expect(
      (
        await handleRequest(
          post('/v1/draft', draftBody, { authorization: `Bearer ${forged}` }),
          opts
        )
      ).status
    ).toBe(401);
    const expired = await issueSession(secret, 0, 1);
    expect(
      (
        await handleRequest(
          post('/v1/draft', draftBody, { authorization: `Bearer ${expired}` }),
          opts
        )
      ).status
    ).toBe(401);
  });

  it('returns 401 for malformed base64url session signatures instead of throwing', async () => {
    const opts = options({ sessionSecret: 'test-only-secret-not-a-key', clock: () => 10_000 });
    for (const signature of ['A', 'a']) {
      const response = await handleRequest(
        post('/v1/draft', draftBody, { authorization: `Bearer payload.${signature}` }),
        opts
      );
      expect(response.status).toBe(401);
    }
  });

  it('retrieves action receipts only for the authenticated session', async () => {
    const secret = 'fictional-session-secret';
    const receiptStore = createMemoryActionReceiptStore();
    const agent = service({ actionReceiptStore: receiptStore });
    const firstToken = await issueSession(secret, 10_000);
    const secondToken = await issueSession(secret, 10_000);
    const opts = options({ service: agent, sessionSecret: secret, clock: () => 10_001 });
    const draft = await handleRequest(
      post('/v1/draft', draftBody, { authorization: `Bearer ${firstToken}` }),
      opts
    );
    expect(draft.status).toBe(200);

    const firstReceipts = await handleRequest(
      new Request('https://agent.example/v1/receipts', {
        headers: { authorization: `Bearer ${firstToken}` },
      }),
      opts
    );
    const secondReceipts = await handleRequest(
      new Request('https://agent.example/v1/receipts', {
        headers: { authorization: `Bearer ${secondToken}` },
      }),
      opts
    );
    expect(firstReceipts.status).toBe(200);
    expect(await firstReceipts.json()).toMatchObject({
      receipts: [{ artifactKind: 'blueprint-draft' }],
    });
    expect(await secondReceipts.json()).toEqual({ receipts: [] });
  });
});
