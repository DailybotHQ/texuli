import { describe, expect, it } from 'vitest';
import { DEMO_PROMPTS } from '../src/demo.ts';
import { createMemoryDraftStore } from '../src/drafts.ts';
import type { Provider } from '../src/provider.ts';
import { caller, collect, HASH, request, service, toolCall } from './helpers.ts';

const report = {
  id: 'layout-doc',
  props: { title: 'Week 42' },
  children: [{ id: 'blocks-text', props: { block: { type: 'text', markdown: 'Shipped.' } } }],
};

describe('a draft request', () => {
  it('refuses a session that crosses its reported-token ceiling without tripping the breaker', async () => {
    const provider: Provider = {
      label: 'fake/token-budget',
      async *generate() {
        yield toolCall(report);
        yield { type: 'usage', inputTokens: 3, outputTokens: 3 };
      },
    };
    const agent = service({
      provider,
      tokenBudgets: { perSessionDailyTokens: 5, globalDailyTokens: 100 },
    });
    const events = await collect(agent.draft(request(DEMO_PROMPTS.report), caller));
    const refusal = events.find((event) => event.type === 'error');

    expect(events.map((event) => event.type)).toEqual(['accepted', 'error', 'done']);
    expect(refusal).toMatchObject({
      type: 'error',
      code: 'rate-limited',
      receipt: {
        id: 'req-1',
        guard: 'token-budget',
        catalogHash: HASH,
        attempts: 1,
        budget: { scope: 'session', limit: 5, used: 6, unit: 'reported-token' },
      },
    });
    expect(agent.guards.breaker).toMatchObject({ state: 'closed', failures: 0, trips: 0 });
  });

  it('shares the daily global token ceiling across sessions and blocks later calls at the ceiling', async () => {
    let calls = 0;
    const provider: Provider = {
      label: 'fake/global-budget',
      async *generate() {
        calls += 1;
        yield toolCall(report);
        yield { type: 'usage', inputTokens: 2, outputTokens: 2 };
      },
    };
    const agent = service({
      provider,
      tokenBudgets: { perSessionDailyTokens: 100, globalDailyTokens: 6 },
    });
    const first = await collect(agent.draft(request(DEMO_PROMPTS.report), caller));
    expect(first.at(-2)?.type).toBe('result');
    const nextSession = { ...caller, session: 'sid:another' };
    const second = await collect(agent.draft(request(DEMO_PROMPTS.report), nextSession));
    expect(second).toMatchObject([
      { type: 'accepted' },
      {
        type: 'error',
        code: 'rate-limited',
        receipt: { budget: { scope: 'global', limit: 6, used: 8 } },
      },
      { type: 'done' },
    ]);
    expect(calls).toBe(2);

    const sameSession = await collect(agent.draft(request(DEMO_PROMPTS.report), nextSession));
    expect(sameSession[1]).toMatchObject({
      type: 'error',
      receipt: { attempts: 0, budget: { scope: 'global', used: 8 } },
    });
    expect(calls).toBe(2);
  });

  it('attaches a privacy-safe action receipt and retrieves it only for its session', async () => {
    let now = 1_800_000_000_000;
    const drafts = createMemoryDraftStore();
    const agent = service({ draftStore: drafts, clock: () => (now += 5) });
    const events = await collect(agent.draft(request(DEMO_PROMPTS.report), caller));
    const result = events.find((event) => event.type === 'result');
    if (result?.type !== 'result') throw new Error('no result');

    expect(result.result.receipt).toMatchObject({
      id: 'req-1',
      artifactKind: 'blueprint-draft',
      catalogHash: HASH,
      tiers: { providerOutput: 'untrusted', validation: 'untrusted' },
      durationMs: expect.any(Number),
      at: expect.any(String),
      attempts: 1,
    });
    expect(JSON.stringify(result.result.receipt)).not.toContain(DEMO_PROMPTS.report);
    expect(JSON.stringify(result.result.receipt)).not.toContain(caller.ip);
    expect(JSON.stringify(result.result.receipt)).not.toContain(caller.session);
    expect(await agent.receipts(caller.session)).toEqual([
      expect.objectContaining({
        id: 'req-1',
        artifactKind: 'blueprint-draft',
        catalogHash: HASH,
        tiers: { providerOutput: 'untrusted', validation: 'untrusted' },
        attempts: 1,
      }),
    ]);
    expect(await agent.receipts('sid:another')).toEqual([]);
  });

  it('does not validate or persist a provider response after abort', async () => {
    let started!: () => void;
    const providerStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    let requestSignal: AbortSignal | undefined;
    const provider: Provider = {
      label: 'sse/abort-test',
      async *generate(input) {
        requestSignal = input.signal;
        started();
        await new Promise<void>((resolve) => {
          if (input.signal?.aborted) {
            resolve();
            return;
          }
          input.signal?.addEventListener('abort', () => resolve(), { once: true });
        });
        yield toolCall(report);
      },
    };
    const drafts = createMemoryDraftStore();
    const controller = new AbortController();
    const events = service({ provider, draftStore: drafts }).draft(
      request(DEMO_PROMPTS.report),
      caller,
      controller.signal
    );
    expect((await events.next()).value?.type).toBe('accepted');
    const pending = events.next();
    await providerStarted;
    controller.abort();
    expect((await pending).value?.type).toBeUndefined();
    expect(requestSignal?.aborted).toBe(true);
    expect(drafts.get('draft-req-1')).toBeUndefined();
  });

  it('streams progress, validates and returns a draft with an envelope and a receipt', async () => {
    let now = 1000;
    const events = await collect(
      service({ clock: () => (now += 5) }).draft(request(DEMO_PROMPTS.report), caller)
    );
    expect(events.map((e) => e.type)).toEqual([
      'accepted',
      'generating',
      'validating',
      'result',
      'done',
    ]);
    const result = events.find((e) => e.type === 'result');
    if (result?.type !== 'result') throw new Error('no result');
    expect(result.result).toMatchObject({
      status: 'valid',
      draft: { id: 'layout-doc' },
      envelope: { format: 'texuli-blueprint', status: 'validated', catalog: HASH },
      receipt: {
        id: 'req-1',
        catalogHash: HASH,
        attempts: 1,
        model: 'replay/fake',
        usage: { inputTokens: 1200, outputTokens: 240 },
      },
    });
    expect(result.result.receipt.checks).toMatchObject({
      sinks: 'pass',
      render: 'pass',
      grammar: 'pass',
      root: 'pass',
    });
    expect(result.result.receipt.timing.totalMs).toBeGreaterThan(0);
    expect(result.result.envelope?.generator).toEqual({
      kind: 'agent',
      name: 'texuli.com agent',
      model: 'replay/fake',
    });
  });

  it('persists the validated untrusted envelope and its lifecycle receipt', async () => {
    const draftStore = createMemoryDraftStore();
    const events = await collect(
      service({
        draftStore,
        clock: () => 1_800_000_000_000,
        recordings: [{ prompt: 'Persist this report', calls: [[toolCall(report)]] }],
      }).draft(request('Persist this report'), caller)
    );
    const result = events.find((event) => event.type === 'result');
    if (result?.type !== 'result') throw new Error('no result');

    expect(result.result.envelope).toMatchObject({
      id: 'draft-req-1',
      status: 'validated',
      catalog: HASH,
    });
    expect(result.result.envelope?.activatedBy).toBeUndefined();
    expect(draftStore.get('draft-req-1')).toMatchObject({
      envelope: { status: 'validated', catalog: HASH },
      validationReceipt: {
        envelopeId: 'draft-req-1',
        catalogHash: HASH,
        tier: 'untrusted',
        ok: true,
        checks: { envelope: 'pass' },
      },
    });
  });

  it('does not return a validated draft when lifecycle persistence fails', async () => {
    const events = await collect(
      service({
        draftStore: {
          async save() {
            throw new Error('private storage detail');
          },
        },
        recordings: [{ prompt: 'Persist safely', calls: [[toolCall(report)]] }],
      }).draft(request('Persist safely'), caller)
    );

    expect(events.at(-2)).toEqual({
      type: 'error',
      code: 'unavailable',
      message: 'The draft could not be saved; please try again.',
    });
    expect(JSON.stringify(events)).not.toContain('private storage detail');
    expect(events.some((event) => event.type === 'result')).toBe(false);
  });

  it('rejects unsafe model-authored links through the untrusted URL policy', async () => {
    const draftStore = createMemoryDraftStore();
    const unsafe = {
      id: 'layout-doc',
      children: [
        {
          id: 'blocks-text',
          props: { block: { type: 'text', markdown: '[Open](javascript:alert(1))' } },
        },
      ],
    };
    const agent = service({
      draftStore,
      recordings: [{ prompt: 'Unsafe link', calls: [[toolCall(unsafe)]] }],
    });
    const events = await collect(agent.draft(request('Unsafe link'), caller));
    const result = events.find((event) => event.type === 'result');
    if (result?.type !== 'result') throw new Error('no result');
    expect(result.result.status).toBe('invalid');
    expect(result.result.receipt.artifactKind).toBe('draft-attempt');
    expect(await agent.receipts(caller.session)).toMatchObject([
      { artifactKind: 'draft-attempt', catalogHash: HASH },
    ]);
    expect(JSON.stringify(result.result)).not.toMatch(/javascript:|<script|onerror/i);
    expect(draftStore.get('draft-req-1')).toBeUndefined();
  });

  it('repairs a bad first answer with the diagnostics, then succeeds', async () => {
    const recordings = [
      { prompt: 'Repair me', calls: [[toolCall({ id: 'marquee' })], [toolCall(report)]] },
    ];
    const events = await collect(service({ recordings }).draft(request('Repair me'), caller));
    expect(events.map((e) => e.type)).toEqual([
      'accepted',
      'validating',
      'repairing',
      'validating',
      'result',
      'done',
    ]);
    const repairing = events.find((e) => e.type === 'repairing');
    expect(repairing).toMatchObject({ attempt: 1 });
    expect(repairing?.type === 'repairing' && repairing.codes).toContain('unknown-id');
    const result = events.at(-2);
    expect(result?.type === 'result' && result.result.receipt.attempts).toBe(2);
  });

  it('stops after the repair budget and returns invalid with the diagnostics', async () => {
    const recordings = [{ prompt: 'Always bad', calls: [[toolCall({ id: 'dialog', props: {} })]] }];
    const events = await collect(service({ recordings }).draft(request('Always bad'), caller));
    expect(events.filter((e) => e.type === 'repairing')).toHaveLength(2);
    const result = events.at(-2);
    if (result?.type !== 'result') throw new Error('no result');
    expect(result.result).toMatchObject({ status: 'invalid', receipt: { attempts: 3 } });
    expect(result.result.draft).toBeUndefined();
    expect(result.result.diagnostics.map((d) => d.code)).toContain('tier-denied');
  });

  it('asks again when the model answers without a tree', async () => {
    const events = await collect(service().draft(request('No recording for this'), caller));
    const result = events.at(-2);
    expect(result?.type === 'result' && result.result.diagnostics[0]?.code).toBe('no-tree');
  });

  it('re-validates the client draft and refuses an invalid one', async () => {
    const events = await collect(
      service().draft(request(DEMO_PROMPTS.report, { draft: { id: 'dialog' } }), caller)
    );
    expect(events.find((e) => e.type === 'error')).toMatchObject({ code: 'invalid-draft' });
    const ok = await collect(
      service().draft(request(DEMO_PROMPTS.report, { draft: report }), caller)
    );
    expect(ok.at(-2)?.type).toBe('result');
  });
});

