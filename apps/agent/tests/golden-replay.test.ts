import { describe, expect, it } from 'vitest';
import { createMemoryCounterStore } from '../src/limits.ts';
import { GOLDEN_CONVERSATIONS } from './fixtures/golden-conversations.ts';
import { caller, collect, HASH, request, service } from './helpers.ts';

const fixedClock = () => 1_800_000_000_000;

describe('golden conversations through the service loop', () => {
  it('replays a recorded draft with the exact progress sequence and receipt', async () => {
    const golden = GOLDEN_CONVERSATIONS[0];
    if (!golden) throw new Error('Missing basic golden conversation.');
    const events = await collect(
      service({ recordings: [golden], clock: fixedClock }).draft(request(golden.prompt), caller)
    );

    expect(events.map((event) => event.type)).toEqual([
      'accepted',
      'generating',
      'validating',
      'result',
      'done',
    ]);
    expect(events[1]).toEqual({
      type: 'generating',
      text: 'A short weekly report for Harbor support.',
    });

    const resultEvent = events[3];
    if (resultEvent?.type !== 'result') throw new Error('Missing golden result.');
    expect(resultEvent.result.status).toBe('valid');
    expect(resultEvent.result.receipt).toEqual({
      id: 'req-1',
      artifactKind: 'blueprint-draft',
      catalogHash: HASH,
      tiers: { providerOutput: 'untrusted', validation: 'untrusted' },
      durationMs: 0,
      at: new Date(fixedClock()).toISOString(),
      checks: {
        input: 'pass',
        envelope: 'pass',
        structure: 'pass',
        sinks: 'pass',
        limits: 'pass',
        render: 'pass',
        blocks: 'pass',
        // Spec 0.7.0: no document in this draft and no document check passed by the service.
        documents: 'pass', // the host document validator is wired (spec 0.7.0)
        forms: 'pass', // the forms validator is wired (spec 0.8.0)
        canvases: 'pass', // the canvas validator is wired (spec 0.8.0)
        grammar: 'pass',
        root: 'pass',
        interaction: 'pass',
        spec: 'skipped',
      },
      attempts: 1,
      model: 'replay/fake',
      timing: { totalMs: 0, gateMs: 0 },
      usage: { inputTokens: 120, outputTokens: 32 },
    });
    expect(resultEvent.result.envelope?.createdAt).toBe(new Date(fixedClock()).toISOString());
  });

  it('replays invalid then corrected golden output and accumulates usage', async () => {
    const golden = GOLDEN_CONVERSATIONS[1];
    if (!golden) throw new Error('Missing repair golden conversation.');
    const events = await collect(
      service({ recordings: [golden], clock: fixedClock }).draft(request(golden.prompt), caller)
    );

    expect(events.map((event) => event.type)).toEqual([
      'accepted',
      'generating',
      'validating',
      'repairing',
      'generating',
      'validating',
      'result',
      'done',
    ]);
    expect(events[3]).toMatchObject({
      type: 'repairing',
      attempt: 1,
      codes: ['unknown-id', 'root-count'],
    });
    const resultEvent = events[6];
    if (resultEvent?.type !== 'result') throw new Error('Missing repaired result.');
    expect(resultEvent.result.status).toBe('valid');
    expect(resultEvent.result.receipt).toMatchObject({
      attempts: 2,
      usage: { inputTokens: 200, outputTokens: 48 },
      timing: { totalMs: 0, gateMs: 0 },
    });
  });

  it('enforces rate limits and the kill switch around replay calls', async () => {
    const golden = GOLDEN_CONVERSATIONS[0];
    if (!golden) throw new Error('Missing basic golden conversation.');
    const limited = service({
      recordings: [golden],
      clock: fixedClock,
      counters: createMemoryCounterStore(),
      rateLimits: { perSessionPerHour: 1, perIpPerHour: 10, perIpPerMinute: 10, perDay: 10 },
    });
    expect((await collect(limited.draft(request(golden.prompt), caller))).at(-2)?.type).toBe(
      'result'
    );
    expect(await collect(limited.draft(request(golden.prompt), caller))).toEqual([
      {
        type: 'error',
        code: 'rate-limited',
        message: 'Too many requests; wait a little and try again.',
      },
      { type: 'done' },
    ]);

    const disabled = service({ recordings: [golden], enabled: () => false, clock: fixedClock });
    expect(await collect(disabled.draft(request(golden.prompt), caller))).toEqual([
      {
        type: 'error',
        code: 'unavailable',
        message: 'The agent is turned off right now.',
        receipt: expect.objectContaining({ guard: 'kill-switch', source: 'default', attempts: 0 }),
      },
      { type: 'done' },
    ]);
  });
});
