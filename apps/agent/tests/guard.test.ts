import { describe, expect, it } from 'vitest';
import type { AgentEvent, GuardReceipt } from '../src/contract.ts';
import { DEMO_PROMPTS, DEMO_RECORDINGS } from '../src/demo.ts';
import {
  createCircuitBreaker,
  type KillSwitchState,
  parseLocalAgentConfig,
  resolveKillSwitch,
} from '../src/guard.ts';
import { handleRequest } from '../src/http.ts';
import { createFakeProvider, type Provider } from '../src/provider.ts';
import { caller, collect, HASH, request, service, toolCall } from './helpers.ts';

/*
 * Kill switch and circuit breaker (Task 86). Tests never read
 * ~/.config/texuli/: the local operator config is passed in as text.
 */

const generous = {
  perSessionPerHour: 1_000,
  perIpPerHour: 1_000,
  perIpPerMinute: 1_000,
  perDay: 10_000,
};

function manualClock(start = Date.UTC(2026, 9, 25, 12)) {
  let now = start;
  return { now: () => now, advance: (ms: number) => (now += ms) };
}

/** Wraps a provider and counts the generation calls that reached it. */
function counting(inner: Provider) {
  const counter = { calls: 0 };
  const provider: Provider = {
    label: inner.label,
    generate(input) {
      counter.calls += 1;
      return inner.generate(input);
    },
  };
  return { provider, counter };
}

const failingProvider = () =>
  counting({
    label: 'replay/fake',
    // biome-ignore lint/correctness/useYield: a provider that fails before any event
    async *generate() {
      throw new Error('Fake provider failed.');
    },
  });

const errorOf = (events: AgentEvent[]) =>
  events.find((event): event is Extract<AgentEvent, { type: 'error' }> => event.type === 'error');

describe('kill switch resolution', () => {
  it('reads the environment in both adapter modes', () => {
    expect(resolveKillSwitch({ env: '1', envMode: 'on-when-1' })).toEqual({
      enabled: true,
      source: 'env',
    });
    expect(resolveKillSwitch({ env: 'yes', envMode: 'on-when-1' })).toEqual({
      enabled: false,
      source: 'env',
    });
    expect(resolveKillSwitch({ envMode: 'on-when-1' })).toEqual({
      enabled: false,
      source: 'default',
    });
    expect(resolveKillSwitch({ env: '0', envMode: 'off-when-0' })).toEqual({
      enabled: false,
      source: 'env',
    });
    expect(resolveKillSwitch({ envMode: 'off-when-0' })).toEqual({
      enabled: true,
      source: 'default',
    });
  });

  it('lets a local-config "off" win over an environment "on"', () => {
    const local = parseLocalAgentConfig('{ "enabled": false, "note": "maintenance" }');
    expect(resolveKillSwitch({ env: '1', envMode: 'on-when-1', local })).toEqual({
      enabled: false,
      source: 'local-config',
    });
    // A local "on" never overrides an environment "off".
    expect(
      resolveKillSwitch({ env: '0', envMode: 'off-when-0', local: { enabled: true } })
    ).toEqual({ enabled: false, source: 'env' });
  });

  it('treats a missing or malformed local config as no setting and ignores other fields', () => {
    for (const text of [
      null,
      '',
      'not json',
      '[]',
      '{"enabled":"false"}',
      '{"apiKey":"sk-example"}',
    ]) {
      expect(parseLocalAgentConfig(text)).toEqual({});
    }
  });
});

describe('circuit breaker', () => {
  it('opens after consecutive failures, refuses during the cooldown, then allows one trial', () => {
    const clock = manualClock();
    const breaker = createCircuitBreaker({
      failureThreshold: 3,
      cooldownMs: 10_000,
      clock: clock.now,
    });
    for (let i = 0; i < 2; i++) {
      expect(breaker.allow()).toEqual({ ok: true });
      breaker.recordFailure();
    }
    expect(breaker.snapshot()).toMatchObject({ state: 'closed', failures: 2, trips: 0 });
    breaker.allow();
    breaker.recordFailure();
    expect(breaker.snapshot()).toMatchObject({
      state: 'open',
      trips: 1,
      retryAt: clock.now() + 10_000,
    });
    clock.advance(4_000);
    expect(breaker.allow()).toEqual({ ok: false, retryAfterMs: 6_000 });

    clock.advance(6_000);
    expect(breaker.allow()).toEqual({ ok: true });
    expect(breaker.snapshot().state).toBe('half-open');
    // Only one trial at a time.
    expect(breaker.allow().ok).toBe(false);
    breaker.recordSuccess();
    expect(breaker.snapshot()).toMatchObject({ state: 'closed', failures: 0, trips: 1 });
  });

  it('reopens when the trial fails and frees an aborted trial', () => {
    const clock = manualClock();
    const breaker = createCircuitBreaker({
      failureThreshold: 1,
      cooldownMs: 1_000,
      clock: clock.now,
    });
    breaker.allow();
    breaker.recordFailure();
    clock.advance(1_000);
    expect(breaker.allow().ok).toBe(true);
    breaker.recordFailure();
    expect(breaker.snapshot()).toMatchObject({ state: 'open', trips: 2 });
    clock.advance(1_000);
    expect(breaker.allow().ok).toBe(true);
    breaker.recordAbort();
    expect(breaker.allow().ok).toBe(true);
  });

  it('a success resets the consecutive-failure count', () => {
    const breaker = createCircuitBreaker({ failureThreshold: 2 });
    breaker.recordFailure();
    breaker.recordSuccess();
    breaker.recordFailure();
    expect(breaker.snapshot()).toMatchObject({ state: 'closed', failures: 1 });
  });
});