describe('controls', () => {
  it('refuses everything when the kill switch is off', async () => {
    const events = await collect(
      service({ enabled: () => false }).draft(request(DEMO_PROMPTS.report), caller)
    );
    expect(events).toEqual([
      {
        type: 'error',
        code: 'unavailable',
        message: 'The agent is turned off right now.',
        receipt: expect.objectContaining({ guard: 'kill-switch', source: 'default', attempts: 0 }),
      },
      { type: 'done' },
    ]);
  });

  it('refuses a request pinned to another catalog', async () => {
    const events = await collect(
      service().draft(request(DEMO_PROMPTS.report, { catalogHash: 'f'.repeat(64) }), caller)
    );
    expect(events[0]).toMatchObject({ type: 'error', code: 'catalog-mismatch' });
  });

  it('rate-limits per IP and per session', async () => {
    const s = service({
      rateLimits: { perSessionPerHour: 2, perIpPerHour: 60, perIpPerMinute: 60, perDay: 100 },
    });
    for (let i = 0; i < 2; i += 1) {
      expect((await collect(s.draft(request(DEMO_PROMPTS.report), caller))).at(-2)?.type).toBe(
        'result'
      );
    }
    expect((await collect(s.draft(request(DEMO_PROMPTS.report), caller)))[0]).toMatchObject({
      code: 'rate-limited',
    });
    const other = await collect(
      s.draft(request(DEMO_PROMPTS.report), { ...caller, session: 'sid:other' })
    );
    expect(other.at(-2)?.type).toBe('result');
  });

  it('runs one request per session at a time and frees the slot afterwards', async () => {
    const s = service();
    const first = s.draft(request(DEMO_PROMPTS.report), caller);
    await first.next();
    expect((await collect(s.draft(request(DEMO_PROMPTS.report), caller)))[0]).toMatchObject({
      code: 'busy',
    });
    await collect(first);
    expect((await collect(s.draft(request(DEMO_PROMPTS.report), caller))).at(-2)?.type).toBe(
      'result'
    );
  });

  it('reports a provider failure without leaking its details', async () => {
    const provider: Provider = {
      label: 'broken',
      // biome-ignore lint/correctness/useYield: it fails before yielding
      async *generate() {
        throw new Error('secret upstream detail');
      },
    };
    const events = await collect(service({ provider }).draft(request('x'), caller));
    expect(events.find((e) => e.type === 'error')).toEqual({
      type: 'error',
      code: 'provider-error',
      message: 'The model could not answer; try again.',
      retryable: true,
    });
  });

  it.each(['failure', 'timeout'] as const)(
    'maps a fake %s outcome to a safe provider error',
    async (outcome) => {
      const events = await collect(
        service({ recordings: [{ prompt: 'injected', calls: [{ outcome }] }] }).draft(
          request('injected'),
          caller
        )
      );
      expect(events.at(-2)).toEqual({
        type: 'error',
        code: 'provider-error',
        message: 'The model could not answer; try again.',
        retryable: true,
      });
      expect(events.at(-1)).toEqual({ type: 'done' });
    }
  );
});
