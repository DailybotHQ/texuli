import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Catalog } from '@texuli/catalog/build';
import {
  type RenderNode,
  renderCatalogFromBuild,
  renderCatalogTree,
} from '@texuli/catalog/render/renderer';
import type { DraftResult } from '../src/contract.ts';
import { handleRequest } from '../src/http.ts';
import { createFakeProvider, type Provider, type Recording } from '../src/provider.ts';
import { createAgentService } from '../src/service.ts';

/**
 * The offline eval harness (agent-service design §9, Task 92). It drives the
 * full HTTP handler with the replay provider across the golden audit
 * fixtures (`tests/fixtures/golden`, read-only), scores each draft against
 * `golden-expectations.json`, and returns a deterministic summary: no
 * timestamps, no timings, fixtures in file order. No network, no key.
 *
 * Real-provider evals are planned, not built (`docs/evals.md`).
 */

export const EVAL_HARNESS_VERSION = 'agent-golden-eval/v1';

/** The golden suite directory, relative to this file. */
export const GOLDEN_DIR = join(import.meta.dirname, '../../../tests/fixtures/golden');

/** The pinned fixtures, in order (the same list as `tests/fixtures/golden/suite.ts`). */
export const GOLDEN_FIXTURES = [
  '01-landing-page',
  '02-dashboard',
  '03-settings-form',
  '04-checkout-flow',
  '05-chat-thread',
  '06-presentation-slide',
  '07-report-on-demand',
  '08-proactive-deck',
] as const;

interface GoldenTreeNode {
  id: string;
  props?: Record<string, unknown>;
  children?: readonly GoldenTreeNode[];
}

export interface GoldenFixture {
  fixture: string;
  /** The audit's one-line description of the screen; used as the prompt. */
  screen: string;
  tier: 'developer' | 'untrusted';
  tree: GoldenTreeNode;
}

interface PinnedRender {
  codes: readonly string[];
  placeholders: number;
}

export interface GoldenExpectation extends PinnedRender {
  tier: 'developer' | 'untrusted';
  nodes: number;
  components: number;
  sinks: readonly string[];
  grammar: readonly string[];
  cross: PinnedRender & { tier: 'developer' | 'untrusted' };
}

export interface GoldenSuite {
  catalogEntries: number;
  fixtures: readonly { fixture: GoldenFixture; expectation: GoldenExpectation }[];
}

export function loadGoldenSuite(dir = GOLDEN_DIR): GoldenSuite {
  const expectations = JSON.parse(readFileSync(join(dir, 'golden-expectations.json'), 'utf8')) as {
    catalogEntries: number;
    fixtures: Record<string, GoldenExpectation>;
  };
  return {
    catalogEntries: expectations.catalogEntries,
    fixtures: GOLDEN_FIXTURES.map((name) => {
      const fixture = JSON.parse(readFileSync(join(dir, `${name}.json`), 'utf8')) as GoldenFixture;
      const expectation = expectations.fixtures[name];
      if (!expectation) throw new Error(`${name} is not pinned in golden-expectations.json`);
      return { fixture, expectation };
    }),
  };
}

/**
 * What the pinned expectations say the agent's untrusted-tier gate must do
 * with this tree: accept it only when it renders cleanly in the untrusted
 * tier (no codes, no placeholders, no sinks).
 */
export function expectedOutcome(expectation: GoldenExpectation): 'valid' | 'invalid' {
  const untrusted = expectation.tier === 'untrusted' ? expectation : expectation.cross;
  const clean =
    untrusted.codes.length === 0 && untrusted.placeholders === 0 && expectation.sinks.length === 0;
  return clean ? 'valid' : 'invalid';
}

function countNodes(node: GoldenTreeNode): number {
  return 1 + (node.children ?? []).reduce((sum, child) => sum + countNodes(child), 0);
}

function countRendered(roots: readonly RenderNode[]): { components: number; placeholders: number } {
  let components = 0;
  let placeholders = 0;
  const visit = (node: RenderNode): void => {
    if (node.kind === 'placeholder') placeholders += 1;
    else {
      components += 1;
      node.children.forEach(visit);
    }
  };
  roots.forEach(visit);
  return { components, placeholders };
}

export interface FixtureScore {
  id: string;
  tier: 'developer' | 'untrusted';
  expected: 'valid' | 'invalid';
  status: 'valid' | 'invalid' | 'error';
  /** Error code when the service answered with an error instead of a result. */
  error: string | null;
  attempts: number;
  diagnostics: number;
  diagnosticCodes: readonly string[];
  /** Node and render counts of the returned draft vs the pinned untrusted-tier counts; `null` without a draft. */
  nodes: { expected: number; actual: number | null };
  components: { expected: number | null; actual: number | null };
  placeholders: { expected: number; actual: number | null };
  checks: { outcome: boolean; diagnostics: boolean; counts: boolean };
  pass: boolean;
}

