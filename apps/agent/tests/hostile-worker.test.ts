import { assertInertRoots, looksExecutable } from '@texuli/catalog/render/hostile';
import { renderCatalogFromBuild, renderCatalogTree } from '@texuli/catalog/render/renderer';
import { describe, expect, it } from 'vitest';
import { createLeakGuard, isHiddenOrBidi, WITHHELD_NOTE } from '../src/contain.ts';
import type { AgentEvent, DraftResult } from '../src/contract.ts';
import { handleRequest } from '../src/http.ts';
import { issueSession } from '../src/limits.ts';
import { createFakeProvider, type Provider, type ProviderRequest } from '../src/provider.ts';
import { blueprintTool, systemPrompt } from '../src/tools.ts';
import worker from '../src/worker.ts';
import {
  CANARY_SECRET,
  FORGED_OUTPUTS,
  JSON_INJECTIONS,
  MODEL_LEAKS_SYSTEM,
  PROMPT_INJECTIONS,
} from './fixtures/hostile-worker.ts';
import { build, caller, collect, HASH, request, service, toolCall } from './helpers.ts';

/*
 * Task 89: the worker hostile corpus. Every case must be rejected before the
 * model, or contained after it: no relayed instructions, no hidden
 * characters, no executable strings, catalog validation failing closed in the
 * untrusted tier, and no secret reaching the model or the response.
 */

const generous = { perSessionPerHour: 1e6, perIpPerHour: 1e6, perIpPerMinute: 1e6, perDay: 1e7 };
const SYSTEM = systemPrompt(build.catalog);
const WORKER_SESSION_SECRET = 'fictional-worker-session-secret-0001';
const leakGuard = createLeakGuard([SYSTEM, blueprintTool(build.catalog).description]);
const renderCatalog = renderCatalogFromBuild(build.catalog);

/** Records every request that reached the model. */
function spy(inner: Provider) {
  const requests: ProviderRequest[] = [];
  const provider: Provider = {
    label: inner.label,
    generate(input) {
      requests.push(structuredClone({ ...input, signal: undefined }));
      return inner.generate(input);
    },
  };
  return { provider, requests };
}

function stringsIn(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const item of value) stringsIn(item, out);
  else if (value !== null && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      out.push(key);
      stringsIn(item, out);
    }
  }
  return out;
}

/** True when `haystack` contains any 24-character run of `needle`. */
function echoes(haystack: string, needle: string): boolean {
  const n = needle.trim();
  if (n.length < 24) return haystack.includes(n);
  for (let i = 0; i + 24 <= n.length; i++) if (haystack.includes(n.slice(i, i + 24))) return true;
  return false;
}

/** A valid result must stay inert when the client re-renders it in the untrusted tier. */
function expectContained(result: DraftResult) {
  if (result.status === 'valid') {
    const rendered = renderCatalogTree(result.draft, { catalog: renderCatalog, tier: 'untrusted' });
    expect(assertInertRoots(rendered.roots)).toEqual([]);
    expect(stringsIn(result.draft).filter(looksExecutable)).toEqual([]);
    expect(result.envelope?.status).not.toBe('active');
    expect((result.envelope as { activatedBy?: unknown } | undefined)?.activatedBy).toBeUndefined();
  } else {
    expect(result.draft).toBeUndefined();
    expect(result.diagnostics.length).toBeGreaterThan(0);
  }
}

function modelTexts(events: AgentEvent[], result: DraftResult | undefined): string[] {
  return [
    ...events.flatMap((event) => (event.type === 'generating' ? [event.text] : [])),
    ...(result ? [result.note] : []),
  ];
}

