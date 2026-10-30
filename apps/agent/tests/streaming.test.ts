import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spreadsheetManifest } from '@texuli/catalog/manifests/sheets';
import { createBlueprintAssembler } from '@texuli/spec/stream';
import { describe, expect, it } from 'vitest';
import type { AgentEvent, DraftResult } from '../src/contract.ts';
import { admitRequest } from '../src/contract.ts';
import { DEMO_PROMPTS, DEMO_RECORDINGS } from '../src/demo.ts';
import { handleRequest } from '../src/http.ts';
import {
  canonicalJson,
  chunkText,
  createFakeProvider,
  type ProviderEvent,
  type Recording,
} from '../src/provider.ts';
import { readSse } from '../src/providers/sse.ts';
import { caller, collect, HASH, request, service } from './helpers.ts';

/**
 * Streaming generation (ADR-014) through the service: the fake replay
 * provider streams recorded tool calls as `tool-delta` pieces; the service
 * re-frames them as one draft envelope per attempt (`draft-chunk`), checks
 * each node shell (`node-ready`, `refused`), and ends with `final`, the
 * full `validateDraft` verdict. No network, no key.
 */

const GOLDEN = join(import.meta.dirname, '../../../tests/fixtures/golden');
const golden = (name: string) =>
  (JSON.parse(readFileSync(join(GOLDEN, `${name}.json`), 'utf8')) as { tree: unknown }).tree;

const countNodes = (node: unknown): number => {
  const children = (node as { children?: unknown[] }).children ?? [];
  return 1 + children.reduce<number>((sum, child) => sum + countNodes(child), 0);
};

const recording = (prompt: string, tree: unknown, extra: ProviderEvent[] = []): Recording => ({
  prompt,
  calls: [
    [
      { type: 'text', text: 'Drafting.' },
      { type: 'tool', name: 'emit_blueprint', input: { tree } },
      ...extra,
    ],
  ],
});

const streamed = (events: readonly AgentEvent[], attempt = 1) =>
  events
    .filter(
      (e): e is Extract<AgentEvent, { type: 'draft-chunk' }> =>
        e.type === 'draft-chunk' && e.attempt === attempt
    )
    .map((e) => e.text)
    .join('');

/** The streamed envelope matches the validated one, except what validation stamps (status, spec). */
const expectSameEnvelope = (events: readonly AgentEvent[]) => {
  const sent = JSON.parse(streamed(events)) as Record<string, unknown>;
  const { status, spec, ...validated } = finalOf(events).envelope as unknown as Record<
    string,
    unknown
  >;
  expect(status).toBe('validated');
  expect(typeof spec).toBe('string');
  expect(sent.status).toBe('draft');
  expect({ ...sent, status: undefined }).toEqual({ ...validated, status: undefined });
};

const finalOf = (events: readonly AgentEvent[]): DraftResult => {
  const event = events.find((e) => e.type === 'final');
  if (event?.type !== 'final') throw new Error('no final event');
  return event.result;
};

