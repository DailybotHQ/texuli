import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Catalog } from '@texuli/catalog/build';
import type { AgentEvent, DraftResult } from '../src/contract.ts';
import { handleRequest } from '../src/http.ts';
import { createFakeProvider, type Provider, type Recording } from '../src/provider.ts';
import { readSse } from '../src/providers/sse.ts';
import { createAgentService } from '../src/service.ts';
import { expectedOutcome, GOLDEN_DIR, loadGoldenSuite } from './harness.ts';

/**
 * The streaming evaluation harness (ADR-014). It runs a provider over the
 * golden set through the real endpoint (`POST /v1/draft` with
 * `"stream": true`, read as server-sent events) and measures what a person
 * waiting for an interface feels: validity rate, refusal reasons, time to
 * the first ready node and total time.
 *
 * The cases are the eight golden audit fixtures (`tests/fixtures/golden`,
 * with their pinned expected outcome) and the spec's golden blueprints
 * (`packages/spec/fixtures/golden`, measured only: their trees use state
 * and flows an agent tool call does not carry). Both are only read.
 *
 * Offline by default: the fake replay provider streams each fixture's tree
 * as `tool-delta` pieces with a configured latency, on a virtual clock, so
 * the report is deterministic (CI-like mode). A host may pass any
 * `Provider`, a real adapter included; this file never builds one, reads
 * no key and calls no network.
 */

export const STREAM_EVAL_VERSION = 'agent-stream-eval/v1';

export const SPEC_GOLDEN_DIR = join(import.meta.dirname, '../../../packages/spec/fixtures/golden');

export interface StreamEvalCase {
  id: string;
  source: 'golden' | 'spec';
  prompt: string;
  tree: unknown;
  /** The pinned untrusted-tier outcome, or `null` when the case is measured only. */
  expected: 'valid' | 'invalid' | null;
}

/** The golden audit fixtures, then the spec golden blueprints (file order). */
export function loadStreamEvalCases(
  goldenDir = GOLDEN_DIR,
  specDir = SPEC_GOLDEN_DIR
): StreamEvalCase[] {
  const golden = loadGoldenSuite(goldenDir).fixtures.map(
    ({ fixture, expectation }): StreamEvalCase => ({
      id: fixture.fixture,
      source: 'golden',
      prompt: fixture.screen,
      tree: fixture.tree,
      expected: expectedOutcome(expectation),
    })
  );
  const spec = readdirSync(specDir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name): StreamEvalCase => {
      const envelope = JSON.parse(readFileSync(join(specDir, name), 'utf8')) as {
        id?: string;
        tree: unknown;
      };
      const id = `spec/${name.replace(/\.json$/, '')}`;
      return {
        id,
        source: 'spec',
        prompt: `Build the ${envelope.id ?? id} interface.`,
        tree: envelope.tree,
        expected: null,
      };
    });
  return [...golden, ...spec];
}

export interface StreamCaseScore {
  id: string;
  source: 'golden' | 'spec';
  expected: 'valid' | 'invalid' | null;
  status: 'valid' | 'invalid' | 'error';
  /** The error code when the stream ended with `error` instead of `final`. */
  error: string | null;
  attempts: number;
  nodesReady: number;
  nodesRefused: number;
  /** Node-level refusal codes seen while streaming, sorted. */
  streamRefusals: readonly string[];
  /** Final diagnostic codes, sorted (why the draft was refused). */
  diagnosticCodes: readonly string[];
  draftChunks: number;
  streamedChars: number;
  /** From the request to the first `node-ready` frame; `null` when none arrived. */
  timeToFirstNodeMs: number | null;
  /** From the request to the last frame. */
  totalMs: number;
  /** The outcome matched the pinned one (`null` when nothing is pinned). */
  pass: boolean | null;
}

export interface TimingSummary {
  median: number | null;
  p95: number | null;
  max: number | null;
}

export interface StreamEvalReport {
  harness: typeof STREAM_EVAL_VERSION;
  provider: string;
  /** `virtual`: the fake latency on a virtual clock (deterministic). `wall`: real time. */
  clock: 'virtual' | 'wall';
  catalogHash: string;
  chunkSize: number | readonly number[] | null;
  latencyMs: number | null;
  cases: readonly StreamCaseScore[];
  totals: {
    cases: number;
    valid: number;
    invalid: number;
    errors: number;
    /** Valid drafts over all cases. */
    validityRate: number;
    /** Cases with a pinned outcome, and how many matched it. */
    pinned: number;
    matched: number;
    /** Final diagnostic codes over all refused drafts, with counts. */
    refusalReasons: Readonly<Record<string, number>>;
    timeToFirstNodeMs: TimingSummary;
    totalMs: TimingSummary;
  };
}

export interface StreamEvalOptions {
  catalog: Catalog;
  catalogHash: string;
  cases?: readonly StreamEvalCase[];
  /** Replaces the fake replay provider (built from the cases' recordings). */
  provider?: (recordings: readonly Recording[]) => Provider;
  /** Fake provider: tool JSON piece sizes. Default `[24, 7, 61]`. */
  chunkSize?: number | readonly number[];
  /** Fake provider: latency before each event. Default 15 ms. */
  latencyMs?: number;
  /**
   * `virtual` (default): the fake provider's waits advance a virtual clock
   * and nothing sleeps, so timings are deterministic. `wall`: real timers
   * and `performance.now()`.
   */
  clock?: 'virtual' | 'wall';
}

const UNLIMITED = { perSessionPerHour: 1e9, perIpPerHour: 1e9, perIpPerMinute: 1e9, perDay: 1e9 };

