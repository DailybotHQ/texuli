import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  EVAL_HARNESS_VERSION,
  expectedOutcome,
  formatSummary,
  GOLDEN_FIXTURES,
  loadGoldenSuite,
  runGoldenEval,
} from '../evals/harness.ts';
import { createFakeProvider, type ProviderEvent, type Recording } from '../src/provider.ts';
import { build, HASH } from './helpers.ts';

/*
 * Task 92: the offline eval harness over the golden audit fixtures. Replay
 * and fake providers only: no network, no key.
 */

const base = { catalog: build.catalog, catalogHash: HASH };

/** A provider that rewrites every recorded tool call, to simulate a regressing model. */
function mutating(change: (tree: { id: string; children?: unknown[] }) => unknown) {
  return (recordings: readonly Recording[]) =>
    createFakeProvider(
      recordings.map((recording) => ({
        ...recording,
        calls: recording.calls.map((call) =>
          Array.isArray(call)
            ? call.map((event: ProviderEvent) =>
                event.type === 'tool'
                  ? {
                      ...event,
                      input: {
                        tree: change(
                          structuredClone((event.input as { tree: { id: string } }).tree)
                        ),
                      },
                    }
                  : event
              )
            : call
        ),
      })),
      { label: 'fake/regressing' }
    );
}

describe('golden eval harness', () => {
  it('scores all eight golden fixtures through the service, matching the pinned expectations', async () => {
    const summary = await runGoldenEval(base);
    expect(summary).toMatchObject({
      harness: EVAL_HARNESS_VERSION,
      provider: 'replay/fake',
      catalogHash: HASH,
      totals: { fixtures: 8, passed: 8, failed: 0 },
    });
    expect(summary.catalogEntries.actual).toBe(summary.catalogEntries.pinned);
    expect(summary.fixtures.map((score) => [score.id, score.status])).toEqual([
      ['01-landing-page', 'valid'],
      ['02-dashboard', 'valid'],
      ['03-settings-form', 'invalid'],
      ['04-checkout-flow', 'invalid'],
      ['05-chat-thread', 'valid'],
      ['06-presentation-slide', 'valid'],
      ['07-report-on-demand', 'valid'],
      ['08-proactive-deck', 'valid'],
    ]);
    for (const score of summary.fixtures.filter((item) => item.expected === 'valid')) {
      expect(score.diagnostics, score.id).toBe(0);
      expect(score.nodes.actual, score.id).toBe(score.nodes.expected);
      expect(score.components.actual, score.id).toBe(score.components.expected);
      expect(score.placeholders.actual, score.id).toBe(0);
      expect(score.attempts, score.id).toBe(1);
    }
    // The developer-tier app chrome is denied by the agent's untrusted gate.
    expect(summary.fixtures.find((s) => s.id === '03-settings-form')?.diagnosticCodes).toContain(
      'tier-denied'
    );
  });

  it('derives the expected outcome from the pinned untrusted-tier render', () => {
    const suite = loadGoldenSuite();
    expect(suite.fixtures.map(({ fixture }) => fixture.fixture)).toEqual([...GOLDEN_FIXTURES]);
    expect(
      Object.fromEntries(
        suite.fixtures.map(({ fixture, expectation }) => [
          fixture.fixture,
          expectedOutcome(expectation),
        ])
      )
    ).toMatchObject({
      '03-settings-form': 'invalid',
      '04-checkout-flow': 'invalid',
      '01-landing-page': 'valid',
    });
  });

  it('produces a byte-identical summary on every run, with no time-dependent fields', async () => {
    const first = formatSummary(await runGoldenEval(base));
    const second = formatSummary(await runGoldenEval(base));
    expect(second).toBe(first);
    expect(first).not.toMatch(/"(at|time|timing|totalMs|gateMs|date)"/);
    expect(first.endsWith('\n')).toBe(true);
  });

  it('fails a fixture when the model drops nodes', async () => {
    const summary = await runGoldenEval({
      ...base,
      provider: mutating((tree) => ({ ...tree, children: (tree.children ?? []).slice(0, 1) })),
    });
    const landing = summary.fixtures.find((score) => score.id === '01-landing-page');
    expect(landing?.checks.counts).toBe(false);
    expect(landing?.pass).toBe(false);
    expect(summary.provider).toBe('fake/regressing');
    expect(summary.totals.failed).toBeGreaterThan(0);
  });

  it('fails a fixture when the model emits a tier-denied component', async () => {
    const summary = await runGoldenEval({
      ...base,
      provider: mutating((tree) => ({
        ...tree,
        children: [
          ...(tree.children ?? []),
          { id: 'dialog', props: { title: 'Confirm transfer' } },
        ],
      })),
    });
    const dashboard = summary.fixtures.find((score) => score.id === '02-dashboard');
    expect(dashboard).toMatchObject({ status: 'invalid', expected: 'valid', pass: false });
    expect(dashboard?.diagnosticCodes).toContain('tier-denied');
  });

  it('fails every fixture when the model never calls the tool', async () => {
    const summary = await runGoldenEval({
      ...base,
      provider: () => createFakeProvider([], { fallback: [{ type: 'text', text: 'No.' }] }),
    });
    const valid = summary.fixtures.filter((score) => score.expected === 'valid');
    expect(valid.every((score) => !score.pass && score.diagnosticCodes.includes('no-tree'))).toBe(
      true
    );
  });

  it('writes its artifact under the git-ignored tmp/ folder only', () => {
    const runner = readFileSync(join(import.meta.dirname, '../evals/run.ts'), 'utf8');
    expect(runner).toContain("join(root, 'tmp', 'agent-evals', 'golden-summary.json')");
    const ignore = readFileSync(join(import.meta.dirname, '../../../.gitignore'), 'utf8')
      .split('\n')
      .map((line) => line.trim());
    expect(ignore).toContain('tmp/*');
    // No negation re-includes the eval artifacts.
    expect(ignore.filter((line) => line.startsWith('!tmp/'))).toEqual(['!tmp/.gitkeep']);
  });
});