describe('the fake replay provider streams deterministically', () => {
  it('writes children last in the canonical JSON and chunks it in fixed, cycling sizes', () => {
    expect(canonicalJson({ children: [{ children: [], id: 'b' }], id: 'a', props: {} })).toBe(
      '{"id":"a","props":{},"children":[{"id":"b","children":[]}]}'
    );
    expect(chunkText('abcdefghij', [1, 3])).toEqual(['a', 'bcd', 'e', 'fgh', 'i', 'j']);
    expect(chunkText('abc', 0)).toEqual(['a', 'b', 'c']);
  });

  it('streams a recorded tool call as tool-delta pieces that concatenate to its JSON', async () => {
    const tree = golden('01-landing-page');
    const provider = createFakeProvider([recording('p', tree)], { chunkSize: [5, 17, 2] });
    const events: ProviderEvent[] = [];
    for await (const event of provider.generate({
      system: '',
      tools: [],
      messages: [{ role: 'user', text: 'p' }],
    })) {
      events.push(event);
    }
    const deltas = events.filter((e) => e.type === 'tool-delta');
    expect(deltas.length).toBeGreaterThan(10);
    expect(new Set(deltas.map((d) => d.type === 'tool-delta' && d.callId)).size).toBe(1);
    expect(deltas.map((d) => (d.type === 'tool-delta' ? d.text : '')).join('')).toBe(
      canonicalJson({ tree })
    );
    expect(events.at(-1)).toEqual({ type: 'done' });
  });

  it('paces events with the injected sleep (configurable latency)', async () => {
    const waits: number[] = [];
    const provider = createFakeProvider(DEMO_RECORDINGS, {
      chunkSize: 64,
      latencyMs: 25,
      sleep: async (ms) => {
        waits.push(ms);
      },
    });
    let yielded = 0;
    for await (const _ of provider.generate({
      system: '',
      tools: [],
      messages: [{ role: 'user', text: DEMO_PROMPTS.report }],
    })) {
      yielded += 1;
    }
    // One wait before every event except the closing `done`.
    expect(waits.length).toBe(yielded - 1);
    expect(new Set(waits)).toEqual(new Set([25]));
  });

  it('injects interruptions: cutAt stops the tool JSON, then the outcome applies', async () => {
    const tree = golden('01-landing-page');
    const run = async (outcome: 'failure' | 'error') => {
      const provider = createFakeProvider(
        [
          {
            prompt: 'p',
            calls: [
              {
                events: [{ type: 'tool', name: 'emit_blueprint', input: { tree } }],
                outcome,
                cutAt: 100,
                retryable: false,
              },
            ],
          },
        ],
        { chunkSize: 30 }
      );
      const events: ProviderEvent[] = [];
      try {
        for await (const event of provider.generate({
          system: '',
          tools: [],
          messages: [{ role: 'user', text: 'p' }],
        })) {
          events.push(event);
        }
      } catch (cause) {
        return { events, thrown: (cause as Error).message };
      }
      return { events, thrown: null };
    };
    const dropped = await run('failure');
    const text = dropped.events.map((e) => (e.type === 'tool-delta' ? e.text : '')).join('');
    expect(text).toBe(canonicalJson({ tree }).slice(0, 100));
    expect(dropped.thrown).toBe('Fake provider dropped the connection.');
    const typed = await run('error');
    expect(typed.thrown).toBeNull();
    expect(typed.events.at(-1)).toMatchObject({ type: 'error', retryable: false });
  });
});