describe('prompt injection corpus', () => {
  it('withholds a guarded instruction split across streamed text chunks', async () => {
    const excerpt = SYSTEM.slice(10, 70);
    const provider = createFakeProvider([
      {
        prompt: 'Summarize fictional support data.',
        calls: [
          [
            { type: 'text', text: `${'z'.repeat(60)}${excerpt.slice(0, 30)}` },
            { type: 'text', text: excerpt.slice(30) },
            toolCall({
              id: 'layout-doc',
              props: { title: 'Fictional support summary' },
              children: [
                {
                  id: 'blocks-text',
                  props: { block: { type: 'text', markdown: 'Fictional summary.' } },
                },
              ],
            }),
          ],
        ],
      },
    ]);
    const events = await collect(
      service({ provider, rateLimits: generous }).draft(
        request('Summarize fictional support data.'),
        caller
      )
    );
    const shown = events.flatMap((event) => (event.type === 'generating' ? [event.text] : []));
    const result = events.find(
      (event): event is Extract<AgentEvent, { type: 'result' }> => event.type === 'result'
    )?.result;

    expect(shown).toEqual([WITHHELD_NOTE]);
    expect(result?.note).toBe(WITHHELD_NOTE);
    expect(shown.join('')).not.toContain(excerpt);
  });

  for (const sample of PROMPT_INJECTIONS) {
    it(`contains "${sample.id}": ${sample.title}`, async () => {
      const calls = sample.model.map((call) =>
        Array.isArray(call)
          ? call.map((event) =>
              event.type === 'text' && event.text === MODEL_LEAKS_SYSTEM
                ? { ...event, text: SYSTEM }
                : event
            )
          : call
      );
      const { provider, requests } = spy(createFakeProvider([{ prompt: sample.prompt, calls }]));
      const events = await collect(
        service({ provider, rateLimits: generous }).draft(
          request(sample.prompt, sample.history ? { history: sample.history } : {}),
          caller
        )
      );
      const result = events.find(
        (event): event is Extract<AgentEvent, { type: 'result' }> => event.type === 'result'
      )?.result;
      expect(result, 'a result, never a crash').toBeDefined();
      if (!result) return;

      // The injection never reaches the system role or changes the instructions.
      expect(requests.length).toBeGreaterThan(0);
      for (const req of requests) {
        expect(req.system).toBe(SYSTEM);
        for (const message of req.messages) {
          if (message.text.includes(sample.prompt)) expect(message.role).toBe('user');
        }
      }

      // Model text is plain, capped and never relays the service's instructions.
      for (const text of modelTexts(events, result)) {
        expect([...text].some((char) => isHiddenOrBidi(char.codePointAt(0) ?? 0))).toBe(false);
        expect([...text].length).toBeLessThanOrEqual(500);
        expect(leakGuard.leaks(text)).toBe(false);
      }
      if (sample.id === 'reveal-system-prompt') {
        expect(modelTexts(events, result)).toContain(WITHHELD_NOTE);
      }

      // Worker-authored strings never echo the injected prompt.
      const workerText = [
        ...result.diagnostics.map((d) => d.message),
        JSON.stringify(result.receipt),
        ...(result.status === 'invalid' ? [result.note] : []),
      ].join('\n');
      expect(echoes(workerText, sample.prompt)).toBe(false);

      expectContained(result);
    });
  }

  it('fails closed at the untrusted tier for every hijacked tool call in the corpus', async () => {
    const statuses = await Promise.all(
      PROMPT_INJECTIONS.map(async (sample) => {
        const provider = createFakeProvider([{ prompt: sample.prompt, calls: sample.model }]);
        const events = await collect(
          service({ provider, rateLimits: generous }).draft(request(sample.prompt), caller)
        );
        const result = events.find(
          (event): event is Extract<AgentEvent, { type: 'result' }> => event.type === 'result'
        )?.result;
        return [sample.id, result?.status] as const;
      })
    );
    expect(Object.fromEntries(statuses)).toMatchObject({
      'tier-escalation': 'invalid',
      'forged-tool-call-in-prompt': 'invalid',
      'forged-history': 'invalid',
      'exfiltration-link': 'invalid',
      'markup-in-copy': 'invalid',
    });
  });

  it('never sends the session secret to the model or back to the caller', async () => {
    const sample = PROMPT_INJECTIONS.find((item) => item.id === 'secret-canary');
    if (!sample) throw new Error('missing secret-canary sample');
    const { provider, requests } = spy(
      createFakeProvider([{ prompt: sample.prompt, calls: sample.model }])
    );
    const now = Date.UTC(2026, 9, 25, 12);
    const token = await issueSession(CANARY_SECRET, now);
    const res = await handleRequest(
      new Request('https://agent.example/v1/draft', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt: sample.prompt, catalogHash: HASH }),
      }),
      {
        service: service({ provider, rateLimits: generous }),
        sessionSecret: CANARY_SECRET,
        clock: () => now,
      }
    );
    expect(res.status).toBe(200);
    // No tool call means the repair loop asks again; every attempt is checked.
    expect(requests.length).toBeGreaterThan(0);
    expect(JSON.stringify(requests)).not.toContain(CANARY_SECRET);
    expect(await res.text()).not.toContain(CANARY_SECRET);
  });
});

describe('JSON injection corpus', () => {
  for (const sample of JSON_INJECTIONS) {
    it(`rejects "${sample.id}" before the model: ${sample.title}`, async () => {
      const body = sample.body.replaceAll('%HASH%', HASH);
      const { provider, requests } = spy(createFakeProvider([]));
      const res = await handleRequest(
        new Request('https://agent.example/v1/draft', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
        }),
        { service: service({ provider, rateLimits: generous }) }
      );
      expect(res.status).toBe(sample.status);
      const json = (await res.json()) as { error: string; message: string };
      expect(json.error).toBe(sample.error);
      expect(requests).toHaveLength(0);
      expect(({} as { polluted?: unknown }).polluted).toBeUndefined();
      expect(Object.prototype).not.toHaveProperty('polluted');
      // The message is the worker's own text, never the hostile body echoed back.
      expect(json.message.includes('javascript:')).toBe(false);
      expect(json.message.length).toBeLessThan(200);

      // The deployed edge adapter answers the same way.
      const edge = await worker.fetch(
        new Request('https://agent.example/v1/draft', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${await issueSession(WORKER_SESSION_SECRET, Date.now())}`,
          },
          body,
        }),
        { AGENT_ENABLED: '1', AGENT_SESSION_SECRET: WORKER_SESSION_SECRET }
      );
      expect(edge.status).toBe(sample.status);
    });
  }
});

describe('forged model output corpus', () => {
  it('covers every renderer hostile sample as root, in a valid frame, or as markdown', () => {
    expect(FORGED_OUTPUTS.length).toBeGreaterThanOrEqual(70);
  });

  for (const sample of FORGED_OUTPUTS) {
    it(`fails closed or stays inert for forged output "${sample.id}"`, async () => {
      const provider = createFakeProvider([], {
        fallback: [{ type: 'tool', name: 'emit_blueprint', input: { tree: sample.tree } }],
      });
      const events = await collect(
        service({ provider, rateLimits: generous }).draft(request('Make a report.'), caller)
      );
      const result = events.find(
        (event): event is Extract<AgentEvent, { type: 'result' }> => event.type === 'result'
      )?.result;
      expect(result).toBeDefined();
      if (result) expectContained(result);
    });
  }
});