describe('service guards', () => {
  it('hard-stops generation when the kill switch flips mid-request, with a receipt', async () => {
    let state: KillSwitchState = { enabled: true, source: 'env' };
    // An invalid first answer forces a repair; the switch flips before the second call.
    const inner = createFakeProvider([
      { prompt: 'repair me', calls: [[toolCall({ id: 'no-such-component' })], [toolCall({})]] },
    ]);
    const { provider, counter } = counting({
      label: inner.label,
      generate(input) {
        state = { enabled: false, source: 'local-config' };
        return inner.generate(input);
      },
    });
    const events = await collect(
      service({ provider, killSwitch: () => state, rateLimits: generous }).draft(
        request('repair me'),
        caller
      )
    );
    expect(counter.calls).toBe(1);
    const error = errorOf(events);
    expect(error).toMatchObject({ code: 'unavailable' });
    expect(error?.receipt).toMatchObject({
      guard: 'kill-switch',
      source: 'local-config',
      attempts: 1,
      catalogHash: HASH,
    } satisfies Partial<GuardReceipt>);
    expect(events.at(-1)).toEqual({ type: 'done' });
  });

  it('never calls the provider while the kill switch is off', async () => {
    const { provider, counter } = counting(createFakeProvider(DEMO_RECORDINGS));
    const off = service({ provider, killSwitch: () => ({ enabled: false, source: 'env' }) });
    for (let i = 0; i < 3; i++) await collect(off.draft(request(DEMO_PROMPTS.report), caller));
    expect(counter.calls).toBe(0);
  });

  it('trips the breaker after repeated provider failures and recovers after the cooldown', async () => {
    const clock = manualClock();
    const failing = failingProvider();
    let healthy = false;
    const working = createFakeProvider(DEMO_RECORDINGS);
    const provider: Provider = {
      label: 'replay/fake',
      generate: (input) => (healthy ? working : failing.provider).generate(input),
    };
    const agent = service({
      provider,
      clock: clock.now,
      rateLimits: generous,
      breaker: { failureThreshold: 3, cooldownMs: 30_000 },
    });

    for (let i = 0; i < 3; i++) {
      const events = await collect(agent.draft(request(DEMO_PROMPTS.report), caller));
      expect(errorOf(events)?.code).toBe('provider-error');
    }
    expect(failing.counter.calls).toBe(3);
    expect(agent.guards.breaker).toMatchObject({ state: 'open', trips: 1 });

    clock.advance(10_000);
    const refused = errorOf(await collect(agent.draft(request(DEMO_PROMPTS.report), caller)));
    expect(failing.counter.calls).toBe(3);
    expect(refused).toMatchObject({ code: 'circuit-open' });
    expect(refused?.receipt).toMatchObject({
      guard: 'circuit-breaker',
      retryAfterMs: 20_000,
      attempts: 0,
      breaker: { state: 'open', failures: 3, trips: 1 },
    });

    clock.advance(20_000);
    healthy = true;
    const recovered = await collect(agent.draft(request(DEMO_PROMPTS.report), caller));
    expect(recovered.find((event) => event.type === 'result')).toBeDefined();
    expect(agent.guards.breaker).toMatchObject({ state: 'closed', failures: 0, trips: 1 });
  });

  it('does not count a caller hanging up as a provider failure', async () => {
    const controller = new AbortController();
    const { provider } = counting({
      label: 'replay/fake',
      // biome-ignore lint/correctness/useYield: fails as the caller aborts
      async *generate() {
        controller.abort();
        throw new Error('aborted');
      },
    });
    const agent = service({ provider, rateLimits: generous, breaker: { failureThreshold: 1 } });
    await collect(agent.draft(request(DEMO_PROMPTS.report), caller, controller.signal));
    expect(agent.guards.breaker).toMatchObject({ state: 'closed', failures: 0 });
  });
});

describe('HTTP guards', () => {
  const post = () =>
    new Request('https://agent.example/v1/draft', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: DEMO_PROMPTS.dashboard, catalogHash: HASH }),
    });

  it('returns 503 with the kill-switch receipt and its source', async () => {
    const local = parseLocalAgentConfig('{"enabled":false}');
    const agent = service({
      killSwitch: () => resolveKillSwitch({ env: '1', envMode: 'on-when-1', local }),
    });
    const res = await handleRequest(post(), { service: agent });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toMatchObject({
      error: 'unavailable',
      receipt: { guard: 'kill-switch', source: 'local-config' },
    });
    const health = await (
      await handleRequest(new Request('https://agent.example/v1/health'), { service: agent })
    ).json();
    expect(health).toMatchObject({
      enabled: false,
      guards: { killSwitch: { enabled: false, source: 'local-config' } },
    });
  });

  it('returns 503 with Retry-After and the breaker receipt while the breaker is open', async () => {
    const clock = manualClock();
    const agent = service({
      provider: failingProvider().provider,
      clock: clock.now,
      rateLimits: generous,
      breaker: { failureThreshold: 1, cooldownMs: 45_000 },
    });
    expect((await handleRequest(post(), { service: agent, clock: clock.now })).status).toBe(502);
    clock.advance(5_000);
    const res = await handleRequest(post(), { service: agent, clock: clock.now });
    expect(res.status).toBe(503);
    expect(res.headers.get('retry-after')).toBe('40');
    expect(await res.json()).toMatchObject({
      error: 'circuit-open',
      receipt: { guard: 'circuit-breaker', retryAfterMs: 40_000, breaker: { state: 'open' } },
    });
    const health = await (
      await handleRequest(new Request('https://agent.example/v1/health'), { service: agent })
    ).json();
    expect(health.guards.breaker).toMatchObject({
      state: 'open',
      trips: 1,
      retryAt: clock.now() + 40_000,
    });
  });
});