function timing(values: readonly (number | null)[]): TimingSummary {
  const sorted = values.filter((v): v is number => v !== null).sort((a, b) => a - b);
  if (sorted.length === 0) return { median: null, p95: null, max: null };
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)];
  return { median: at(0.5) ?? null, p95: at(0.95) ?? null, max: sorted.at(-1) ?? null };
}

const round = (ms: number) => Math.round(ms * 100) / 100;

/** Run every case through the streaming endpoint and measure it. */
export async function runStreamEval(options: StreamEvalOptions): Promise<StreamEvalReport> {
  const cases = options.cases ?? loadStreamEvalCases();
  const mode = options.clock ?? 'virtual';
  let virtual = 0;
  const now = mode === 'virtual' ? () => virtual : () => performance.now();
  const chunkSize = options.chunkSize ?? [24, 7, 61];
  const latencyMs = options.latencyMs ?? 15;
  const recordings: Recording[] = cases.map((c) => ({
    prompt: c.prompt,
    calls: [
      [
        { type: 'text-delta', text: `Draft for ${c.id}.` },
        { type: 'tool', name: 'emit_blueprint', input: { tree: c.tree } },
        { type: 'usage', inputTokens: 0, outputTokens: 0 },
      ],
    ],
  }));
  const provider = options.provider
    ? options.provider(recordings)
    : createFakeProvider(recordings, {
        chunkSize,
        latencyMs,
        ...(mode === 'virtual'
          ? {
              sleep: async (ms: number) => {
                virtual += ms;
              },
            }
          : {}),
      });
  let ids = 0;
  const service = createAgentService({
    catalog: options.catalog,
    catalogHash: options.catalogHash,
    provider,
    rateLimits: UNLIMITED,
    tokenBudgets: { perSessionDailyTokens: 1e12, globalDailyTokens: 1e12 },
    clock: () => Date.UTC(2026, 9, 28),
    newId: () => `stream-eval-${String(++ids).padStart(3, '0')}`,
  });

  const scores: StreamCaseScore[] = [];
  for (const c of cases) {
    const started = now();
    const response = await handleRequest(
      new Request('https://agent.example/v1/draft', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
        body: JSON.stringify({ prompt: c.prompt, catalogHash: options.catalogHash, stream: true }),
      }),
      { service, ipOf: () => 'eval' }
    );
    let firstNode: number | null = null;
    let nodesReady = 0;
    let nodesRefused = 0;
    let draftChunks = 0;
    let streamedChars = 0;
    const streamRefusals = new Set<string>();
    let result: DraftResult | null = null;
    let error: string | null = null;
    if (response.body && (response.headers.get('content-type') ?? '').includes('event-stream')) {
      for await (const message of readSse(response.body)) {
        const event = JSON.parse(message.data) as AgentEvent;
        if (event.type === 'node-ready') {
          nodesReady += 1;
          firstNode ??= now() - started;
        } else if (event.type === 'refused') {
          nodesRefused += 1;
          for (const code of event.codes) streamRefusals.add(code);
        } else if (event.type === 'draft-chunk') {
          draftChunks += 1;
          streamedChars += event.text.length;
        } else if (event.type === 'final') {
          result = event.result;
        } else if (event.type === 'error') {
          error = event.code;
        }
      }
    } else {
      error = ((await response.json()) as { error?: string }).error ?? `http-${response.status}`;
    }
    const totalMs = now() - started;
    const finalResult = result as DraftResult | null;
    const status = finalResult ? finalResult.status : 'error';
    scores.push({
      id: c.id,
      source: c.source,
      expected: c.expected,
      status,
      error,
      attempts: finalResult?.receipt.attempts ?? 0,
      nodesReady,
      nodesRefused,
      streamRefusals: [...streamRefusals].sort(),
      diagnosticCodes: [...new Set(finalResult?.diagnostics.map((d) => d.code) ?? [])].sort(),
      draftChunks,
      streamedChars,
      timeToFirstNodeMs: firstNode === null ? null : round(firstNode),
      totalMs: round(totalMs),
      pass: c.expected === null ? null : status === c.expected,
    });
  }

  const refusalReasons: Record<string, number> = {};
  for (const score of scores) {
    if (score.status !== 'invalid') continue;
    for (const code of score.diagnosticCodes)
      refusalReasons[code] = (refusalReasons[code] ?? 0) + 1;
  }
  const valid = scores.filter((s) => s.status === 'valid').length;
  const invalid = scores.filter((s) => s.status === 'invalid').length;
  const pinned = scores.filter((s) => s.pass !== null);
  return {
    harness: STREAM_EVAL_VERSION,
    provider: provider.label,
    clock: mode,
    catalogHash: options.catalogHash,
    chunkSize: options.provider ? null : chunkSize,
    latencyMs: options.provider ? null : latencyMs,
    cases: scores,
    totals: {
      cases: scores.length,
      valid,
      invalid,
      errors: scores.length - valid - invalid,
      validityRate: scores.length === 0 ? 0 : round(valid / scores.length),
      pinned: pinned.length,
      matched: pinned.filter((s) => s.pass === true).length,
      refusalReasons: Object.fromEntries(
        Object.entries(refusalReasons).sort(([a], [b]) => (a < b ? -1 : 1))
      ),
      timeToFirstNodeMs: timing(scores.map((s) => s.timeToFirstNodeMs)),
      totalMs: timing(scores.map((s) => s.totalMs)),
    },
  };
}

/** Stable JSON for the report artifact (two-space indent, trailing newline). */
export function formatStreamReport(report: StreamEvalReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}