describe('the service streams validated drafts', () => {
  const PROMPT = 'Stream the landing page.';
  const TREE = golden('01-landing-page');

  it('re-frames the tool JSON as one envelope, checks every node, and ends with final', async () => {
    const s = service({
      provider: createFakeProvider([recording(PROMPT, TREE)], { chunkSize: 23 }),
    });
    const events = await collect(s.draft(request(PROMPT, { stream: true }), caller));
    const types = events.map((e) => e.type);
    expect(types[0]).toBe('accepted');
    expect(types).not.toContain('result');
    expect(types.slice(-2)).toEqual(['final', 'done']);
    const result = finalOf(events);
    expect(result.status).toBe('valid');
    // The streamed envelope is the validated one, tree and header.
    expectSameEnvelope(events);
    const ready = events.filter((e) => e.type === 'node-ready');
    expect(ready).toHaveLength(countNodes(TREE));
    expect(ready[0]).toMatchObject({ attempt: 1, path: '0', streamId: '0', id: 'layout-page' });
    expect(events.some((e) => e.type === 'refused')).toBe(false);
    // Draft chunks arrive before the final verdict, and a node never before its text.
    const firstReady = types.indexOf('node-ready');
    expect(types.indexOf('draft-chunk')).toBeLessThan(firstReady);
    expect(types.indexOf('final')).toBeGreaterThan(types.lastIndexOf('node-ready'));
  });

  it('paints the same final draft and envelope text for every chunking', async () => {
    const outputs = new Set<string>();
    for (const chunkSize of [1, 2, 7, 64, 4096, [3, 11, 1, 29]]) {
      const s = service({
        provider: createFakeProvider([recording(PROMPT, TREE)], { chunkSize }),
        clock: () => Date.UTC(2026, 9, 28),
      });
      const events = await collect(s.draft(request(PROMPT, { stream: true }), caller));
      const result = finalOf(events);
      expect(result.status, String(chunkSize)).toBe('valid');
      outputs.add(`${streamed(events)}\n${JSON.stringify(result.draft)}`);
      expect(events.filter((e) => e.type === 'node-ready')).toHaveLength(countNodes(TREE));
    }
    expect(outputs.size).toBe(1);
  });

  it('streams a whole recorded tool call as one chunk', async () => {
    const s = service();
    const events = await collect(s.draft(request(DEMO_PROMPTS.report, { stream: true }), caller));
    expect(events.filter((e) => e.type === 'draft-chunk')).toHaveLength(1);
    expectSameEnvelope(events);
  });

  it('leaves the v1 event stream unchanged without stream, even for a streaming provider', async () => {
    const s = service({
      provider: createFakeProvider([recording(PROMPT, TREE)], { chunkSize: 9 }),
    });
    const events = await collect(s.draft(request(PROMPT), caller));
    const types = new Set(events.map((e) => e.type));
    for (const type of ['draft-chunk', 'node-ready', 'refused', 'final']) {
      expect(types.has(type as AgentEvent['type'])).toBe(false);
    }
    const result = events.find((e) => e.type === 'result');
    expect(result?.type === 'result' && result.result.status).toBe('valid');
  });

  it('refuses a tier-denied node and holds its subtree; the final verdict refuses the draft', async () => {
    const tree = {
      id: 'layout-page',
      props: { title: 'Settings' },
      children: [{ id: 'form', props: {}, children: [{ id: 'text', props: { text: 'x' } }] }],
    };
    const s = service({
      provider: createFakeProvider([recording(PROMPT, tree)], { chunkSize: 8 }),
    });
    const events = await collect(s.draft(request(PROMPT, { stream: true }), caller));
    const refused = events.filter((e) => e.type === 'refused');
    expect(refused[0]).toMatchObject({ path: '0.children.0', reason: 'node' });
    expect(refused[0]?.type === 'refused' && refused[0].codes.length).toBeGreaterThan(0);
    expect(refused[1]).toMatchObject({
      path: '0.children.0.children.0',
      reason: 'held',
      codes: ['ancestor-held'],
    });
    // The repair loop re-asks; the recording answers the same, so the verdict stays invalid.
    expect(events.filter((e) => e.type === 'repairing').length).toBeGreaterThan(0);
    expect(events.some((e) => e.type === 'draft-chunk' && e.attempt === 2)).toBe(true);
    expect(finalOf(events).status).toBe('invalid');
  });

  const rawRecording = (prompt: string, pieces: readonly string[]): Recording => ({
    prompt,
    calls: [
      pieces.map((text) => ({
        type: 'tool-delta' as const,
        callId: 'raw-1',
        name: 'emit_blueprint',
        text,
      })),
    ],
  });

  it('holds a node whose member arrives after its children (stream-order)', async () => {
    const json =
      '{"tree":{"id":"layout-doc","children":[{"id":"blocks-text","props":{"block":{"type":"text","markdown":"Hi"}}}],"props":{"title":"Late"}}}';
    const s = service({
      provider: createFakeProvider([rawRecording(PROMPT, chunkText(json, 10))]),
    });
    const events = await collect(s.draft(request(PROMPT, { stream: true }), caller));
    expect(events.find((e) => e.type === 'refused' && e.attempt === 1)).toMatchObject({
      path: '0',
      reason: 'stream-order',
    });
  });

  it.each([
    ['duplicate-key', '{"tree":{"id":"layout-doc","id":"layout-page"}}'],
    ['prototype-key', '{"tree":{"id":"layout-doc","props":{"__proto__":{"x":1}}}}'],
    ['bad-json', '{"tree":{"id":"layout-doc",,}}'],
    ['truncated', '{"tree":{"id":"layout-doc","props":{'],
  ])('refuses a %s stream at $ and never forwards the bad chunk', async (code, json) => {
    const s = service({ provider: createFakeProvider([rawRecording(PROMPT, chunkText(json, 6))]) });
    const events = await collect(s.draft(request(PROMPT, { stream: true }), caller));
    const result = finalOf(events);
    expect(result.status).toBe('invalid');
    expect(result.diagnostics.map((d) => d.code)).toContain(`stream-${code}`);
    if (code !== 'truncated') {
      expect(events).toContainEqual({
        type: 'refused',
        attempt: 1,
        path: '$',
        reason: 'stream-error',
        codes: [`stream-${code}`],
      });
    }
    // Whatever was forwarded parses as a clean prefix of an envelope.
    const assembler = createBlueprintAssembler();
    const issues = assembler.write(streamed(events)).filter((e) => e.type === 'error');
    expect(issues).toEqual([]);
  });

  it('reports a provider interruption at every offset: forwarded prefix stays clean, error is retryable', async () => {
    const tree = golden('02-dashboard');
    const total = canonicalJson({ tree }).length;
    let runs = 0;
    for (let cutAt = 0; cutAt <= total; cutAt += Math.max(1, Math.floor(total / 97))) {
      runs += 1;
      const s = service({
        provider: createFakeProvider(
          [
            {
              prompt: PROMPT,
              calls: [
                {
                  events: [{ type: 'tool', name: 'emit_blueprint', input: { tree } }],
                  outcome: 'failure',
                  cutAt,
                },
              ],
            },
          ],
          { chunkSize: [13, 5] }
        ),
      });
      const events = await collect(s.draft(request(PROMPT, { stream: true }), caller));
      expect(events.slice(-2), String(cutAt)).toEqual([
        {
          type: 'error',
          code: 'provider-error',
          message: 'The model could not answer; try again.',
          retryable: true,
        },
        { type: 'done' },
      ]);
      expect(events.some((e) => e.type === 'final')).toBe(false);
      const assembler = createBlueprintAssembler();
      const out = assembler.write(streamed(events));
      expect(
        out.filter((e) => e.type === 'error'),
        String(cutAt)
      ).toEqual([]);
      // Every node reported ready had its shell complete in what was forwarded.
      const forwarded = new Set(out.filter((e) => e.type === 'node').map((e) => e.path));
      for (const e of events) if (e.type === 'node-ready') expect(forwarded.has(e.path)).toBe(true);
    }
    expect(runs).toBeGreaterThan(90);
  }, 60_000);

  it('passes a typed provider error through with its retryable flag', async () => {
    const s = service({
      recordings: [
        { prompt: 'typed', calls: [{ outcome: 'error', code: 'auth', retryable: false }] },
      ],
    });
    const events = await collect(s.draft(request('typed', { stream: true }), caller));
    expect(events.at(-2)).toMatchObject({
      type: 'error',
      code: 'provider-error',
      retryable: false,
    });
  });

  it('admits stream only as a boolean', () => {
    expect(
      admitRequest(JSON.stringify({ prompt: 'x', catalogHash: HASH, stream: true }))
    ).toMatchObject({
      ok: true,
      request: { stream: true },
    });
    const off = admitRequest(JSON.stringify({ prompt: 'x', catalogHash: HASH, stream: false }));
    expect(off.ok && 'stream' in off.request).toBe(false);
    expect(
      admitRequest(JSON.stringify({ prompt: 'x', catalogHash: HASH, stream: 'yes' }))
    ).toMatchObject({
      ok: false,
      code: 'bad-request',
    });
  });
});