export interface EvalSummary {
  harness: typeof EVAL_HARNESS_VERSION;
  provider: string;
  catalogHash: string;
  catalogEntries: { pinned: number; actual: number };
  fixtures: readonly FixtureScore[];
  totals: { fixtures: number; passed: number; failed: number };
}

export interface RunEvalOptions {
  catalog: Catalog;
  catalogHash: string;
  suite?: GoldenSuite;
  /**
   * Replaces the replay provider, e.g. to check that the harness catches a
   * regressing model. Real providers are not supported (no key, no network).
   */
  provider?: (recordings: readonly Recording[]) => Provider;
}

const UNLIMITED = { perSessionPerHour: 1e9, perIpPerHour: 1e9, perIpPerMinute: 1e9, perDay: 1e9 };

/** Run every golden fixture through the service and score it. Deterministic. */
export async function runGoldenEval(options: RunEvalOptions): Promise<EvalSummary> {
  const suite = options.suite ?? loadGoldenSuite();
  const recordings: Recording[] = suite.fixtures.map(({ fixture }) => ({
    prompt: fixture.screen,
    calls: [
      [
        { type: 'text', text: `Draft for ${fixture.fixture}.` },
        { type: 'tool', name: 'emit_blueprint', input: { tree: fixture.tree } },
      ],
    ],
  }));
  const provider = (options.provider ?? createFakeProvider)(recordings);
  let ids = 0;
  const service = createAgentService({
    catalog: options.catalog,
    catalogHash: options.catalogHash,
    provider,
    rateLimits: UNLIMITED,
    clock: () => Date.UTC(2026, 9, 25),
    newId: () => `eval-${String(++ids).padStart(3, '0')}`,
  });
  const renderCatalog = renderCatalogFromBuild(options.catalog);

  const fixtures: FixtureScore[] = [];
  for (const { fixture, expectation } of suite.fixtures) {
    const response = await handleRequest(
      new Request('https://agent.example/v1/draft', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: fixture.screen, catalogHash: options.catalogHash }),
      }),
      { service, ipOf: () => 'eval' }
    );
    const body = (await response.json()) as DraftResult | { error: string };
    const expected = expectedOutcome(expectation);
    const untrustedPlaceholders =
      expectation.tier === 'untrusted' ? expectation.placeholders : expectation.cross.placeholders;
    const pinnedComponents = expectation.tier === 'untrusted' ? expectation.components : null;

    if ('error' in body) {
      fixtures.push({
        id: fixture.fixture,
        tier: expectation.tier,
        expected,
        status: 'error',
        error: body.error,
        attempts: 0,
        diagnostics: 0,
        diagnosticCodes: [],
        nodes: { expected: expectation.nodes, actual: null },
        components: { expected: pinnedComponents, actual: null },
        placeholders: { expected: untrustedPlaceholders, actual: null },
        checks: { outcome: false, diagnostics: false, counts: false },
        pass: false,
      });
      continue;
    }

    const draft = body.status === 'valid' ? (body.draft as GoldenTreeNode | undefined) : undefined;
    const rendered = draft
      ? countRendered(renderCatalogTree(draft, { catalog: renderCatalog, tier: 'untrusted' }).roots)
      : null;
    const nodes = draft ? countNodes(draft) : null;
    const diagnosticCodes = [...new Set(body.diagnostics.map((d) => d.code))].sort();
    const outcome = body.status === expected;
    const diagnostics =
      expected === 'valid' ? body.diagnostics.length === 0 : body.diagnostics.length > 0;
    const counts =
      expected === 'valid'
        ? nodes === expectation.nodes &&
          rendered?.components === pinnedComponents &&
          rendered?.placeholders === untrustedPlaceholders
        : draft === undefined;
    fixtures.push({
      id: fixture.fixture,
      tier: expectation.tier,
      expected,
      status: body.status,
      error: null,
      attempts: body.receipt.attempts,
      diagnostics: body.diagnostics.length,
      diagnosticCodes,
      nodes: { expected: expectation.nodes, actual: nodes },
      components: { expected: pinnedComponents, actual: rendered?.components ?? null },
      placeholders: { expected: untrustedPlaceholders, actual: rendered?.placeholders ?? null },
      checks: { outcome, diagnostics, counts },
      pass: outcome && diagnostics && counts,
    });
  }

  const passed = fixtures.filter((score) => score.pass).length;
  return {
    harness: EVAL_HARNESS_VERSION,
    provider: provider.label,
    catalogHash: options.catalogHash,
    catalogEntries: { pinned: suite.catalogEntries, actual: options.catalog.entries.length },
    fixtures,
    totals: { fixtures: fixtures.length, passed, failed: fixtures.length - passed },
  };
}

/** Stable JSON for the summary artifact (two-space indent, trailing newline). */
export function formatSummary(summary: EvalSummary): string {
  return `${JSON.stringify(summary, null, 2)}\n`;
}
