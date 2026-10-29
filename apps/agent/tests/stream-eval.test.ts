import { describe, expect, it } from 'vitest';
import {
  formatStreamReport,
  loadStreamEvalCases,
  runStreamEval,
  STREAM_EVAL_VERSION,
} from '../evals/stream-harness.ts';
import { createFakeProvider, type Recording } from '../src/provider.ts';
import { build, HASH } from './helpers.ts';

/**
 * The streaming evaluation harness, offline: the fake replay provider on a
 * virtual clock streams every golden case through the SSE endpoint.
 */

describe('the streaming eval harness', () => {
  it('loads the golden audit fixtures (pinned) and the spec golden blueprints (measured)', () => {
    const cases = loadStreamEvalCases();
    const golden = cases.filter((c) => c.source === 'golden');
    const spec = cases.filter((c) => c.source === 'spec');
    expect(golden).toHaveLength(8);
    expect(golden.every((c) => c.expected !== null)).toBe(true);
    expect(spec.length).toBeGreaterThanOrEqual(9);
    expect(spec.every((c) => c.expected === null && c.id.startsWith('spec/'))).toBe(true);
  });

  it('measures validity, refusal reasons, time to first node and total time, deterministically', async () => {
    const options = { catalog: build.catalog, catalogHash: HASH };
    const report = await runStreamEval(options);
    expect(report.harness).toBe(STREAM_EVAL_VERSION);
    expect(report.clock).toBe('virtual');
    expect(report.provider).toBe('replay/fake');
    expect(report.totals.pinned).toBe(8);
    expect(report.totals.matched).toBe(8);
    expect(report.totals.errors).toBe(0);
    expect(report.totals.validityRate).toBeCloseTo(report.totals.valid / report.totals.cases, 2);
    // The developer-tier golden fixtures are refused for their tier.
    expect(report.totals.refusalReasons['tier-denied']).toBeGreaterThanOrEqual(2);
    for (const score of report.cases) {
      expect(score.totalMs, score.id).toBeGreaterThan(0);
      if (score.status === 'valid') {
        expect(score.nodesReady, score.id).toBeGreaterThan(0);
        expect(score.timeToFirstNodeMs, score.id).not.toBeNull();
        expect(score.timeToFirstNodeMs as number).toBeLessThan(score.totalMs);
        expect(score.draftChunks).toBeGreaterThan(1);
      }
    }
    expect(report.totals.timeToFirstNodeMs.median).not.toBeNull();
    // Same code, same report, byte for byte (virtual clock).
    expect(formatStreamReport(await runStreamEval(options))).toBe(formatStreamReport(report));
  }, 120_000);

  it('catches a regressing or failing provider', async () => {
    const cases = loadStreamEvalCases().filter((c) => c.source === 'golden');
    const silent = (recordings: readonly Recording[]) =>
      createFakeProvider(
        recordings.map((r) => ({ prompt: r.prompt, calls: [[{ type: 'text', text: 'No.' }]] })),
        { label: 'replay/silent' }
      );
    const regressed = await runStreamEval({
      catalog: build.catalog,
      catalogHash: HASH,
      cases,
      provider: silent,
    });
    expect(regressed.totals.valid).toBe(0);
    expect(regressed.totals.refusalReasons['no-tree']).toBe(regressed.totals.invalid);
    expect(regressed.totals.matched).toBeLessThan(regressed.totals.pinned);
    expect(regressed.cases.every((c) => c.timeToFirstNodeMs === null)).toBe(true);

    const dropping = (recordings: readonly Recording[]) =>
      createFakeProvider(
        recordings.map((r) => ({
          prompt: r.prompt,
          calls: [{ events: r.calls[0] as never, outcome: 'failure' as const, cutAt: 80 }],
        })),
        { chunkSize: 16 }
      );
    const dropped = await runStreamEval({
      catalog: build.catalog,
      catalogHash: HASH,
      cases: cases.slice(0, 2),
      provider: dropping,
    });
    expect(dropped.totals.errors).toBe(2);
    expect(dropped.cases.map((c) => c.error)).toEqual(['provider-error', 'provider-error']);
  }, 120_000);
});