describe('the endpoint streams server-sent events', () => {
  const PROMPT = 'Stream the dashboard.';
  const TREE = golden('02-dashboard');
  const s = () =>
    service({ provider: createFakeProvider([recording(PROMPT, TREE)], { chunkSize: 40 }) });
  const post = (accept?: string) =>
    new Request('https://agent.example/v1/draft', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(accept ? { accept } : {}) },
      body: JSON.stringify({ prompt: PROMPT, catalogHash: HASH, stream: true }),
    });

  it('sends draft-chunk, node-ready, final and done frames that a client can read', async () => {
    const res = await handleRequest(post('text/event-stream'), { service: s(), ipOf: () => 'sse' });
    expect(res.headers.get('content-type')).toBe('text/event-stream; charset=utf-8');
    const frames: { event: string; data: AgentEvent }[] = [];
    for await (const message of readSse(res.body as ReadableStream<Uint8Array>)) {
      frames.push({ event: message.event, data: JSON.parse(message.data) as AgentEvent });
    }
    for (const frame of frames) expect(frame.event).toBe(frame.data.type);
    const names = new Set(frames.map((f) => f.event));
    for (const name of ['accepted', 'draft-chunk', 'node-ready', 'validating', 'final', 'done']) {
      expect(names.has(name)).toBe(true);
    }
    const events = frames.map((f) => f.data);
    expectSameEnvelope(events);
  });

  it('answers one JSON result for a streamed request without an event-stream Accept', async () => {
    const res = await handleRequest(post(), { service: s(), ipOf: () => 'json' });
    expect(res.status).toBe(200);
    expect(((await res.json()) as DraftResult).status).toBe('valid');
  });
});

describe('the service validates document drafts with the host document validator', () => {
  const PROMPT = 'Draft the brief document.';
  const brief = JSON.parse(
    readFileSync(
      join(import.meta.dirname, '../../../packages/spec/fixtures/golden/document-brief.json'),
      'utf8'
    )
  ) as { tree: { props: { doc: { blocks: unknown[] } & Record<string, unknown> } } };
  const hostile = {
    ...brief.tree,
    props: {
      doc: {
        ...brief.tree.props.doc,
        blocks: [
          ...brief.tree.props.doc.blocks,
          {
            id: 'evil',
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Open',
                marks: [{ type: 'link', href: 'javascript:alert(1)' }],
              },
            ],
          },
        ],
      },
    },
  };

  it.each([true, false])('accepts a valid document draft (stream: %s)', async (stream) => {
    const s = service({ provider: createFakeProvider([recording(PROMPT, brief.tree)]) });
    const events = await collect(s.draft(request(PROMPT, { stream }), caller));
    const result = stream
      ? finalOf(events)
      : (events.find((e) => e.type === 'result') as { result: DraftResult }).result;
    expect(result.diagnostics).toEqual([]);
    expect(result.status).toBe('valid');
    if (stream) {
      expect(events.filter((e) => e.type === 'refused')).toEqual([]);
      expect(events.find((e) => e.type === 'node-ready')).toMatchObject({ id: 'document' });
    }
  });

  it.each([true, false])(
    'refuses a hostile document draft with the schema reason (stream: %s)',
    async (stream) => {
      const s = service({ provider: createFakeProvider([recording(PROMPT, hostile)]) });
      const events = await collect(s.draft(request(PROMPT, { stream }), caller));
      const result = stream
        ? finalOf(events)
        : (events.find((e) => e.type === 'result') as { result: DraftResult }).result;
      expect(result.status).toBe('invalid');
      const codes = result.diagnostics.map((d) => d.code);
      expect(codes).toContain('document-schema');
      expect(codes).not.toContain('document-unchecked');
      if (stream) {
        expect(events.find((e) => e.type === 'refused' && e.attempt === 1)).toMatchObject({
          path: '0',
          reason: 'node',
        });
        const refused = events.find((e) => e.type === 'refused' && e.attempt === 1);
        expect(refused?.type === 'refused' && refused.codes).toContain('document-schema');
      }
    }
  );
});

describe('the service validates forms, canvases and source bindings (spec 0.8.0)', () => {
  const spec = (name: string) =>
    (
      JSON.parse(
        readFileSync(
          join(import.meta.dirname, `../../../packages/spec/fixtures/golden/${name}.json`),
          'utf8'
        )
      ) as { tree: Record<string, unknown> }
    ).tree;
  const form = spec('form-registration');
  const canvas = spec('canvas-retro');
  const sourced = spec('source-tickets');
  const formNode = (form.children as Record<string, unknown>[])[0] as {
    props: { schema: { steps?: unknown } & Record<string, unknown> };
  };
  // An agent may never ship a regular expression (ReDoS): the forms validator refuses it.
  const hostileForm = {
    ...form,
    children: [
      {
        ...formNode,
        props: {
          ...formNode.props,
          schema: {
            title: 'Evil',
            fields: [{ name: 'code', type: 'text', label: 'Code', pattern: '^(a+)+$' }],
          },
        },
      },
    ],
  };
  const canvasProps = canvas.props as { canvas: Record<string, unknown> };
  const hostileCanvas = {
    ...canvas,
    props: { ...canvasProps, canvas: { ...canvasProps.canvas, format: 'texuli-evil' } },
  };
  const verdict = async (tree: unknown, stream: boolean) => {
    const prompt = 'Draft it.';
    const s = service({ provider: createFakeProvider([recording(prompt, tree)]) });
    const events = await collect(s.draft(request(prompt, { stream }), caller));
    const result = stream
      ? finalOf(events)
      : (events.find((e) => e.type === 'result') as { result: DraftResult }).result;
    const refused = events.filter((e) => e.type === 'refused' && e.attempt === 1);
    return { result, codes: result.diagnostics.map((d) => d.code), refused };
  };

  it.each([true, false])('accepts a valid form and a valid canvas (stream: %s)', async (stream) => {
    for (const tree of [form, canvas]) {
      const { result, refused } = await verdict(tree, stream);
      expect(result.diagnostics).toEqual([]);
      expect(result.status).toBe('valid');
      expect(refused).toEqual([]);
    }
  });

  it.each([true, false])(
    'refuses a hostile form and a hostile canvas with the schema reason (stream: %s)',
    async (stream) => {
      const formVerdict = await verdict(hostileForm, stream);
      expect(formVerdict.result.status).toBe('invalid');
      expect(formVerdict.codes).toContain('form-schema');
      expect(formVerdict.codes).not.toContain('form-unchecked');
      const canvasVerdict = await verdict(hostileCanvas, stream);
      expect(canvasVerdict.result.status).toBe('invalid');
      expect(canvasVerdict.codes).toContain('canvas-schema');
      expect(canvasVerdict.codes).not.toContain('canvas-unchecked');
      if (stream) {
        expect(formVerdict.refused.length).toBeGreaterThan(0);
        expect(canvasVerdict.refused.length).toBeGreaterThan(0);
      }
    }
  );

  it.each([true, false])(
    'refuses source bindings: the service holds no source registry (stream: %s)',
    async (stream) => {
      const { result, codes } = await verdict(sourced, stream);
      expect(result.status).toBe('invalid');
      expect(codes).toContain('source');
    }
  );

  // Sheets (spec 0.8.0): every agent formula is parsed by the sheet validator at draft time.
  const budget = spreadsheetManifest.examples?.[0]?.props.sheet as {
    sheets: { cells: Record<string, unknown> }[];
  } & Record<string, unknown>;
  const sheetTree = (sheet: unknown) => ({
    id: 'layout-page',
    props: { title: 'Offsite' },
    children: [{ id: 'spreadsheet', props: { sheet } }],
  });
  const firstTab = budget.sheets[0] as { cells: Record<string, unknown> } & Record<string, unknown>;
  const hostileSheet = {
    ...budget,
    sheets: [{ ...firstTab, cells: { ...firstTab.cells, E1: '=INDIRECT("A1")' } }],
  };

  it.each([true, false])(
    'accepts a valid spreadsheet and refuses a bad formula with the schema reason (stream: %s)',
    async (stream) => {
      const ok = await verdict(sheetTree(budget), stream);
      expect(ok.result.diagnostics).toEqual([]);
      expect(ok.result.status).toBe('valid');
      const bad = await verdict(sheetTree(hostileSheet), stream);
      expect(bad.result.status).toBe('invalid');
      expect(bad.codes).toContain('sheet-schema');
      expect(bad.codes).not.toContain('sheet-unchecked');
    }
  );
});
